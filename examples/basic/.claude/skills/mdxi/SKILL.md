---
name: mdxi
description: ユーザーに入力してもらう UI（質問、フォーム、チェックリスト、確認事項など）を mdxi のドキュメント（MDX）として作り、ユーザーの入力とラベルをフロントマターから読む。ユーザーに選択肢や情報を尋ねるとき、入力済みのドキュメントを確認するときに使う。
---

# mdxi

mdxi は、MDX で書いたドキュメントをブラウザで開いて、ユーザーが入力できるようにするツール。入力した値とラベルは、そのドキュメントのフロントマターに保存される。

- エージェントは MDX でドキュメントを書く。
- ユーザーはビューワー（Vite の dev server）でドキュメントを開いて入力する。
- エージェントはドキュメントのフロントマターを読んで、入力値（`values`）とラベル（`labels`）を確認する。

## 1. プロジェクトの設定を調べる

ディレクトリ名、エイリアス、パッケージマネージャーなどはプロジェクトごとに変えられる。下の表の「既定値」は例でしかないので、決め打ちせず、毎回プロジェクトの設定から調べる。

| 知りたいこと | 調べ方 | 既定値（例） |
|---|---|---|
| ドキュメントを置くディレクトリ | `vite.config.*` の `mdxi()` に渡している `docs`。省略されていれば `docs` | `docs` |
| ラベルの項目と意味 | `vite.config.*` の `mdxi()` の `labels`。各項目の `description` に意味が書かれている | `status` |
| 使えるカスタムコンポーネント | tsconfig の `paths` が指す場所（例: `src/components/`）のファイル、`package.json` の `dependencies` にある mdxi 用のパッケージ、既存のドキュメントの `import` | `src/components/` |
| import のエイリアス | tsconfig の `compilerOptions.paths` | `@/*` → `./src/*` |
| dev server の起動方法 | `package.json` の `scripts` のうち `vite` を実行しているもの。パッケージマネージャーは lockfile で判断する（`pnpm-lock.yaml` → pnpm、`yarn.lock` → yarn、`bun.lock` / `bun.lockb` → bun、`package-lock.json` → npm） | `npm run dev` |
| ドキュメントの URL | dev server が表示するアドレス（例: `http://localhost:5173`）+ ドキュメントのディレクトリからのパス | `http://localhost:5173/welcome.mdx` |

設定が見つからないとき、または読み取れないとき（設定を関数で動的に作っている場合など）は、推測で進めずにユーザーに確認する。

## 2. ドキュメントを書く

ドキュメントは、1 で調べたドキュメントのディレクトリの中に `.mdx` で作る。サブディレクトリに分けてもよい。

```mdx
import { Select, Checkbox, TextInput } from "mdxi/components"

# 今日のランチ

<Select name="food" label="何を食べたいですか？" options={["和食", "中華", "イタリアン"]} />

{props.values.food === "中華" && <Checkbox name="spicy" label="辛いものも OK" />}

<TextInput name="note" label="その他の希望" multiline />
```

### 規則

- 本文は標準の MDX。独自の構文はない。
- 使うコンポーネントは、標準コンポーネントも含めてすべて `import` する（グローバルに使えるコンポーネントはない）。import の書き方は Vite と同じ（tsconfig の `paths`、相対パス、npm パッケージ）。
- 入力コンポーネントには `name` を付ける。値はフロントマターの `values.<name>` に保存される。
- 入力値は `props.values.<name>`、ラベルは `props.labels.<key>` で参照できる。表示の切り替えは普通の JS の式（`&&`、三項演算子、`.map()`）で書く。
- `name` は同じスコープの中で一意にする。import した `.mdx` や、コンポーネントの中の入力も対象。重複するとビューワーでエラーになり、値が保存されない。
- フロントマターの `values` と `labels` はビューワーが書き込むので、エージェントは書かない。ラベルが未設定のときは、スキーマの `default` が使われる。

### 標準コンポーネント（`mdxi/components`）

| コンポーネント | 値 | 主な props |
|---|---|---|
| `TextInput` | string | `name`, `label`, `placeholder`, `multiline` |
| `NumberInput` | number | `name`, `label`, `min`, `max`, `step` |
| `Select` | string（`multiple` なら string[]） | `name`, `label`, `options`, `multiple` |
| `Checkbox` | boolean | `name`, `label` |
| `ObjectScope` | — | `name` |
| `ArrayScope`, `ArrayScope.Item` | — | `name` / `index` |

すべてのコンポーネントに `default`（未入力のときの値）を指定できる。`default` はフロントマターには保存されない。

### スコープ

値を入れ子にするときに使う。

- `<ObjectScope name="x">` の中の入力は `values.x.<name>` に保存される。
- `<ArrayScope name="x">` の中の `<ArrayScope.Item index={i}>` の中の入力は `values.x[i].<name>` に保存される。`ArrayScope` の中で `ArrayScope.Item` の外に入力を置くとエラーになる。
- 同じ部品（`.mdx` やコンポーネント）を 2 回使うときは、それぞれを別の `ObjectScope` で包む。
- import した `.mdx` の中の `props.values` は、その `.mdx` が置かれたスコープの値になる。

```mdx
import { ObjectScope } from "mdxi/components"
import Contact from "@/components/Contact.mdx"

<ObjectScope name="applicant"><Contact /></ObjectScope>
<ObjectScope name="emergency"><Contact /></ObjectScope>
```

### コンポーネントを作る

標準コンポーネントにない部品が必要なら、プロジェクトの中に React コンポーネントか `.mdx` を作って import する（置き場所は 1 で調べる）。入力コンポーネントは `useField`（`mdxi`）で作る。

```tsx
import { useField } from "mdxi";

export function Rating({ name, max = 5 }: { name: string; max?: number }) {
  // 今のスコープの下の name を読み書きする。error は name が重複しているときのメッセージ
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

値は JSON で表せるもの（文字列、数値、真偽値、null、配列、オブジェクト）にする。行を追加できるリストは、`useField` で配列を読み書きし、各行を `ArrayScope` と `ArrayScope.Item` で包めば作れる。

## 3. 確認して、ユーザーに伝える

1. ドキュメントを作ったら、`mdxi check <file>` を実行する（`package.json` の `scripts` に `check` があればそれを使い、なければパッケージマネージャー経由で `mdxi check` を実行する）。エラーがあれば直して、もう一度実行する。
2. dev server が動いていなければ、1 で調べた方法でバックグラウンドで起動する。
3. ドキュメントの URL をユーザーに伝える。

## 4. 入力を読む

- ユーザーの入力とラベルは、ドキュメントのフロントマターを直接読んで確認する（`values` と `labels`）。
- エージェントは `values` と `labels` を書き換えない。ユーザーが入力するものなので、ビューワーに任せる。
- 本文を書き換えるのはよい（開いているビューワーにも反映される）。本文から消えた入力の値もフロントマターに残る。
- ラベルの意味は `vite.config.*` の `labels` の `description` に従う（例: `status` が `answered` になったら、回答を読んで作業を進める）。

## 5. プロジェクト固有の内容

この Skill はプロジェクトの中にあるので、ユーザーが書き足してよい。下に、このプロジェクトのコンポーネントやラベルの使い方が書かれていれば、それを上の一般的な説明より優先する。

<!-- ここにプロジェクト固有のコンポーネント、ラベルの運用、ドキュメントの書き方などを書き足す -->
