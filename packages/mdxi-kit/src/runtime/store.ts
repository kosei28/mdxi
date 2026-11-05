import { getIn, pathKey, setIn, type Path } from "./path";

export type Values = Record<string, unknown>;
export type Labels = Record<string, unknown>;

export interface LabelSchema {
  type: "select" | "multiselect" | "text";
  options?: string[];
  default?: unknown;
  description?: string;
}
export type LabelsSchema = Record<string, LabelSchema>;

export interface Snapshot {
  /** Values as stored in the file. */
  stored: Values;
  /** Stored values with the defaults of the mounted inputs filled in. */
  values: Values;
  /** Stored labels with the schema defaults filled in. */
  labels: Labels;
  storedLabels: Labels;
  /** Paths (pathKey) used by more than one mounted input. */
  duplicates: ReadonlySet<string>;
}

export interface StoreOptions {
  values?: Values;
  labels?: Labels;
  schema?: LabelsSchema;
  /** Called after a change made through the store (not after `replace`). */
  onChange?: (data: { values: Values; labels: Labels }) => void;
}

export class DocStore {
  private stored: Values;
  private storedLabels: Labels;
  private schema: LabelsSchema;
  private onChange?: StoreOptions["onChange"];
  private listeners = new Set<() => void>();
  private defaults = new Map<string, { path: Path; value: unknown; ids: Set<string> }>();
  private fields = new Map<string, Set<string>>();
  private snapshot: Snapshot;

  constructor(options: StoreOptions = {}) {
    this.stored = asObject(options.values);
    this.storedLabels = asObject(options.labels);
    this.schema = options.schema ?? {};
    this.onChange = options.onChange;
    this.snapshot = this.build();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  /** Set a value. Ignored while the path is used by more than one input. */
  setValue(path: Path, value: unknown) {
    if (this.snapshot.duplicates.has(pathKey(path))) return;
    this.stored = setIn(this.stored, path, toJson(value)) as Values;
    this.emit(true);
  }

  setLabel(key: string, value: unknown) {
    this.storedLabels = { ...this.storedLabels, [key]: toJson(value) };
    this.emit(true);
  }

  /** Replace everything with data read from the file (external change). */
  replace(values: unknown, labels: unknown) {
    this.stored = asObject(values);
    this.storedLabels = asObject(labels);
    this.emit(false);
  }

  setSchema(schema: LabelsSchema) {
    this.schema = schema;
    this.emit(false);
  }

  /** Register a mounted input. Returns the cleanup function. */
  registerField(path: Path, id: string) {
    const key = pathKey(path);
    let ids = this.fields.get(key);
    if (!ids) this.fields.set(key, (ids = new Set()));
    ids.add(id);
    if (ids.size === 2) this.emit(false);
    return () => {
      ids.delete(id);
      if (ids.size === 0) this.fields.delete(key);
      if (ids.size === 1) this.emit(false);
    };
  }

  /** Register the default value of a mounted input or scope. */
  registerDefault(path: Path, value: unknown, id: string) {
    if (value === undefined) return () => {};
    const key = pathKey(path);
    let entry = this.defaults.get(key);
    if (!entry) this.defaults.set(key, (entry = { path, value, ids: new Set() }));
    entry.value = value;
    entry.ids.add(id);
    this.emit(false);
    return () => {
      entry.ids.delete(id);
      if (entry.ids.size === 0) this.defaults.delete(key);
      this.emit(false);
    };
  }

  private emit(changed: boolean) {
    this.snapshot = this.build();
    for (const listener of this.listeners) listener();
    if (changed) this.onChange?.({ values: this.stored, labels: this.storedLabels });
  }

  private build(): Snapshot {
    let values: unknown = this.stored;
    // Shorter paths first so nested defaults win over a parent's default.
    const entries = [...this.defaults.values()].sort((a, b) => a.path.length - b.path.length);
    for (const { path, value } of entries) {
      if (getIn(values, path) === undefined) values = setIn(values, path, value);
    }
    const labels: Labels = { ...this.storedLabels };
    for (const [key, schema] of Object.entries(this.schema)) {
      if (labels[key] === undefined && schema.default !== undefined) labels[key] = schema.default;
    }
    const duplicates = new Set<string>();
    for (const [key, ids] of this.fields) if (ids.size > 1) duplicates.add(key);
    return {
      stored: this.stored,
      values: values as Values,
      labels,
      storedLabels: this.storedLabels,
      duplicates,
    };
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Values must be JSON. `undefined` becomes null, other values go through JSON. */
function toJson(value: unknown): unknown {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}
