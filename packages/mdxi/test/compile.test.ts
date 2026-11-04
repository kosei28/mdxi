import { compile } from "@mdx-js/mdx";
import remarkFrontmatter from "remark-frontmatter";
import { expect, it } from "vitest";
import { recmaMdxiWrap, remarkMdxiBoundaries } from "../src/node/mdx-plugins";

it("wraps blocks and the default export, drops frontmatter", async () => {
  const out = String(
    await compile(`---\nvalues:\n  secret: 1\n---\n\nimport { X } from "x"\n\n# Hi\n\n<X name="a" />\n\n{props.values.a && <X name="b" />}\n`, {
      remarkPlugins: [remarkFrontmatter, remarkMdxiBoundaries],
      recmaPlugins: [recmaMdxiWrap],
    }),
  );
  expect(out).toContain('import {Boundary as MdxiBoundary__} from "mdxi/internal"');
  expect(out).toContain('import {withMdxiProps as withMdxiProps__} from "mdxi/internal"');
  expect(out).toContain("export default withMdxiProps__(MDXContent)");
  expect(out.match(/MdxiBoundary__, {\n?\s*children: \(\) =>/g)?.length).toBe(2);
  expect(out).not.toContain("secret");
});
