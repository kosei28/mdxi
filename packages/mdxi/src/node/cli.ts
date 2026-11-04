#!/usr/bin/env node
import path from "node:path";
import { check } from "./check";

const HELP = `使い方: mdxi check [file...]

ドキュメントを検査します（コンパイル、import の解決、name の重複、ラベルの値）。
ファイルを指定しなければ、ドキュメントのディレクトリの中のすべての .mdx を検査します。
vite.config.ts は、カレントディレクトリから読み込みます。`;

async function main(argv: string[]) {
  const [command, ...args] = argv;
  if (!command || command === "-h" || command === "--help" || command === "help") {
    console.log(HELP);
    return command ? 0 : 1;
  }
  if (command !== "check") {
    console.error(`不明なコマンドです: ${command}\n\n${HELP}`);
    return 1;
  }
  if (args.includes("-h") || args.includes("--help")) {
    console.log(HELP);
    return 0;
  }

  const problems = await check(args);
  const byFile = new Map<string, typeof problems>();
  for (const problem of problems) byFile.set(problem.file, [...(byFile.get(problem.file) ?? []), problem]);
  for (const [file, list] of byFile) {
    console.log(path.relative(process.cwd(), file));
    for (const p of list) {
      const [first, ...rest] = p.message.split("\n");
      console.log(`  ${p.severity === "error" ? "error  " : "warning"} ${first}`);
      for (const line of rest) console.log(`          ${line}`);
    }
  }
  const errors = problems.filter((p) => p.severity === "error").length;
  const warnings = problems.length - errors;
  console.log(errors || warnings ? `\n${errors} 件のエラー、${warnings} 件の警告` : "問題は見つかりませんでした。");
  return errors ? 1 : 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
