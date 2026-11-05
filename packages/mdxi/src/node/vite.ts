import fs from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import mdxRollup from "@mdx-js/rollup";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import { createPathsMatcher, getTsconfig } from "get-tsconfig";
import { version as viteVersion, type Plugin, type ViteDevServer } from "vite";
import { readFrontmatter, split, writeFrontmatter } from "./frontmatter";
import { recmaMdxiWrap, remarkMdxiBoundaries } from "./mdx-plugins";
import { docPath, moduleUrl, resolveOptions, type MdxiOptions, type ResolvedOptions } from "./options";
import icon from "../icon.svg";

export type { MdxiOptions, LabelSchema, LabelsSchema } from "./options";

const ENTRY_URL = "/@mdxi/entry.js";
const ENTRY_ID = "\0mdxi:entry";
const API = "/__mdxi/";

export interface MdxiPluginApi {
  options: ResolvedOptions;
}

export default function mdxi(options: MdxiOptions = {}): Plugin[] {
  let resolved: ResolvedOptions = resolveOptions(options, process.cwd());
  let matchPaths: ((specifier: string) => string[]) | null = null;
  /** Body (everything after the frontmatter) of each compiled `.mdx`, to tell frontmatter-only changes apart. */
  const bodies = new Map<string, string>();
  const vite8 = Number(viteVersion.split(".")[0]) >= 8;

  const core: Plugin = {
    name: "mdxi",
    enforce: "pre",
    api: {
      get options() {
        return resolved;
      },
    } satisfies MdxiPluginApi,

    config() {
      return {
        appType: "custom",
        resolve: { dedupe: ["react", "react-dom"] },
        optimizeDeps: {
          include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
          exclude: ["mdxi"],
        },
        ...(vite8
          ? { oxc: { jsx: { runtime: "automatic", importSource: "react" } } }
          : { esbuild: { jsx: "automatic", jsxImportSource: "react" } }),
      };
    },

    configResolved(config) {
      resolved = resolveOptions(options, config.root);
      const tsconfig = getTsconfig(config.root);
      matchPaths = tsconfig ? createPathsMatcher(tsconfig) : null;
    },

    async resolveId(source, importer, opts) {
      if (source === ENTRY_URL) return ENTRY_ID;
      // tsconfig "paths"
      if (!matchPaths || source.startsWith(".") || source.startsWith("/") || source.startsWith("\0")) return null;
      if (importer && importer.includes("/node_modules/")) return null;
      for (const candidate of matchPaths(source)) {
        const result = await this.resolve(candidate, importer, { ...opts, skipSelf: true });
        if (result) return result;
      }
      return null;
    },

    load(id) {
      if (id !== ENTRY_ID) return null;
      const config = { labels: resolved.labels };
      return [
        `import { mount } from "mdxi/viewer";`,
        `mount(document.getElementById("mdxi-root"), ${JSON.stringify(config)});`,
      ].join("\n");
    },

    transform(code, id) {
      const [file] = id.split("?");
      if (file.endsWith(".mdx")) bodies.set(file, split(code).body);
      return null;
    },

    async handleHotUpdate({ file, read }) {
      if (!file.endsWith(".mdx")) return;
      const previous = bodies.get(file);
      if (previous === undefined) return;
      const { body } = split(await read());
      // Only the frontmatter changed: the compiled module is the same, so skip HMR.
      // The new values and labels are sent by the watcher below.
      if (body === previous) return [];
    },

    configureServer(server) {
      if (docPath(resolved.root, resolved.docsDir) === null && resolved.docsDir !== resolved.root) {
        server.watcher.add(resolved.docsDir);
      }
      const send = (event: string, data: unknown) => server.ws.send({ type: "custom", event, data });

      const onTree = (file: string) => {
        if (docPath(resolved.docsDir, file) !== null) send("mdxi:tree", {});
      };
      server.watcher.on("add", onTree);
      server.watcher.on("unlink", onTree);
      server.watcher.on("addDir", onTree);
      server.watcher.on("unlinkDir", onTree);
      server.watcher.on("change", async (file) => {
        const rel = docPath(resolved.docsDir, file);
        if (rel === null || !rel.endsWith(".mdx")) return;
        send("mdxi:data", await readData(file, rel));
      });

      server.middlewares.use((req, res, next) => {
        handle(server, resolved, req, res).then((handled) => !handled && next(), next);
      });
    },
  };

  const mdx = mdxRollup({
    mdExtensions: [],
    mdxExtensions: [".mdx"],
    remarkPlugins: [remarkFrontmatter, remarkGfm, remarkMdxiBoundaries],
    recmaPlugins: [recmaMdxiWrap],
  });

  return [core, { ...(mdx as Plugin), enforce: "pre" }];
}

