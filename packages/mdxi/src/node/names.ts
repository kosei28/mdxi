import fs from "node:fs/promises";
import { createProcessor } from "@mdx-js/mdx";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import type { Node as EsNode, Program } from "estree";
import type { JSXElement, JSXOpeningElement } from "estree-jsx";
import type { Root } from "mdast";

/** Where an input with a static `name` attribute is placed. */
export interface Occurrence {
  file: string;
  line?: number;
  column?: number;
  /** The `<Component />` an imported `.mdx` was used from. */
  via?: Occurrence;
}

/** pathKey → occurrences. A path is a list of names; `[0]` is an item, `[{dynamic n}]` an item with a dynamic index. */
export type Fields = Map<string, { path: string[]; at: Occurrence[] }>;

export type Resolve = (source: string, importer: string) => Promise<string | null>;

const processor = createProcessor({ remarkPlugins: [remarkFrontmatter, remarkGfm] });

/**
 * Collect inputs with a static `name` in an MDX file and the `.mdx` files it imports.
 * Inputs in mutually exclusive branches (`a ? <X/> : <Y/>`) are not counted twice.
 */
export async function collectFields(file: string, resolve: Resolve, cache = new Map<string, Promise<Fields>>()): Promise<Fields> {
  let cached = cache.get(file);
  if (!cached) {
    cached = collect(file, resolve, cache);
    cache.set(file, cached);
  }
  return cached;
}

export function duplicates(fields: Fields) {
  return [...fields.values()].filter((f) => f.at.length > 1);
}

export function formatName(path: string[]) {
  return path.reduce((out, key) => (key.startsWith("[{") ? `${out}[i]` : key.startsWith("[") ? out + key : out ? `${out}.${key}` : key), "");
}

type Collected = Fields;

