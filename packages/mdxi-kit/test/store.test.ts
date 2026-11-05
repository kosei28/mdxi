import { describe, expect, it, vi } from "vitest";
import { DocStore } from "../src/runtime/store";
import { setIn } from "../src/runtime/path";

describe("setIn", () => {
  it("creates arrays for numeric keys and objects otherwise", () => {
    expect(setIn({}, ["members", 1, "name"], "a")).toEqual({ members: [null, { name: "a" }] });
    expect(setIn({ a: { b: 1 } }, ["a", "c"], 2)).toEqual({ a: { b: 1, c: 2 } });
  });
});

describe("DocStore", () => {
  it("keeps values not touched and reports changes", () => {
    const onChange = vi.fn();
    const store = new DocStore({ values: { orphan: 1 }, onChange });
    store.setValue(["food"], "中華");
    expect(store.getSnapshot().stored).toEqual({ orphan: 1, food: "中華" });
    expect(onChange).toHaveBeenCalledWith({ values: { orphan: 1, food: "中華" }, labels: {} });
  });

  it("fills defaults without storing them", () => {
    const store = new DocStore({ values: { a: { x: 1 } } });
    store.registerDefault(["a", "y"], 2, "1");
    store.registerDefault(["b"], "z", "2");
    expect(store.getSnapshot().values).toEqual({ a: { x: 1, y: 2 }, b: "z" });
    expect(store.getSnapshot().stored).toEqual({ a: { x: 1 } });
  });

  it("does not save a path used by two inputs", () => {
    const onChange = vi.fn();
    const store = new DocStore({ onChange });
    const off1 = store.registerField(["x"], "1");
    store.registerField(["x"], "2");
    expect(store.getSnapshot().duplicates.has('["x"]')).toBe(true);
    store.setValue(["x"], 1);
    expect(onChange).not.toHaveBeenCalled();
    off1();
    expect(store.getSnapshot().duplicates.size).toBe(0);
    store.setValue(["x"], 1);
    expect(onChange).toHaveBeenCalled();
  });

  it("applies label defaults from the schema", () => {
    const store = new DocStore({ schema: { status: { type: "select", options: ["open"], default: "open" } } });
    expect(store.getSnapshot().labels).toEqual({ status: "open" });
    expect(store.getSnapshot().storedLabels).toEqual({});
  });
});
