import { defineConfig } from "vite";
import mdxi from "mdxi/vite";

export default defineConfig({
  plugins: [
    mdxi({
      docs: "docs",
      labels: {
        status: {
          type: "select",
          options: ["open", "answered", "done"],
          default: "open",
          description: "open: ユーザーの回答待ち。answered: ユーザーが回答した（エージェントは values を読んで作業を進める）。done: 完了",
        },
      },
    }),
  ],
});
