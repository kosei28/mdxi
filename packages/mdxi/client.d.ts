// Types for `.mdx` imports. Add "mdxi/client" to "types" in tsconfig.json.
declare module "*.mdx" {
  import type { ComponentType } from "react";
  const MDXContent: ComponentType<Record<string, unknown>>;
  export default MDXContent;
}
