import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { formatPath, getIn, pathKey, type Key, type Path } from "./path";
import { DocStore, type Labels, type Values } from "./store";

const fallbackStore = new DocStore();
const StoreContext = createContext<DocStore>(fallbackStore);

export type ScopeKind = "root" | "object" | "array" | "item";
export interface Scope {
  path: Path;
  kind: ScopeKind;
}
const ScopeContext = createContext<Scope>({ path: [], kind: "root" });

export function DocProvider({ store, children }: { store: DocStore; children?: ReactNode }) {
  return (
    <StoreContext.Provider value={store}>
      <ScopeContext.Provider value={ROOT}>{children}</ScopeContext.Provider>
    </StoreContext.Provider>
  );
}
const ROOT: Scope = { path: [], kind: "root" };

export function useStore() {
  return useContext(StoreContext);
}

export function useSnapshot() {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export function useScope() {
  return useContext(ScopeContext);
}

export class MdxiError extends Error {
  override name = "MdxiError";
}

/** Path of `name` in the current scope. Throws where no input may be placed. */
function useChildPath(name: Key, what: string): Path {
  const scope = useScope();
  if (scope.kind === "array") {
    throw new MdxiError(
      `${what} "${name}" は ArrayScope "${formatPath(scope.path)}" の中で ArrayScope.Item の外に置かれています。保存先が決まらないので、ArrayScope.Item の中に置いてください。`,
    );
  }
  const key = pathKey([...scope.path, name]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => [...scope.path, name], [key]);
}

function useDefault(path: Path, defaultValue: unknown) {
  const store = useStore();
  const id = useId();
  const key = pathKey(path);
  const json = defaultValue === undefined ? undefined : JSON.stringify(defaultValue);
  useEffect(
    () => store.registerDefault(path, json === undefined ? undefined : JSON.parse(json), id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, key, json, id],
  );
}

export interface Field<T> {
  value: T;
  setValue: (value: T) => void;
  /** Set while another mounted input uses the same path. The value is not saved then. */
  error?: string;
}

/**
 * Read and write the value `name` in the current scope.
 * Any React component that calls it becomes an input component.
 */
export function useField<T = unknown>(name: string, defaultValue?: T): Field<T> {
  const store = useStore();
  const path = useChildPath(name, "入力");
  const key = pathKey(path);
  const id = useId();
  useEffect(() => store.registerField(path, id), [store, key, id]); // eslint-disable-line react-hooks/exhaustive-deps
  useDefault(path, defaultValue);
  const snapshot = useSnapshot();
  const stored = getIn(snapshot.values, path);
  const value = (stored === undefined ? defaultValue : stored) as T;
  const setValue = useCallback((next: T) => store.setValue(path, next), [store, path]);
  const error = snapshot.duplicates.has(key)
    ? `name "${formatPath(path)}" の入力が複数あります。保存先が重なるので、この値は保存されません。`
    : undefined;
  return { value, setValue, error };
}

export interface ScopeProps {
  name: string;
  default?: unknown;
  children?: ReactNode;
}

export function ObjectScope({ name, default: defaultValue, children }: ScopeProps) {
  const path = useChildPath(name, "ObjectScope");
  useDefault(path, defaultValue);
  const scope = useMemo<Scope>(() => ({ path, kind: "object" }), [path]);
  return <ScopeContext.Provider value={scope}>{children}</ScopeContext.Provider>;
}

function ArrayScopeImpl({ name, default: defaultValue, children }: ScopeProps) {
  const path = useChildPath(name, "ArrayScope");
  useDefault(path, defaultValue);
  const scope = useMemo<Scope>(() => ({ path, kind: "array" }), [path]);
  return <ScopeContext.Provider value={scope}>{children}</ScopeContext.Provider>;
}

export interface ItemProps {
  index: number;
  children?: ReactNode;
}

function Item({ index, children }: ItemProps) {
  const parent = useScope();
  if (parent.kind !== "array") {
    throw new MdxiError("ArrayScope.Item は ArrayScope の中に置いてください。");
  }
  if (!Number.isInteger(index) || index < 0) {
    throw new MdxiError(`ArrayScope.Item の index は 0 以上の整数にしてください（${String(index)}）。`);
  }
  const key = pathKey([...parent.path, index]);
  const scope = useMemo<Scope>(() => ({ path: [...parent.path, index], kind: "item" }), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <ScopeContext.Provider value={scope}>{children}</ScopeContext.Provider>;
}

export const ArrayScope = Object.assign(ArrayScopeImpl, { Item });

/** Values of the current scope (what an MDX file receives as `props.values`). */
export function useScopeValues(): Values {
  const scope = useScope();
  const snapshot = useSnapshot();
  const value = getIn(snapshot.values, scope.path);
  return value !== null && typeof value === "object" ? (value as Values) : EMPTY;
}
const EMPTY: Values = Object.freeze({}) as Values;

export function useLabels(): Labels {
  return useSnapshot().labels;
}
