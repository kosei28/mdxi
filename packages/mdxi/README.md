# mdxi

MDX で書いたドキュメントをブラウザで開いて、ユーザーが入力できるようにする Vite プラグイン + React のライブラリ。入力した値とラベルは、そのドキュメントのフロントマターに保存される。

新しく始めるときは `npm create mdxi <dir>` を使う。

## セットアップ

```sh
npm install mdxi react react-dom
npm install -D vite
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import mdxi from "mdxi/vite";

export default defineConfig({
  plugins: [
    mdxi({
      docs: "docs", // ドキュメントのディレクトリ（省略時は "docs"）
      labels: {
        status: { type: "select", options: ["open", "answered", "done"], default: "open" },
      },
    }),
  ],
});
```

`vite` で dev server を起動し、`http://localhost:5173/<docs からのパス>` を開く。左にファイルツリー、右にドキュメントが表示される。

`.mdx` の import に型を付けるには、tsconfig の `types` に `"mdxi/client"` を加える。

## ドキュメント

```mdx
import { Select, Checkbox } from "mdxi/components"

# 今日のランチ

<Select name="food" label="何を食べたいですか？" options={["和食", "中華", "イタリアン"]} />

{props.values.food === "中華" && <Checkbox name="spicy" label="辛いものも OK" />}
```

入力すると、フロントマターに保存される。

```yaml
---
labels:
  status: answered
values:
  food: 中華
  spicy: true
---
```

- 入力値は `props.values.<name>`、ラベルは `props.labels.<key>` で参照する。
- コンポーネントは、標準コンポーネントも含めてすべて `import` する。
- `name` は同じスコープの中で一意にする。

## 標準コンポーネント（`mdxi/components`）

| コンポーネント | 値 | 主な props |
|---|---|---|
| `TextInput` | string | `name`, `label`, `placeholder`, `multiline` |
| `NumberInput` | number | `name`, `label`, `min`, `max`, `step` |
| `Select` | string（`multiple` なら string[]） | `name`, `label`, `options`, `multiple` |
| `Checkbox` | boolean | `name`, `label` |
| `ObjectScope` | — | `name`。中の入力は `values.<name>.*` に保存される |
| `ArrayScope`, `ArrayScope.Item` | — | `name` / `index`。中の入力は `values.<name>[index].*` に保存される |

すべてのコンポーネントに `default`（未入力のときの値）を指定できる。

## コンポーネントを作る（`mdxi`）

```tsx
import { useField } from "mdxi";

export function Rating({ name, max = 5 }: { name: string; max?: number }) {
  const { value, setValue, error } = useField(name, 0);
  return (
    <div>
      {Array.from({ length: max }, (_, i) => (
        <button key={i} type="button" onClick={() => setValue(i + 1)}>{i < value ? "★" : "☆"}</button>
      ))}
      {error && <p>{error}</p>}
    </div>
  );
}
```

`useField(name, defaultValue)` は、今のスコープの下の `name` を読み書きする。

- `value`: 今の値（未入力なら `defaultValue`）
- `setValue(value)`: 値を変えて保存する。値は JSON で表せるものにする
- `error`: 同じ保存先の入力がほかにも表示されているときのエラーメッセージ。このあいだ値は保存されない。表示はコンポーネントに任せる

npm パッケージとして配布する場合は、`mdxi` と `react` を `peerDependencies` にする。

## CLI

```sh
mdxi check [file...]
```

コンパイル、import の解決、name の重複、ラベルの値を検査する。ファイルを指定しなければ、ドキュメントのディレクトリの中のすべての `.mdx` を検査する。`vite.config.ts` を読み込み、問題があれば終了コード 1 で終わる。