async function collect(file: string, resolve: Resolve, cache: Map<string, Promise<Fields>>): Promise<Fields> {
  const source = await fs.readFile(file, "utf8");
  const tree = processor.parse(source) as Root;
  const imports = new Map<string, string>(); // local name → resolved .mdx file
  for (const node of tree.children) {
    if (node.type !== "mdxjsEsm") continue;
    const program = node.data?.estree as Program | undefined;
    for (const statement of program?.body ?? []) {
      if (statement.type !== "ImportDeclaration" || typeof statement.source.value !== "string") continue;
      const resolved = await resolve(statement.source.value, file);
      if (!resolved || !resolved.split("?")[0].endsWith(".mdx")) continue;
      for (const spec of statement.specifiers) {
        if (spec.type === "ImportDefaultSpecifier") imports.set(spec.local.name, resolved.split("?")[0]);
      }
    }
  }

  // Fields of imported files, relative to their own root.
  const imported = new Map<string, Fields>();
  for (const target of new Set(imports.values())) {
    if (target === file) continue;
    imported.set(target, await collectFields(target, resolve, cache));
  }

  let unique = 0;
  const scopeKey = (value: string | null) => value ?? `{dynamic ${unique++}}`;

  const field = (scope: string[], name: string, at: Occurrence): Collected =>
    new Map([[JSON.stringify([...scope, name]), { path: [...scope, name], at: [at] }]]);

  const prefix = (fields: Fields, scope: string[], via: Occurrence): Collected => {
    const out: Collected = new Map();
    for (const { path, at } of fields.values()) {
      const full = [...scope, ...path];
      out.set(JSON.stringify(full), { path: full, at: at.map((a) => ({ ...a, via: a.via ?? via })) });
    }
    return out;
  };

  /** Handle one JSX element: scopes, inputs, imported `.mdx`. */
  const element = (name: string | null, attrs: Map<string, string | null>, scope: string[], at: Occurrence, children: (scope: string[]) => Collected): Collected => {
    if (name === "ObjectScope" || name === "ArrayScope") return children([...scope, scopeKey(attrs.get("name") ?? null)]);
    if (name === "ArrayScope.Item") {
      const index = attrs.get("index");
      return children([...scope, index != null && /^\d+$/.test(index) ? `[${index}]` : `[${scopeKey(null)}]`]);
    }
    const own: Collected[] = [];
    if (name && /^[A-Z]|\./.test(name)) {
      const target = imports.get(name);
      if (target && imported.has(target)) own.push(prefix(imported.get(target)!, scope, at));
      const fieldName = attrs.get("name");
      if (typeof fieldName === "string") own.push(field(scope, fieldName, at));
    }
    return seq([...own, children(scope)]);
  };

  const fromMdast = (node: unknown, scope: string[]): Collected => {
    const n = node as { type: string; children?: unknown[]; name?: string | null; attributes?: unknown[]; data?: { estree?: Program }; position?: { start: { line: number; column: number } } };
    const at = { file, line: n.position?.start.line, column: n.position?.start.column };
    if (n.type === "mdxJsxFlowElement" || n.type === "mdxJsxTextElement") {
      const attrs = new Map<string, string | null>();
      for (const attr of (n.attributes ?? []) as { type: string; name: string; value: unknown }[]) {
        if (attr.type !== "mdxJsxAttribute") continue;
        attrs.set(attr.name, typeof attr.value === "string" ? attr.value : staticString((attr.value as { data?: { estree?: Program } })?.data?.estree));
      }
      return element(n.name ?? null, attrs, scope, at, (s) => seq((n.children ?? []).map((c) => fromMdast(c, s))));
    }
    if ((n.type === "mdxFlowExpression" || n.type === "mdxTextExpression") && n.data?.estree) return fromEstree(n.data.estree, scope);
    return seq((n.children ?? []).map((c) => fromMdast(c, scope)));
  };

  const fromEstree = (node: unknown, scope: string[]): Collected => {
    if (Array.isArray(node)) return seq(node.map((c) => fromEstree(c, scope)));
    if (node === null || typeof node !== "object") return new Map();
    const n = node as EsNode & { type: string };
    if (n.type === "JSXElement") {
      const el = n as unknown as JSXElement;
      const opening = el.openingElement as JSXOpeningElement;
      const attrs = new Map<string, string | null>();
      for (const attr of opening.attributes) {
        if (attr.type !== "JSXAttribute" || attr.name.type !== "JSXIdentifier") continue;
        const value = attr.value;
        attrs.set(
          attr.name.name,
          value?.type === "Literal" && typeof value.value === "string"
            ? value.value
            : value?.type === "Literal" && typeof value.value === "number"
              ? String(value.value)
            : value?.type === "JSXExpressionContainer"
              ? staticString({ type: "Program", sourceType: "module", body: [{ type: "ExpressionStatement", expression: value.expression as never }] })
              : null,
        );
      }
      const loc = (el as { loc?: { start: { line: number; column: number } } }).loc;
      const at = { file, line: loc?.start.line, column: loc ? loc.start.column + 1 : undefined };
      return element(jsxName(opening.name), attrs, scope, at, (s) => fromEstree(el.children, s));
    }
    if (n.type === "ConditionalExpression" || n.type === "IfStatement") {
      const c = n as { test: unknown; consequent: unknown; alternate?: unknown };
      return seq([fromEstree(c.test, scope), alt(fromEstree(c.consequent, scope), fromEstree(c.alternate ?? null, scope))]);
    }
    const parts: Collected[] = [];
    for (const [key, value] of Object.entries(n)) {
      if (key === "loc" || key === "range" || key === "start" || key === "end") continue;
      if (value && typeof value === "object") parts.push(fromEstree(value, scope));
    }
    return seq(parts);
  };

  return fromMdast(tree, []);
}

function seq(parts: Collected[]): Collected {
  const out: Collected = new Map();
  for (const part of parts) {
    for (const [key, value] of part) {
      const existing = out.get(key);
      out.set(key, existing ? { path: value.path, at: [...existing.at, ...value.at] } : value);
    }
  }
  return out;
}

function alt(a: Collected, b: Collected): Collected {
  const out: Collected = new Map(a);
  for (const [key, value] of b) {
    const existing = out.get(key);
    if (!existing || existing.at.length < value.at.length) out.set(key, value);
  }
  return out;
}

function staticString(program: Program | undefined): string | null {
  const statement = program?.body[0];
  if (statement?.type !== "ExpressionStatement") return null;
  const expr = statement.expression;
  if (expr.type === "Literal" && (typeof expr.value === "string" || typeof expr.value === "number")) return String(expr.value);
  if (expr.type === "TemplateLiteral" && expr.expressions.length === 0) return expr.quasis[0].value.cooked ?? null;
  return null;
}

function jsxName(name: JSXOpeningElement["name"]): string | null {
  if (name.type === "JSXIdentifier") return name.name;
  if (name.type === "JSXMemberExpression") {
    const object = jsxName(name.object as JSXOpeningElement["name"]);
    return object ? `${object}.${name.property.name}` : null;
  }
  return null;
}
