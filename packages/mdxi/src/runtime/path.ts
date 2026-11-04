export type Key = string | number;
export type Path = readonly Key[];

export function getIn(obj: unknown, path: Path): unknown {
  let cur = obj;
  for (const key of path) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<Key, unknown>)[key];
  }
  return cur;
}

/** Immutable set. Missing containers are created (arrays for numeric keys). */
export function setIn(obj: unknown, path: Path, value: unknown): unknown {
  if (path.length === 0) return value;
  const [key, ...rest] = path;
  const base =
    obj !== null && typeof obj === "object"
      ? obj
      : typeof key === "number"
        ? []
        : {};
  const child = setIn((base as Record<Key, unknown>)[key], rest, value);
  if (Array.isArray(base)) {
    const copy = base.slice();
    copy[key as number] = child;
    // Fill holes so the array stays valid JSON.
    for (let i = 0; i < copy.length; i++) if (!(i in copy)) copy[i] = null;
    return copy;
  }
  return { ...(base as object), [key]: child };
}

export function pathKey(path: Path): string {
  return JSON.stringify(path);
}

export function formatPath(path: Path): string {
  let out = "";
  for (const key of path) {
    out += typeof key === "number" ? `[${key}]` : out ? `.${key}` : key;
  }
  return out;
}
