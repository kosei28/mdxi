import { parseDocument, isMap } from "yaml";

const FRONTMATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n?^---[ \t]*(?:\r?\n|$)/m;

export interface SplitResult {
  /** YAML source without the fences, or null when there is no frontmatter. */
  yaml: string | null;
  body: string;
}

export function split(source: string): SplitResult {
  if (!source.startsWith("---")) return { yaml: null, body: source };
  const match = FRONTMATTER.exec(source);
  if (!match || match.index !== 0) return { yaml: null, body: source };
  return { yaml: match[1], body: source.slice(match[0].length) };
}

export interface Frontmatter {
  values: Record<string, unknown>;
  labels: Record<string, unknown>;
  data: Record<string, unknown>;
}

export function readFrontmatter(source: string): Frontmatter {
  const { yaml } = split(source);
  if (yaml === null) return { values: {}, labels: {}, data: {} };
  const doc = parseDocument(yaml);
  if (doc.errors.length) throw new Error(`フロントマターの YAML が不正です: ${doc.errors[0].message}`);
  const data = doc.toJS() ?? {};
  if (typeof data !== "object" || Array.isArray(data)) throw new Error("フロントマターはオブジェクトにしてください。");
  return { values: asObject(data.values), labels: asObject(data.labels), data };
}

/** Replace `values` and `labels` of the frontmatter. Other keys and the body stay as they are. */
export function writeFrontmatter(
  source: string,
  update: { values?: Record<string, unknown>; labels?: Record<string, unknown> },
): string {
  const { yaml, body } = split(source);
  const doc = parseDocument(yaml ?? "");
  if (doc.errors.length) throw new Error(`フロントマターの YAML が不正です: ${doc.errors[0].message}`);
  if (doc.contents !== null && !isMap(doc.contents)) throw new Error("フロントマターはオブジェクトにしてください。");
  for (const key of ["labels", "values"] as const) {
    const value = update[key];
    if (value === undefined) continue;
    if (Object.keys(value).length === 0 && !doc.has(key)) continue;
    doc.set(key, doc.createNode(value));
  }
  const text = doc.contents === null || (isMap(doc.contents) && doc.contents.items.length === 0) ? "" : doc.toString({ lineWidth: 0 });
  if (text === "") return yaml === null ? body : source;
  const nl = source.includes("\r\n") ? "\r\n" : "\n";
  const fm = (text.endsWith("\n") ? text : text + "\n").replace(/\r?\n/g, nl);
  const gap = yaml === null && body !== "" ? nl : "";
  return `---${nl}${fm}---${nl}${gap}${body}`;
}

function asObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
