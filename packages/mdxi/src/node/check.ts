import fs from "node:fs/promises";
import path from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { readFrontmatter, split } from "./frontmatter";
import { collectFields, duplicates, formatName, type Fields, type Occurrence } from "./names";
import { docPath, moduleUrl, type ResolvedOptions } from "./options";
import type { LabelsSchema } from "../runtime/store";
import { diagnose, listDocs, type MdxiPluginApi } from "./vite";
import { parseDocument } from "yaml";

export interface Problem {
  file: string;
  severity: "error" | "warning";
  message: string;
}

export async function check(files: string[], cwd = process.cwd()): Promise<Problem[]> {
  const server = await createServer({
    root: cwd,
    logLevel: "silent",
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true },
  });
  try {
    const api = server.config.plugins.find((p) => p.name === "mdxi")?.api as MdxiPluginApi | undefined;
    if (!api) throw new Error("vite.config に mdxi() プラグインが見つかりません。");
    const options = api.options;
    const targets = files.length
      ? files.map((f) => path.resolve(cwd, f))
      : (await listDocs(options.docsDir)).map((f) => path.join(options.docsDir, f));
    const problems: Problem[] = [];
    const cache = new Map<string, Promise<Fields>>();
    for (const file of targets) problems.push(...(await checkFile(server, options, file, cache)));
    return problems;
  } finally {
    await server.close();
  }
}

async function checkFile(server: ViteDevServer, options: ResolvedOptions, file: string, cache: Map<string, Promise<Fields>>): Promise<Problem[]> {
  const problems: Problem[] = [];
  const error = (message: string) => problems.push({ file, severity: "error", message });
  const warning = (message: string) => problems.push({ file, severity: "warning", message });

  let source: string;
  try {
    source = await fs.readFile(file, "utf8");
  } catch {
    error("ファイルが見つかりません。");
    return problems;
  }
  if (!file.endsWith(".mdx")) warning("拡張子が .mdx ではありません。");
  if (docPath(options.docsDir, file) === null) warning("ドキュメントのディレクトリの外にあります。ビューワーでは開けません。");

  // Frontmatter
  let labels: Record<string, unknown> = {};
  try {
    const { yaml } = split(source);
    if (yaml !== null) {
      const data = parseDocument(yaml).toJS() ?? {};
      for (const key of ["values", "labels"]) {
        const value = data?.[key];
        if (value !== undefined && value !== null && (typeof value !== "object" || Array.isArray(value))) {
          error(`フロントマターの ${key} はオブジェクトにしてください。`);
        }
      }
    }
    labels = readFrontmatter(source).labels;
  } catch (e) {
    error((e as Error).message);
  }

  // Compile and import resolution (the same transform as the dev server).
  const message = await diagnose(server, moduleUrl(options.root, file));
  if (message) error(message);

  // Duplicate names
  try {
    const resolve = async (specifier: string, importer: string) =>
      (await server.pluginContainer.resolveId(specifier, importer))?.id ?? null;
    const fields = await collectFields(file, resolve, cache);
    for (const dup of duplicates(fields)) {
      const loc = (a: Occurrence) => `${path.relative(options.root, a.file)}:${a.line ?? "?"}:${a.column ?? "?"}`;
      const where = dup.at.map((a) => (a.via ? `${loc(a)}（${loc(a.via)} で使用）` : loc(a))).join(", ");
      error(`name "${formatName(dup.path)}" が重複しています（${where}）。`);
    }
  } catch (e) {
    if (!message) error((e as Error).message);
  }

  for (const message of checkLabels(labels, options.labels)) warning(message);
  return problems;
}

export function checkLabels(labels: Record<string, unknown>, schema: LabelsSchema): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(labels)) {
    const def = schema[key];
    if (!def) {
      out.push(`ラベル "${key}" はスキーマにありません。`);
      continue;
    }
    if (value === null) continue;
    const options = def.options;
    if (def.type === "select") {
      if (typeof value !== "string") out.push(`ラベル "${key}" は文字列にしてください。`);
      else if (options && !options.includes(value)) out.push(`ラベル "${key}" の値 "${value}" は選択肢（${options.join(", ")}）にありません。`);
    } else if (def.type === "multiselect") {
      if (!Array.isArray(value)) out.push(`ラベル "${key}" は配列にしてください。`);
      else
        for (const item of value)
          if (typeof item !== "string" || (options && !options.includes(item)))
            out.push(`ラベル "${key}" の値 ${JSON.stringify(item)} は選択肢（${(options ?? []).join(", ")}）にありません。`);
    } else if (def.type === "text") {
      if (typeof value !== "string") out.push(`ラベル "${key}" は文字列にしてください。`);
    }
  }
  return out;
}
