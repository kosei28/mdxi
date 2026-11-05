import { StrictMode, useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type MouseEvent } from "react";
import { createRoot } from "react-dom/client";
import { DocProvider, useSnapshot, useStore } from "../runtime/context";
import { DocStore, type Labels, type LabelsSchema, type Values } from "../runtime/store";
import { Boundary, ErrorBox } from "../internal";
import { styles } from "./styles";

export interface ViewerConfig {
  labels: LabelsSchema;
}

export function mount(element: HTMLElement | null, config: ViewerConfig) {
  if (!element) throw new Error("mdxi: root element not found");
  const style = document.createElement("style");
  style.textContent = styles;
  document.head.appendChild(style);
  createRoot(element).render(
    <StrictMode>
      <App config={config} />
    </StrictMode>,
  );
}

const hot = import.meta.hot;

function useHotEvent<T>(event: string, handler: (data: T) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!hot) return;
    const listener = (data: T) => ref.current(data);
    hot.on(event, listener);
    return () => hot.off?.(event, listener);
  }, [event]);
}

function currentPath() {
  return decodeURIComponent(location.pathname.replace(/^\/+/, ""));
}

function href(path: string) {
  return "/" + path.split("/").map(encodeURIComponent).join("/");
}

function App({ config }: { config: ViewerConfig }) {
  const [path, setPath] = useState(currentPath);
  const [files, setFiles] = useState<string[] | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const loadTree = useCallback(() => {
    fetch("/__mdxi/tree")
      .then((res) => res.json())
      .then((data) => setFiles(data.files));
  }, []);
  useEffect(loadTree, [loadTree]);
  useHotEvent("mdxi:tree", loadTree);

  useEffect(() => {
    const onPop = () => setPath(currentPath());
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    document.title = path ? `${path} – mdxi` : "mdxi";
  }, [path]);

  const navigate = (next: string) => (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    history.pushState(null, "", href(next));
    setPath(next);
    setMenuOpen(false);
  };

  return (
    <div className="mdxi-app" data-menu={menuOpen ? "open" : undefined}>
      <nav className="mdxi-sidebar">
        <div className="mdxi-brand">
          <a href="/" onClick={navigate("")}>
            mdxi
          </a>
          <button type="button" className="mdxi-menu" aria-label="ファイル一覧" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            <span />
          </button>
        </div>
        {files && <Tree files={files} current={path} navigate={navigate} />}
        {files?.length === 0 && <div className="mdxi-tree-empty">まだありません</div>}
      </nav>
      <main className="mdxi-main">
        {path && path.endsWith(".mdx") ? (
          files && !files.includes(path) ? (
            <div className="mdxi-doc">
              <ErrorBox title="ドキュメントが見つかりません" error={path} />
            </div>
          ) : (
            <DocView path={path} schema={config.labels} />
          )
        ) : (
          <div className="mdxi-empty">ドキュメントを選んでください</div>
        )}
      </main>
    </div>
  );
}

interface TreeNode {
  name: string;
  path?: string;
  children: Map<string, TreeNode>;
}

function buildTree(files: string[]): TreeNode {
  const root: TreeNode = { name: "", children: new Map() };
  for (const file of files) {
    const parts = file.split("/");
    let node = root;
    parts.forEach((part, i) => {
      let child = node.children.get(part);
      if (!child) node.children.set(part, (child = { name: part, children: new Map() }));
      if (i === parts.length - 1) child.path = file;
      node = child;
    });
  }
  return root;
}

