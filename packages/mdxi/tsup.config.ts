import { defineConfig } from "tsup";

export default defineConfig([
  {
    // Browser side. Shared modules (store, scope contexts) are split into a
    // common chunk so every entry uses the same React contexts.
    entry: {
      index: "src/index.ts",
      components: "src/components.tsx",
      internal: "src/internal.tsx",
      viewer: "src/viewer/index.tsx",
    },
    format: "esm",
    platform: "browser",
    target: "es2022",
    splitting: true,
    dts: true,
    clean: false,
    external: ["react", "react-dom", "react/jsx-runtime"],
  },
  {
    // Node side.
    entry: {
      vite: "src/node/vite.ts",
      cli: "src/node/cli.ts",
    },
    format: "esm",
    platform: "node",
    target: "node20",
    splitting: true,
    dts: { entry: { vite: "src/node/vite.ts" } },
    clean: false,
    external: ["vite"],
  },
]);
