import type { Expression, ImportDeclaration, Node, Program } from "estree";
import type { Root, RootContent } from "mdast";

const INTERNAL = "mdxi-kit/internal";
const BOUNDARY = "MdxiBoundary__";
const WRAP = "withMdxiProps__";

function importDecl(imported: string, local: string): ImportDeclaration {
  return {
    type: "ImportDeclaration",
    specifiers: [
      {
        type: "ImportSpecifier",
        imported: { type: "Identifier", name: imported },
        local: { type: "Identifier", name: local },
      },
    ],
    source: { type: "Literal", value: INTERNAL },
    attributes: [],
  } as ImportDeclaration;
}

/** Wrap each top-level JSX block and expression so that an error is shown in place. */
export function remarkMdxiBoundaries() {
  return (tree: Root) => {
    let wrapped = false;
    tree.children = tree.children.map((node): RootContent => {
      if (node.type !== "mdxJsxFlowElement" && node.type !== "mdxFlowExpression") return node;
      // `{/* comment */}`
      if (node.type === "mdxFlowExpression" && !(node.data?.estree as Program | undefined)?.body.length) return node;
      wrapped = true;
      return {
        type: "mdxJsxFlowElement",
        name: BOUNDARY,
        attributes: [],
        children: [node],
        position: node.position,
      } as RootContent;
    });
    if (wrapped) {
      tree.children.unshift({
        type: "mdxjsEsm",
        value: "",
        data: {
          estree: { type: "Program", sourceType: "module", body: [importDecl("Boundary", BOUNDARY)] } as Program,
        },
      } as RootContent);
    }
  };
}

/**
 * - `export default function MDXContent` → `export default withMdxiProps(MDXContent)`.
 * - `<MdxiBoundary>{children}</MdxiBoundary>` → children become `() => children`, so that
 *   expressions are evaluated inside the boundary and their errors are caught there.
 */
export function recmaMdxiWrap() {
  return (tree: Program) => {
    walk(tree, (node) => {
      if (node.type !== "CallExpression") return;
      const [type, props] = node.arguments;
      if (type?.type !== "Identifier" || type.name !== BOUNDARY || props?.type !== "ObjectExpression") return;
      for (const prop of props.properties) {
        if (prop.type === "Property" && prop.key.type === "Identifier" && prop.key.name === "children") {
          prop.value = { type: "ArrowFunctionExpression", params: [], body: prop.value as Expression, expression: true, async: false, generator: false };
        }
      }
    });

    const index = tree.body.findIndex(
      (node) =>
        node.type === "ExportDefaultDeclaration" &&
        node.declaration.type === "FunctionDeclaration" &&
        node.declaration.id?.name === "MDXContent",
    );
    if (index === -1) return;
    const declaration = (tree.body[index] as { declaration: Program["body"][number] }).declaration;
    tree.body.splice(index, 1, declaration, {
      type: "ExportDefaultDeclaration",
      declaration: {
        type: "CallExpression",
        callee: { type: "Identifier", name: WRAP },
        arguments: [{ type: "Identifier", name: "MDXContent" }],
        optional: false,
      },
    });
    tree.body.unshift(importDecl("withMdxiProps", WRAP));
  };
}

function walk(node: unknown, visit: (node: Node) => void) {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (node === null || typeof node !== "object") return;
  if (typeof (node as Node).type === "string") visit(node as Node);
  for (const [key, value] of Object.entries(node)) {
    if (key !== "position" && key !== "loc" && value && typeof value === "object") walk(value, visit);
  }
}
