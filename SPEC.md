# mdxi（MDX Interactive）仕様

AI エージェントがユーザー向けの UI を MDX ファイルとして書き、ユーザーがそれをブラウザで開いて入力するためのツール。

## 要件

1. エージェントは MDX で UI を書ける。
2. 入力用のコンポーネントを置ける。入力した内容は同じファイルに保存され、次に開いたときに復元される。
3. エージェントは入力内容を確認できる。
4. 入力内容に応じて表示を切り替えられる。
5. ユーザーがコンポーネントを追加して拡張できる。
6. ドキュメントにラベルを付けられる。ラベルの項目はスキーマで定義する。

## 構成

mdxi は **Vite プラグイン + React のライブラリ** として提供する。ユーザーは普通の Vite のプロジェクトを作り、ドキュメントのディレクトリ（既定は `docs/`。プラグインの `docs` で変更できる）に MDX のドキュメントを置く。

| 要素 | 内容 |
|---|---|
| npm パッケージ `mdxi` | Vite プラグイン（`mdxi/vite`）、標準コンポーネント（`mdxi/components`）、拡張用の API（`mdxi`）、CLI（`mdxi check`） |
| npm パッケージ `create-mdxi` | プロジェクトのテンプレートを作る（`npm create mdxi`）。エージェント向けの Skill も含む |

### プロジェクトの構成

```
my-docs/
├── .claude/skills/mdxi/
│   └── SKILL.md          # エージェント向けの Skill（§7）
├── package.json
├── vite.config.ts        # mdxi プラグインと、その設定（ラベルスキーマ）
├── tsconfig.json         # paths で @/* → src/*
├── src/
│   └── components/       # 自作のコンポーネント
│       ├── Rating.tsx
│       └── Contact.mdx
└── docs/                 # ドキュメント
    ├── welcome.mdx
    └── 2026-11/
        └── lunch.mdx
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import mdxi from "mdxi/vite";

export default defineConfig({
  plugins: [
    mdxi({
      docs: "docs",          // 省略時は "docs"
      labels: { /* §3 */ },
    }),
  ],
});
```

```json
// package.json
{
  "scripts": { "dev": "vite", "check": "mdxi check" },
  "dependencies": { "mdxi": "^1.0.0", "react": "^19.0.0", "react-dom": "^19.0.0" },
  "devDependencies": { "vite": "^8.0.0", "typescript": "^5.0.0" }
}
```

- `npm run dev`（`vite`）で起動し、ブラウザでドキュメントを開く。
- `mdxi` プラグインは、MDX のコンパイル（`@mdx-js/rollup`）、ビューワーの画面、値の保存、tsconfig の `paths` の解決をまとめて設定する。
- 依存関係は npm などに任せる。

---

## 1. ドキュメント

```mdx
---
labels:
  status: answered
values:
  food: 中華
  spicy: true
---

import { Select, Checkbox } from "mdxi/components"

# 今日のランチ

<Select name="food" label="何を食べたいですか？" options={["和食", "中華", "イタリアン"]} />

{props.values.food === "中華" && <Checkbox name="spicy" label="辛いものも OK" />}
```

### 1.1 フロントマター

| キー | 内容 | 書き込むもの |
|---|---|---|
| `values` | 入力値。キーは入力コンポーネントの `name` | ビューワー |
| `labels` | ラベルの値（§3） | ビューワー |

フロントマターにある他のキーは、変更せずにそのまま残す。

### 1.2 本文

- 本文は標準の MDX で、独自の構文は追加しない。
- 入力値とラベルは、MDX の `props` から参照する。
  - `props.values.<name>`
  - `props.labels.<key>`
- 表示の切り替えは、普通の JS の式（`&&`、三項演算子、`.map()` など）で書く。
- 使うコンポーネントは、標準コンポーネントも含めてすべて `import` する（グローバルに使えるコンポーネントはない）。

```mdx
import { TextInput } from "mdxi/components"
import { Rating } from "@/components/Rating"
import Contact from "@/components/Contact.mdx"
import { Gantt } from "some-mdxi-package"
```

