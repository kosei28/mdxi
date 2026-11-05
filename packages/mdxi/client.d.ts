// Types for `.mdx` imports. Add "mdxi-kit/client" to "types" in tsconfig.json.
declare module "*.mdx" {
  import type { ComponentType } from "react";
  const MDXContent: ComponentType<Record<string, unknown>>;
  export default MDXContent;
}
