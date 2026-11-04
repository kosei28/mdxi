# create-mdxi

[mdxi](https://www.npmjs.com/package/mdxi) のプロジェクトを作る。

```sh
npm create mdxi my-docs
# pnpm create mdxi my-docs / yarn create mdxi my-docs / bun create mdxi my-docs
```

作られるもの:

```
my-docs/
├── .claude/skills/mdxi/SKILL.md   # エージェント向けの Skill
├── package.json
├── vite.config.ts                 # mdxi プラグイン（labels に status のサンプル）
├── tsconfig.json                  # paths で @/* → src/*
├── src/components/
│   ├── Rating.tsx                 # useField を使った入力コンポーネントのサンプル
│   └── Contact.mdx                # MDX の部品のサンプル
└── docs/
    └── welcome.mdx                # サンプルのドキュメント
```

指定したディレクトリがすでにあって空でない場合は、何もせずにエラーで終わる。依存パッケージはインストールしないので、表示されるコマンドを実行する。