import の解決は Vite に任せる。tsconfig の `paths`、相対パス、npm パッケージなど、Vite で使える書き方はそのまま使える。

---

## 2. 入力値

### 2.1 name

- 入力コンポーネントには `name` を付ける。値はフロントマターの `values.<name>` に保存する。
- name は、同じスコープ（§2.2）の中で一意にする。import した `.mdx` や、コンポーネントの中に置いた入力も対象。
- 同じ保存先の入力が 2 つ表示されたら、ビューワーは両方をエラー表示にし、値を保存しない。
- `mdxi check` は、本文と import した `.mdx` を読み、`name` 属性の重複を探してエラーにする。

### 2.2 スコープ

`values` は入れ子にできる。入れ子にするには、次の 2 種類のスコープを使う。

| コンポーネント | 保存先 |
|---|---|
| `<ObjectScope name="x">` | `values.x`（オブジェクト）。中の入力は、そのプロパティになる |
| `<ArrayScope name="x">` + `<ArrayScope.Item index={i}>` | `values.x`（配列）。`ArrayScope.Item` の中の入力は、i 番目の要素のプロパティになる |

```mdx
import { ObjectScope } from "mdxi/components"
import Contact from "@/components/Contact.mdx"

<ObjectScope name="applicant"><Contact /></ObjectScope>
<ObjectScope name="emergency"><Contact /></ObjectScope>
```

```mdx
{/* src/components/Contact.mdx */}
import { TextInput } from "mdxi/components"

<TextInput name="phone" label="電話番号" />
```

```yaml
values:
  applicant: { phone: 090-0000-0000 }
  emergency: { phone: 080-0000-0000 }
```

- スコープは入れ子にできる。
- `ArrayScope.Item` は `ArrayScope` の中にしか置けない。また、`ArrayScope` の中で `ArrayScope.Item` の外に置いた入力は、保存先が決まらないのでエラーにする（ボタンなど、入力でない要素は置いてよい）。
- 同じ部品を 2 回使うときは、それぞれを別の `ObjectScope` で包めば name が衝突しない。
- MDX の `props.values` には、その MDX が置かれたスコープの値が入る。上の例では、`Contact.mdx` の中の `props.values` は `values.applicant`（または `values.emergency`）になる。

### 2.3 保存と確認

- 入力すると自動で保存する。
- 書き換えるのはフロントマターの `values` と `labels` だけで、本文は変更しない。
- 値は JSON で表せるもの（文字列、数値、真偽値、null、配列、オブジェクト）に限る。
- 開いているファイルが外部（エージェントなど）で変更されたら、読み直して描画し直す（§5.2）。
- 本文から消えた入力の値も、削除せずに残す。
- エージェントは、ドキュメントのフロントマターを直接読んで入力値とラベルを確認する。

---

## 3. ラベル

ドキュメントに付ける属性（状態、優先度など）。項目はファイルごとに決めるのではなく、スキーマで定義する。ユーザーはビューワーでラベルを設定する。

### 3.1 スキーマ

`vite.config.ts` の `mdxi()` プラグインの `labels` に書く。

```ts
mdxi({
  labels: {
    status: {
      type: "select",
      options: ["open", "answered", "done"],
      default: "open",
      description: "answered になったら、エージェントは回答を読んで作業を進める",
    },
    tags: {
      type: "multiselect",
      options: ["frontend", "backend"],
    },
    memo: {
      type: "text",
    },
  },
})
```

| フィールド | 内容 |
|---|---|
| `type` | `select`（値は 1 つ）、`multiselect`（値は配列）、`text`（自由入力の文字列） |
| `options` | 選択肢（`select` と `multiselect` で使う） |
| `default` | 未設定のときの値 |
| `description` | ラベルの意味。エージェントへの説明を兼ねる |

### 3.2 規則

- 値はフロントマターの `labels.<key>` に保存する。
- スキーマにない項目や、選択肢にない値がファイルにあっても、削除しない。`mdxi check` で警告する。

---

## 4. コンポーネント

### 4.1 標準コンポーネント（`mdxi/components`）

