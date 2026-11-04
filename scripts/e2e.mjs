// End-to-end check of the viewer against a running dev server.
// usage: node scripts/e2e.mjs <port> <example dir>
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const [port = "5199", dir = "examples/basic"] = process.argv.slice(2);
const base = `http://localhost:${port}`;
const file = path.resolve(dir, "docs/welcome.mdx");
const memberList = path.resolve(dir, "src/components/MemberList.tsx");
const original = fs.readFileSync(file, "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (fn, ms = 5000) => {
  const end = Date.now() + ms;
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch (e) { if (Date.now() > end) throw e; }
    if (Date.now() > end) throw new Error("timeout: " + fn);
    await sleep(100);
  }
};

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
let navigations = 0;
page.on("framenavigated", (f) => f === page.mainFrame() && navigations++);

try {
  await page.goto(`${base}/welcome.mdx`);
  await page.getByRole("heading", { name: "mdxi へようこそ" }).waitFor({ timeout: 15000 });
  const loads = navigations;

  // input → saved to frontmatter, body untouched
  const name = page.getByLabel("お名前");
  await name.click();
  await name.pressSequentially("佐藤");
  await page.getByLabel("食べたいもの").selectOption("中華");
  await page.getByLabel("辛いものも OK").check();
  await page.getByRole("button", { name: "4" }).click();
  await page.getByLabel("電話番号").first().fill("090-1111-2222");
  await waitFor(() => fs.readFileSync(file, "utf8").includes("090-1111-2222"));
  await sleep(800);
  const saved = fs.readFileSync(file, "utf8");
  assert.ok(saved.includes("name: 佐藤"), saved);
  assert.ok(saved.includes("food: 中華"));
  assert.ok(saved.includes("spicy: true"));
  assert.ok(saved.includes("satisfaction: 4"));
  assert.ok(/applicant:\n\s+phone: 090-1111-2222/.test(saved), saved);
  assert.equal(saved.slice(saved.indexOf("import ")), original.slice(original.indexOf("import ")));
  assert.equal(navigations, loads, "no reload while typing");
  assert.ok(await page.getByText("1 人で中華ですね。").isVisible());
  // focus kept after our own write came back
  await name.click();
  await name.press("End");
  await name.pressSequentially("さん");
  await sleep(1200);
  assert.equal(await name.inputValue(), "佐藤さん");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("name")), "name");

  // label
  await page.locator(".mdxi-labels select").selectOption("answered");
  await waitFor(() => fs.readFileSync(file, "utf8").includes("status: answered"));

  // external frontmatter change → re-render without reload
  const current = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, current.replace("food: 中華", "food: 和食"));
  await waitFor(async () => (await page.getByLabel("食べたいもの").inputValue()) === "和食");
  assert.equal(navigations, loads, "no reload on frontmatter change");
  assert.equal(await page.getByLabel("辛いものも OK").count(), 0);

  // external body change → reload and show new content
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("# mdxi へようこそ", "# mdxi へようこそ!"));
  await page.getByRole("heading", { name: "mdxi へようこそ!" }).waitFor({ timeout: 10000 });
  assert.equal(await page.getByLabel("お名前").inputValue(), "佐藤さん");

  // file tree: add / remove
  const extra = path.resolve(dir, "docs/sub/extra.mdx");
  fs.mkdirSync(path.dirname(extra), { recursive: true });
  fs.writeFileSync(extra, `import { TextInput } from "mdxi/components"\n\n# Extra\n\n<TextInput name="a" label="A" />\n\n<TextInput name="a" label="B" />\n\n{props.values.boom.x}\n`);
  await page.getByRole("link", { name: "extra.mdx" }).waitFor({ timeout: 5000 });
  await page.getByRole("link", { name: "extra.mdx" }).click();
  await page.getByRole("heading", { name: "Extra" }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/sub/extra.mdx");
  // duplicate names → both inputs show an error; runtime error shown in place
  await waitFor(async () => (await page.locator(".mdxi-field-error").count()) === 2);
  assert.ok(await page.getByText("name が重複しています").isVisible());
  assert.ok((await page.locator(".mdxi-error").allTextContents()).some((t) => /boom|undefined/.test(t)));
  await page.getByRole("textbox", { name: "A", exact: true }).fill("x");
  await sleep(800);
  assert.ok(!fs.readFileSync(extra, "utf8").startsWith("---"), "duplicate not saved: " + fs.readFileSync(extra, "utf8"));

  // compile error shown in place
  fs.writeFileSync(extra, "# Broken\n\n<div>\n");
  await page.getByText("コンパイルまたは import の解決に失敗しました").waitFor({ timeout: 10000 });
  console.log("compile error:", (await page.locator(".mdxi-error").first().textContent()).slice(0, 200));
  // import resolution error
  fs.writeFileSync(extra, 'import X from "@/components/Nope"\n\n# Missing\n\n<X />\n');
  await waitFor(async () => /Nope/.test(await page.locator(".mdxi-error").first().textContent()), 10000);
  console.log("import error:", (await page.locator(".mdxi-error").first().textContent()).slice(0, 200));

  // ArrayScope: a list component made with useValue (SPEC §4.2)
  fs.writeFileSync(memberList, `import { useValue } from "mdxi";
import { ArrayScope, TextInput } from "mdxi/components";
export function MemberList({ name }: { name: string }) {
  const [rows, setRows] = useValue<object[]>(name, []);
  return (
    <ArrayScope name={name}>
      {rows.map((_, i) => (
        <ArrayScope.Item index={i} key={i}>
          <TextInput name="name" label={"名前" + i} />
          <button onClick={() => setRows(rows.filter((_, j) => j !== i))}>削除{i}</button>
        </ArrayScope.Item>
      ))}
      <button onClick={() => setRows([...rows, {}])}>追加</button>
      <TextInput name="oops" label="外" />
    </ArrayScope>
  );
}
`);
  fs.writeFileSync(extra, `import { MemberList } from "@/components/MemberList"\nimport { ArrayScope } from "mdxi/components"\n\n# Members\n\n<MemberList name="members" />\n\n<ArrayScope.Item index={0}>x</ArrayScope.Item>\n`);
  await page.getByRole("heading", { name: "Members" }).waitFor({ timeout: 10000 });
  const errors = await page.locator(".mdxi-error").allTextContents();
  assert.ok(errors.some((t) => t.includes("ArrayScope.Item の外")), errors.join("|"));
  assert.ok(errors.some((t) => t.includes("ArrayScope.Item は ArrayScope の中に")), errors.join("|"));
  // remove the misplaced input and use the list
  fs.writeFileSync(memberList, fs.readFileSync(memberList, "utf8").replace('<TextInput name="oops" label="外" />', ""));
  await page.getByRole("button", { name: "追加" }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "追加" }).click();
  await page.getByRole("button", { name: "追加" }).click();
  await page.getByLabel("名前0").fill("佐藤");
  await page.getByLabel("名前1").fill("鈴木");
  await waitFor(() => fs.readFileSync(extra, "utf8").includes("鈴木"));
  await page.getByRole("button", { name: "削除0" }).click();
  await waitFor(() => !fs.readFileSync(extra, "utf8").includes("佐藤"));
  await sleep(500);
  assert.ok(/members:\n\s+- name: 鈴木\n---/.test(fs.readFileSync(extra, "utf8")), fs.readFileSync(extra, "utf8"));
  assert.equal(await page.getByLabel("名前0").inputValue(), "鈴木");

  fs.rmSync(path.dirname(extra), { recursive: true });
  await waitFor(async () => (await page.getByRole("link", { name: "extra.mdx" }).count()) === 0);
  console.log("OK");
} catch (error) {
  console.error(logs.join("\n"));
  await page.screenshot({ path: process.env.SHOT ?? "/tmp/mdxi-e2e.png" });
  throw error;
} finally {
  fs.writeFileSync(file, original);
  fs.rmSync(path.resolve(dir, "docs/sub"), { recursive: true, force: true });
  fs.rmSync(memberList, { force: true });
  await browser.close();
}
