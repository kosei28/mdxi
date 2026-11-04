import path from "node:path";
import type { LabelsSchema } from "../runtime/store";

export type { LabelSchema, LabelsSchema } from "../runtime/store";

export interface MdxiOptions {
  /** Directory of the documents, relative to the Vite root. Default: "docs". */
  docs?: string;
  /** Label schema (§3). */
  labels?: LabelsSchema;
}

export interface ResolvedOptions {
  root: string;
  /** Absolute path of the documents directory. */
  docsDir: string;
  labels: LabelsSchema;
}

export function resolveOptions(options: MdxiOptions, root: string): ResolvedOptions {
  return {
    root,
    docsDir: path.resolve(root, options.docs ?? "docs"),
    labels: options.labels ?? {},
  };
}

/** Path of a file relative to the docs directory, or null if it is outside. */
export function docPath(docsDir: string, file: string): string | null {
  const rel = path.relative(docsDir, file);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join("/");
}

/** URL the browser imports the compiled module from. */
export function moduleUrl(root: string, file: string): string {
  const rel = path.relative(root, file);
  if (!rel.startsWith("..") && !path.isAbsolute(rel)) return "/" + rel.split(path.sep).join("/");
  return "/@fs" + (file.startsWith("/") ? "" : "/") + file.split(path.sep).join("/");
}