| コンポーネント | 値 | 主な props |
|---|---|---|
| `TextInput` | string | `name`, `label`, `placeholder`, `multiline` |
| `NumberInput` | number | `name`, `label`, `min`, `max`, `step` |
| `Select` | string（`multiple` なら string[]） | `name`, `label`, `options`, `multiple` |
| `Checkbox` | boolean | `name`, `label` |
| `ObjectScope` | — | `name`（§2.2） |
| `ArrayScope`, `ArrayScope.Item` | — | `name` / `index`（§2.2） |

全コンポーネント共通で `default`（未入力時の値）を指定できる。それ以外の部品（表示用のコンポーネントなど）は提供しない。必要なものはユーザーが作る。

### 4.2 コンポーネントを作る（`mdxi`）

拡張用の API は `useValue`（`mdxi`）と、スコープ（`ObjectScope` / `ArrayScope`、§2.2）だけ。

```ts
useValue<T>(name: string, defaultValue?: T): [T, (value: T) => void]
```

- 普通の React コンポーネントの中で `useValue` を使えば、入力コンポーネントになる。標準コンポーネントも、この API で作られている。
- `useValue` は、今のスコープの下の `name` を読み書きする。

```tsx
// src/components/Rating.tsx
import { useValue } from "mdxi";

export function Rating({ name, max = 5 }: { name: string; max?: number }) {
  const [value, setValue] = useValue(name, 0);
  return (
    <div>
      {Array.from({ length: max }, (_, i) => (
        <button key={i} onClick={() => setValue(i + 1)}>{i < value ? "★" : "☆"}</button>
      ))}
    </div>
  );
}
```

値はどんな JSON でもよい。行を追加できるリストは、`useValue` で配列を読み書きし、`ArrayScope` と `ArrayScope.Item` で各行のスコープを作れば作れる。行の中には、標準コンポーネントなど他の入力コンポーネントをそのまま置ける。

```tsx
import { useValue } from "mdxi";
import { ArrayScope, TextInput } from "mdxi/components";

export function MemberList({ name }: { name: string }) {
  const [rows, setRows] = useValue<object[]>(name, []);

  return (
    <ArrayScope name={name}>
      {rows.map((_, i) => (
        <ArrayScope.Item index={i} key={i}>
          <TextInput name="name" label="名前" />
          <TextInput name="role" label="役割" />
          <button onClick={() => setRows(rows.filter((_, j) => j !== i))}>削除</button>
        </ArrayScope.Item>
      ))}
      <button onClick={() => setRows([...rows, {}])}>追加</button>
    </ArrayScope>
  );
}
```

```yaml
values:
  members:
    - { name: 佐藤, role: dev }
    - { name: 鈴木, role: pm }
```

作ったコンポーネントは、プロジェクトの中に置いて import するか、npm パッケージにして配布する。npm パッケージにする場合は、`mdxi` と `react` を `peerDependencies` にする。

---

## 5. ビューワー

`mdxi` プラグインが、Vite の dev server にビューワーの画面を追加する。

### 5.1 画面

- 画面の左にドキュメントのディレクトリのファイルツリー、右に選んだドキュメントを表示する。ドキュメントの上部にはラベルを表示する。
- ファイルツリーは、ドキュメントのディレクトリの中のファイルの追加・削除・名前の変更をすぐに反映する。
- 各ドキュメントは `http://localhost:<port>/<docs からのパス>` で開ける（例: `/2026-11/lunch.mdx`）。
- エラー（コンパイルエラー、import の解決エラー、実行時エラー、name の重複）は、その場所にエラーとして表示する。

### 5.2 値の保存と HMR

入力やラベルの変更は、dev server の API を通してファイルのフロントマターに書き込む。そのままだと、書き込むたびに Vite がファイルの変更を検知して HMR が走り、ドキュメントが描画し直される（入力中のフォーカスが外れるなど）。そこで、プラグインで次のように扱う。

- MDX のコンパイル結果にはフロントマターを含めない。フロントマターは、プラグインが別に読んでページに渡す。
- ファイルが変更されたら、プラグインは前回の内容と比べる。
  - 本文が変わっていた → 通常どおり HMR で描画し直す。
  - フロントマター（`values` / `labels`）だけが変わっていた → HMR は走らせない。新しい `values` / `labels` だけをページに送り、ページは状態を更新する。