function Tree({ files, current, navigate }: { files: string[]; current: string; navigate: (path: string) => (event: MouseEvent) => void }) {
  const root = useMemo(() => buildTree(files), [files]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (dir: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(dir)) next.add(dir);
      return next;
    });
  const render = (node: TreeNode, prefix: string) => {
    const children = [...node.children.values()].sort((a, b) => Number(!!a.path) - Number(!!b.path) || a.name.localeCompare(b.name));
    return (
      <ul>
        {children.map((child) => {
          if (child.path)
            return (
              <li key={child.name}>
                <a href={href(child.path)} onClick={navigate(child.path)} aria-current={child.path === current ? "page" : undefined}>
                  {child.name}
                </a>
              </li>
            );
          const dir = prefix + child.name;
          const open = !collapsed.has(dir);
          return (
            <li key={child.name}>
              <button type="button" className="mdxi-tree-dir" aria-expanded={open} onClick={() => toggle(dir)}>
                {child.name}
              </button>
              {open && render(child, dir + "/")}
            </li>
          );
        })}
      </ul>
    );
  };
  return <div className="mdxi-tree">{render(root, "")}</div>;
}

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

/** Saves changes made in the viewer, debounced. */
class Saver {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inflight = 0;
  private latest: { values: Values; labels: Labels } | null = null;

  constructor(
    private path: string,
    private onState: (state: SaveState) => void,
  ) {}

  get pending() {
    return this.timer !== undefined || this.inflight > 0;
  }

  schedule(data: { values: Values; labels: Labels }) {
    this.latest = data;
    clearTimeout(this.timer);
    this.onState({ kind: "saving" });
    this.timer = setTimeout(() => this.flush(), 300);
  }

  flush() {
    clearTimeout(this.timer);
    this.timer = undefined;
    const data = this.latest;
    if (!data) return;
    this.latest = null;
    this.inflight++;
    fetch("/__mdxi/doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: this.path, ...data }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? res.statusText);
        if (this.timer === undefined && this.inflight === 1) this.onState({ kind: "saved" });
      })
      .catch((error: Error) => this.onState({ kind: "error", message: error.message }))
      .finally(() => this.inflight--);
  }
}

type Loaded =
  | { status: "loading" }
  | { status: "error"; path: string; title: string; error: unknown }
  | { status: "ready"; path: string; Content: ComponentType; store: DocStore; saver: Saver; frontmatterError?: string };

function DocView({ path, schema }: { path: string; schema: LabelsSchema }) {
  const [state, setState] = useState<Loaded>({ status: "loading" });
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/__mdxi/doc?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (!res.ok) throw Object.assign(new Error(data.error), { title: "ドキュメントを開けません" });
      let mod: { default: ComponentType };
      try {
        mod = await import(/* @vite-ignore */ data.url);
      } catch (error) {
        throw Object.assign(new Error(await importError(path, error)), { title: "コンパイルまたは import の解決に失敗しました" });
      }
      const saver = new Saver(path, setSave);
      const store = new DocStore({
        values: data.values,
        labels: data.labels,
        schema,
        onChange: (next) => saver.schedule(next),
      });
      if (cancelled) return;
      // Swap in one render so the previous document stays on screen while this one loads.
      setSave({ kind: "idle" });
      setState({ status: "ready", path, Content: mod.default, store, saver, frontmatterError: data.error });
    })().catch((error) => {
      if (!cancelled) setState({ status: "error", path, title: error.title ?? "エラー", error });
    });
    return () => {
      cancelled = true;
    };
  }, [path, schema]);

  useEffect(() => {
    if (state.status !== "ready") return;
    const flush = () => state.saver.flush();
    addEventListener("pagehide", flush);
    return () => {
      removeEventListener("pagehide", flush);
      flush();
    };
  }, [state]);

  // The file changed on disk (an agent, an editor, or our own save).
  useHotEvent<{ path: string; values?: Values; labels?: Labels; error?: string }>("mdxi:data", (data) => {
    if (state.status !== "ready" || data.path !== state.path) return;
    if (data.error) {
      setState({ ...state, frontmatterError: data.error });
      return;
    }
    if (state.frontmatterError) setState({ ...state, frontmatterError: undefined });
    if (state.saver.pending) return; // our newer changes win
    state.store.replace(data.values, data.labels);
    setVersion((v) => v + 1);
  });

  if (state.status === "loading") return null;
  if (state.status === "error")
    return (
      <div className="mdxi-doc">
        <ErrorBox title={state.title} error={state.error} />
      </div>
    );

  const { Content, store } = state;
  return (
    <DocProvider store={store}>
      <div className="mdxi-page">
        <article className="mdxi-doc">
          {state.frontmatterError && <ErrorBox title="フロントマターを読めません" error={state.frontmatterError} />}
          <Duplicates />
          <Boundary resetKey={`${state.path}:${version}`}>
            <Content />
          </Boundary>
        </article>
        <LabelsBar schema={schema} />
      </div>
      <div className="mdxi-status" data-kind={save.kind} aria-live="polite">
        {save.kind === "saving" ? "保存中…" : save.kind === "saved" ? "保存しました" : save.kind === "error" ? `保存できませんでした: ${save.message}` : ""}
      </div>
    </DocProvider>
  );
}

