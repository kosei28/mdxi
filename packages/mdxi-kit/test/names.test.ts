import path from "node:path";
import { expect, it } from "vitest";
import { collectFields, duplicates, formatName } from "../src/node/names";

it("finds duplicate names across imported mdx and scopes", async () => {
  const file = path.resolve(__dirname, "fixtures/doc.mdx");
  const fields = await collectFields(file, async (source, importer) => (source.startsWith(".") ? path.resolve(path.dirname(importer), source) : null));
  const dups = duplicates(fields).map((d) => [formatName(d.path), d.at.map((a) => `${path.basename(a.file)}:${a.line}`)]);
  expect(dups).toEqual([
    ["a", ["doc.mdx:7", "doc.mdx:8"]],
    // branches of a ternary count too
    ["b", ["doc.mdx:10", "doc.mdx:10"]],
    ["phone", ["part.mdx:3", "doc.mdx:14"]],
    ["s2.phone", ["part.mdx:3", "part.mdx:3"]],
  ]);
});