- ビューワー自身が書き込んだ変更も、エージェントなどが外部で書き換えた変更も、同じように扱う。

書き込みの API が受け付けるのは、ドキュメントのディレクトリの中の `.mdx` の `values` と `labels` の変更だけ。

---

## 6. CLI

`mdxi check [file...]` で、ドキュメントを検査する。ファイルを指定しなければドキュメントのディレクトリの中のすべてのドキュメントを検査する。

- 検査する内容: コンパイル、import の解決、name の重複、ラベルの値
- `vite.config.ts` を読み込んで、dev server と同じ設定で検査する。
- 問題があれば内容を出力して、終了コード 1 で終わる。

---

## 7. Skill

Skill はテンプレート（§8）に含め、プロジェクトの `.claude/skills/mdxi/SKILL.md` に置く。プロジェクトでエージェントを起動すれば、そのまま使われる。Claude Code 以外のエージェントを使う場合は、そのエージェントが読む場所に移す。

プロジェクトの中にあるので、ユーザーは自分のコンポーネントやラベルの使い方を書き足して育ててよい。

`SKILL.md` は、ディレクトリ名・パッケージマネージャー・エイリアスなどの **変更できる部分を決め打ちしない**。テンプレートの既定値は例として書くだけにして、実際の値はプロジェクトの設定から調べる手順を書く。

| 知りたいこと | 調べ方 |
|---|---|
| ドキュメントを置くディレクトリ | `vite.config.ts` の `mdxi()` の `docs`（省略時は `docs`） |
| ラベルの項目と意味 | `vite.config.ts` の `mdxi()` の `labels`（`description` に意味が書かれている） |
| 使えるカスタムコンポーネント | `package.json` の `dependencies`、tsconfig の `paths` が指す場所、既存のドキュメントの import |
| import のエイリアス | tsconfig の `paths` |
| dev server の起動方法 | `package.json` の `scripts`（`vite` を実行しているもの）と、lockfile から判断するパッケージマネージャー |
| ドキュメントの URL | dev server が表示するアドレス + ドキュメントのディレクトリからのパス |

`SKILL.md` には次の内容を書く。

- ドキュメントの書き方（§1〜§4 の要約と、例）
- 標準コンポーネントの一覧
- 上の表の調べ方。設定が見つからないときや、読み取れないとき（設定が動的に作られている場合など）は、ユーザーに確認すること
- ドキュメントは、調べたドキュメントのディレクトリの中に作ること
- 作成後に `mdxi check <file>` を実行すること。dev server が動いていなければ起動して、ドキュメントの URL をユーザーに伝えること
- ユーザーの入力とラベルは、ドキュメントのフロントマターを読んで確認すること。エージェントは `values` と `labels` を書き換えないこと
- ユーザーが書き足した内容（プロジェクト固有のコンポーネントやラベルの使い方）があれば、それを優先すること

---

## 8. テンプレート

`npm create mdxi <dir>`（npm パッケージ `create-mdxi`）で、プロジェクトのテンプレートを作る。pnpm / yarn / bun の `create` でも同じように使える。

```
<dir>/
├── .claude/skills/mdxi/
│   └── SKILL.md            # エージェント向けの Skill（§7）
├── package.json
├── vite.config.ts          # mdxi プラグイン。labels に status のサンプル
├── tsconfig.json           # paths で @/* → src/*
├── src/components/
│   ├── Rating.tsx          # useValue を使った入力コンポーネントのサンプル
│   └── Contact.mdx         # MDX の部品のサンプル
└── docs/
    └── welcome.mdx         # 標準コンポーネント、Rating、Contact、ObjectScope、条件表示を使ったサンプル
```

- `<dir>` がすでにあって空でない場合は、何もせずにエラーで終わる。
- 依存パッケージのインストールはしない。作成後に、実行するコマンド（`cd <dir>`、`npm install`、`npm run dev`）を表示する。