async function importError(path: string, error: unknown): Promise<string> {
  // The browser only says "failed to fetch"; ask the dev server for the real message.
  try {
    const res = await fetch(`/__mdxi/diagnose?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    if (data.error) return data.error;
  } catch {
    // ignore
  }
  return error instanceof Error ? error.message : String(error);
}

function Duplicates() {
  const { duplicates } = useSnapshot();
  if (duplicates.size === 0) return null;
  const names = [...duplicates].map((key) => (JSON.parse(key) as (string | number)[]).map((k) => (typeof k === "number" ? `[${k}]` : k)).join("."));
  return <ErrorBox title="name が重複しています（重複している値は保存されません）" error={names.join("\n")} />;
}

function LabelsBar({ schema }: { schema: LabelsSchema }) {
  const store = useStore();
  const { labels, storedLabels } = useSnapshot();
  const unknown = Object.keys(storedLabels).filter((key) => !(key in schema));
  if (Object.keys(schema).length === 0 && unknown.length === 0) return null;
  return (
    <aside className="mdxi-labels">
      {Object.entries(schema).map(([key, def]) => {
        const value = labels[key];
        const title = def.description;
        if (def.type === "select") {
          const options = def.options ?? [];
          const current = typeof value === "string" ? value : "";
          return (
            <label key={key} className="mdxi-labels-item" title={title}>
              <span className="mdxi-labels-key">{key}</span>
              <select className="mdxi-input" value={current} onChange={(e) => store.setLabel(key, e.target.value === "" ? null : e.target.value)}>
                <option value="">—</option>
                {current !== "" && !options.includes(current) && <option value={current}>{current}</option>}
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          );
        }
        if (def.type === "multiselect") {
          const selected = Array.isArray(value) ? (value as string[]) : [];
          const options = [...(def.options ?? []), ...selected.filter((v) => !(def.options ?? []).includes(v))];
          return (
            <div key={key} className="mdxi-labels-item" title={title}>
              <span className="mdxi-labels-key">{key}</span>
              <div className="mdxi-chips">
                {options.map((option) => {
                  const on = selected.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      className="mdxi-chip"
                      aria-pressed={on}
                      onClick={() =>
                        store.setLabel(key, on ? selected.filter((v) => v !== option) : options.filter((o) => o === option || selected.includes(o)))
                      }
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }
        return (
          <label key={key} className="mdxi-labels-item" title={title}>
            <span className="mdxi-labels-key">{key}</span>
            <input className="mdxi-input" type="text" value={typeof value === "string" ? value : ""} onChange={(e) => store.setLabel(key, e.target.value)} />
          </label>
        );
      })}
      {unknown.map((key) => (
        <span key={key} className="mdxi-labels-item mdxi-labels-unknown" title="スキーマにない項目">
          <span className="mdxi-labels-key">{key}</span>
          {JSON.stringify(storedLabels[key])}
        </span>
      ))}
    </aside>
  );
}
