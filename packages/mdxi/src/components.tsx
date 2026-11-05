import { useId, type ReactNode } from "react";
import { ArrayScope, ObjectScope, useField } from "./runtime/context";

export { ArrayScope, ObjectScope };
export type { ScopeProps, ItemProps } from "./runtime/context";

interface BaseProps<T> {
  name: string;
  label?: ReactNode;
  default?: T;
}

function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label?: ReactNode;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="mdxi-field" data-error={error ? "" : undefined}>
      {label != null && (
        <label className="mdxi-label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error && (
        <div className="mdxi-field-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

export interface TextInputProps extends BaseProps<string> {
  placeholder?: string;
  multiline?: boolean;
}

export function TextInput({ name, label, placeholder, multiline, default: def }: TextInputProps) {
  const { value, setValue, error } = useField<string>(name, def);
  const id = useId();
  const common = {
    id,
    name,
    placeholder,
    value: typeof value === "string" ? value : value == null ? "" : String(value),
    onChange: (e: { target: { value: string } }) => setValue(e.target.value),
    "aria-invalid": error ? true : undefined,
  };
  return (
    <Field label={label} error={error} htmlFor={id}>
      {multiline ? (
        <textarea className="mdxi-input mdxi-textarea" rows={4} {...common} />
      ) : (
        <input className="mdxi-input" type="text" {...common} />
      )}
    </Field>
  );
}

export interface NumberInputProps extends BaseProps<number> {
  min?: number;
  max?: number;
  step?: number;
}

export function NumberInput({ name, label, min, max, step, default: def }: NumberInputProps) {
  const { value, setValue, error } = useField<number | null>(name, def);
  const id = useId();
  return (
    <Field label={label} error={error} htmlFor={id}>
      <input
        id={id}
        className="mdxi-input"
        type="number"
        name={name}
        min={min}
        max={max}
        step={step}
        value={typeof value === "number" ? value : ""}
        onChange={(e) => setValue(e.target.value === "" ? null : e.target.valueAsNumber)}
        aria-invalid={error ? true : undefined}
      />
    </Field>
  );
}

export type SelectOption = string | { value: string; label?: ReactNode };

export interface SelectProps extends BaseProps<string | string[]> {
  options: SelectOption[];
  multiple?: boolean;
}

function normalize(option: SelectOption) {
  return typeof option === "string" ? { value: option, label: option } : { value: option.value, label: option.label ?? option.value };
}

export function Select({ name, label, options, multiple, default: def }: SelectProps) {
  const { value, setValue, error } = useField<string | string[] | null>(name, def);
  const id = useId();
  const items = options.map(normalize);

  if (multiple) {
    const selected = Array.isArray(value) ? value : [];
    return (
      <Field label={label} error={error}>
        <div className="mdxi-options" role="group">
          {items.map((item) => (
            <label key={item.value} className="mdxi-option">
              <input
                type="checkbox"
                checked={selected.includes(item.value)}
                onChange={(e) =>
                  setValue(
                    e.target.checked
                      ? items.map((i) => i.value).filter((v) => v === item.value || selected.includes(v))
                      : selected.filter((v) => v !== item.value),
                  )
                }
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </Field>
    );
  }

  const current = typeof value === "string" ? value : "";
  return (
    <Field label={label} error={error} htmlFor={id}>
      <select
        id={id}
        className="mdxi-input mdxi-select"
        name={name}
        value={current}
        onChange={(e) => setValue(e.target.value === "" ? null : e.target.value)}
        aria-invalid={error ? true : undefined}
      >
        <option value="">選択してください</option>
        {current !== "" && !items.some((i) => i.value === current) && <option value={current}>{current}</option>}
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {typeof item.label === "string" ? item.label : item.value}
          </option>
        ))}
      </select>
    </Field>
  );
}

export interface CheckboxProps extends BaseProps<boolean> {}

export function Checkbox({ name, label, default: def }: CheckboxProps) {
  const { value, setValue, error } = useField<boolean>(name, def);
  return (
    <Field error={error}>
      <label className="mdxi-option">
        <input type="checkbox" name={name} checked={value === true} onChange={(e) => setValue(e.target.checked)} />
        {label != null && <span>{label}</span>}
      </label>
    </Field>
  );
}

export interface ShowProps {
  when: unknown;
  children?: ReactNode;
}

/** Renders its children only while `when` is truthy. Children can be Markdown. */
export function Show({ when, children }: ShowProps) {
  return when ? <>{children}</> : null;
}
