import { useField } from "mdxi-kit";

export function Rating({ name, max = 5 }: { name: string; max?: number }) {
  const { value, setValue, error } = useField(name, 0);
  return (
    <div style={{ fontSize: 24 }}>
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => setValue(i + 1)}
          style={{ border: "none", background: "none", cursor: "pointer", color: "#e3a008", fontSize: "inherit" }}
          aria-label={`${i + 1}`}
        >
          {i < value ? "★" : "☆"}
        </button>
      ))}
      {error && <p style={{ color: "#cf222e", fontSize: 13 }}>{error}</p>}
    </div>
  );
}
