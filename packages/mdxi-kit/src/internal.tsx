import { Component, type ComponentType, type ErrorInfo, type ReactNode } from "react";
import { useLabels, useScopeValues } from "./runtime/context";

export { DocStore } from "./runtime/store";
export type { LabelSchema, LabelsSchema, Labels, Values, Snapshot } from "./runtime/store";
export { DocProvider, useSnapshot, useStore, MdxiError } from "./runtime/context";
export { formatPath, getIn, setIn } from "./runtime/path";

/**
 * Wraps the default export of every compiled `.mdx` file so that
 * `props.values` is the value of the scope the document is placed in.
 */
export function withMdxiProps<P extends object>(Content: ComponentType<P>) {
  function MdxiContent(props: P) {
    const values = useScopeValues();
    const labels = useLabels();
    return <Content {...props} values={values} labels={labels} />;
  }
  MdxiContent.displayName = "MdxiContent";
  return MdxiContent;
}

interface BoundaryState {
  error: unknown;
}

/** Shows an error in place of the part of the document that failed. */
export class Boundary extends Component<{ children?: ReactNode | (() => ReactNode); resetKey?: unknown }, BoundaryState> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error };
  }

  override componentDidUpdate(prev: { resetKey?: unknown }) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  override render() {
    if (this.state.error) return <ErrorBox error={this.state.error} />;
    const { children } = this.props;
    return typeof children === "function" ? <Lazy render={children} /> : children;
  }
}

/** Evaluates the children inside the boundary. */
function Lazy({ render }: { render: () => ReactNode }) {
  return <>{render()}</>;
}

export function ErrorBox({ error, title }: { error: unknown; title?: string }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="mdxi-error" role="alert">
      {title && <div className="mdxi-error-title">{title}</div>}
      <pre className="mdxi-error-message">{message}</pre>
    </div>
  );
}