async function readData(file: string, rel: string) {
  try {
    const { values, labels } = readFrontmatter(await fs.readFile(file, "utf8"));
    return { path: rel, values, labels };
  } catch (error) {
    return { path: rel, error: (error as Error).message };
  }
}

/** Find why a module (or one of the modules it imports) fails to load. */
export async function diagnose(server: ViteDevServer, url: string, seen = new Set<string>()): Promise<string | null> {
  if (seen.has(url)) return null;
  seen.add(url);
  try {
    await server.transformRequest(url);
  } catch (error) {
    return formatError(error);
  }
  const mod = await server.moduleGraph.getModuleByUrl(url);
  for (const child of mod?.importedModules ?? []) {
    if (!child.url || child.url.includes("/node_modules/") || child.url.startsWith("/@")) continue;
    if (child.file?.includes("/node_modules/")) continue;
    const message = await diagnose(server, child.url, seen);
    if (message) return message;
  }
  return null;
}

export function formatError(error: unknown): string {
  const e = error as { message?: string; id?: string; frame?: string; loc?: { file?: string; line: number; column: number } };
  const where = e.loc ? `${e.loc.file ?? e.id ?? ""}:${e.loc.line}:${e.loc.column}` : e.id;
  let message = e.message ?? String(error);
  if (where && !message.includes(where)) message = `${where}\n${message}`;
  if (e.frame) message += `\n\n${e.frame}`;
  return message;
}

const queues = new Map<string, Promise<unknown>>();
/** Run writes to the same file one after another. */
function serialize<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.then(task, task);
  queues.set(key, next.catch(() => {}));
  return next;
}

async function handle(server: ViteDevServer, options: ResolvedOptions, req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname.startsWith(API)) {
    const route = url.pathname.slice(API.length);
    try {
      if (route === "tree" && req.method === "GET") return json(res, 200, { files: await listDocs(options.docsDir) });
      if (route === "doc" && req.method === "GET") {
        const file = await docFile(options, url.searchParams.get("path"));
        const rel = docPath(options.docsDir, file)!;
        return json(res, 200, { ...(await readData(file, rel)), url: moduleUrl(options.root, file) });
      }
      if (route === "diagnose" && req.method === "GET") {
        const file = await docFile(options, url.searchParams.get("path"));
        return json(res, 200, { error: await diagnose(server, moduleUrl(options.root, file)) });
      }
      if (route === "doc" && req.method === "POST") {
        const body = JSON.parse(await readBody(req));
        const file = await docFile(options, body.path);
        const update: { values?: Record<string, unknown>; labels?: Record<string, unknown> } = {};
        for (const key of ["values", "labels"] as const) {
          if (body[key] === undefined) continue;
          if (!isPlainObject(body[key])) throw new HttpError(400, `${key} はオブジェクトにしてください。`);
          update[key] = body[key];
        }
        await serialize(file, async () => {
          const source = await fs.readFile(file, "utf8");
          const next = writeFrontmatter(source, update);
          if (next !== source) await fs.writeFile(file, next);
        });
        return json(res, 200, { ok: true });
      }
      return json(res, 404, { error: "not found" });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      return json(res, status, { error: (error as Error).message });
    }
  }

  // The viewer page, for every page navigation (`/`, `/2026-11/lunch.mdx`, ...).
  const accept = req.headers.accept ?? "";
  const dest = req.headers["sec-fetch-dest"];
  if (req.method === "GET" && (dest === "document" || (dest === undefined && accept.includes("text/html")))) {
    const html = await server.transformIndexHtml(req.url ?? "/", SHELL);
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(html);
    return true;
  }
  return false;
}

const SHELL = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>mdxi</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(icon)}" />
  </head>
  <body>
    <div id="mdxi-root"></div>
    <script type="module" src="${ENTRY_URL}"></script>
  </body>
</html>
`;

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function docFile(options: ResolvedOptions, rel: unknown): Promise<string> {
  if (typeof rel !== "string" || !rel.endsWith(".mdx")) throw new HttpError(400, "path には docs の中の .mdx を指定してください。");
  const file = path.resolve(options.docsDir, rel);
  if (docPath(options.docsDir, file) === null) throw new HttpError(403, "docs の外のファイルは扱えません。");
  try {
    const [real, realDocs] = await Promise.all([fs.realpath(file), fs.realpath(options.docsDir)]);
    if (docPath(realDocs, real) === null) throw new HttpError(403, "docs の外のファイルは扱えません。");
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(404, `${rel} が見つかりません。`);
  }
  return file;
}

export async function listDocs(dir: string, prefix = ""): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const rel = prefix + entry.name;
    if (entry.isDirectory()) out.push(...(await listDocs(path.join(dir, entry.name), rel + "/")));
    else if (entry.name.endsWith(".mdx")) out.push(rel);
  }
  return out;
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
  return true;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
