#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const template = path.join(path.dirname(fileURLToPath(import.meta.url)), "template");
const dir = process.argv[2];

if (!dir || dir.startsWith("-")) {
  console.error("使い方: npm create mdxi <dir>");
  process.exit(1);
}

const target = path.resolve(dir);
if (fs.existsSync(target) && (!fs.statSync(target).isDirectory() || fs.readdirSync(target).length > 0)) {
  console.error(`${dir} はすでにあり、空ではありません。`);
  process.exit(1);
}

fs.cpSync(template, target, { recursive: true });
// npm does not publish `.gitignore`, so the template has `_gitignore`.
fs.renameSync(path.join(target, "_gitignore"), path.join(target, ".gitignore"));
const pkgFile = path.join(target, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
pkg.name = path.basename(target).toLowerCase().replace(/[^a-z0-9._~-]+/g, "-").replace(/^[._-]+/, "") || "my-docs";
fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + "\n");

const cdPath = path.relative(process.cwd(), target) || ".";
const agent = process.env.npm_config_user_agent ?? "";
const pm = ["pnpm", "yarn", "bun"].find((name) => agent.startsWith(name)) ?? "npm";
const run = pm === "npm" ? "npm run dev" : `${pm} dev`;

console.log(`${dir} を作成しました。

  cd ${/\s/.test(cdPath) ? JSON.stringify(cdPath) : cdPath}
  ${pm} install
  ${run}
`);
