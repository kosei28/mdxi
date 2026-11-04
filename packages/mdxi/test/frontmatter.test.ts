import { describe, expect, it } from "vitest";
import { readFrontmatter, split, writeFrontmatter } from "../src/node/frontmatter";

const doc = `---
title: keep me # comment
labels:
  status: open
---

import { Select } from "mdxi/components"

# Hello
`;

describe("frontmatter", () => {
  it("splits body", () => {
    expect(split(doc).body).toBe(`\nimport { Select } from "mdxi/components"\n\n# Hello\n`);
  });

  it("writes values and labels only", () => {
    const out = writeFrontmatter(doc, { values: { food: "中華", list: [{ a: 1 }] }, labels: { status: "done" } });
    expect(split(out).body).toBe(split(doc).body);
    expect(out).toContain("title: keep me # comment");
    expect(readFrontmatter(out)).toMatchObject({ values: { food: "中華", list: [{ a: 1 }] }, labels: { status: "done" } });
  });

  it("adds frontmatter when missing", () => {
    const out = writeFrontmatter("# Hi\n", { values: { a: 1 }, labels: {} });
    expect(out).toBe("---\nvalues:\n  a: 1\n---\n\n# Hi\n");
    expect(writeFrontmatter("# Hi\n", { values: {}, labels: {} })).toBe("# Hi\n");
  });

  it("handles an empty frontmatter", () => {
    expect(readFrontmatter("---\n---\n# x").values).toEqual({});
    expect(split("---\n---\n# x").body).toBe("# x");
  });
});
