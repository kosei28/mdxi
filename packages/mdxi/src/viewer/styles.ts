export const styles = `
:root {
  --mdxi-bg: #fff;
  --mdxi-fg: #1f2328;
  --mdxi-muted: #656d76;
  --mdxi-border: #d0d7de;
  --mdxi-sidebar: #f6f8fa;
  --mdxi-accent: #0969da;
  --mdxi-accent-bg: #ddf4ff;
  --mdxi-danger: #cf222e;
  --mdxi-danger-bg: #ffebe9;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root {
    --mdxi-bg: #0d1117;
    --mdxi-fg: #e6edf3;
    --mdxi-muted: #8d96a0;
    --mdxi-border: #30363d;
    --mdxi-sidebar: #010409;
    --mdxi-accent: #4493f8;
    --mdxi-accent-bg: #121d2f;
    --mdxi-danger: #f85149;
    --mdxi-danger-bg: #25171c;
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body {
  background: var(--mdxi-bg);
  color: var(--mdxi-fg);
  font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif;
}
#mdxi-root { height: 100%; }
.mdxi-app { display: grid; grid-template-columns: 260px 1fr; height: 100%; }
.mdxi-sidebar { background: var(--mdxi-sidebar); border-right: 1px solid var(--mdxi-border); overflow: auto; padding: 12px 8px; font-size: 14px; }
.mdxi-sidebar-title { font-weight: 600; padding: 4px 8px 8px; color: var(--mdxi-muted); }
.mdxi-tree, .mdxi-tree ul { list-style: none; margin: 0; padding: 0; }
.mdxi-tree ul { padding-left: 14px; }
.mdxi-tree-dir { padding: 2px 8px; color: var(--mdxi-muted); }
.mdxi-tree a { display: block; padding: 2px 8px; border-radius: 6px; color: inherit; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mdxi-tree a:hover { background: var(--mdxi-border); }
.mdxi-tree a[aria-current="page"] { background: var(--mdxi-accent-bg); color: var(--mdxi-accent); font-weight: 600; }
.mdxi-main { overflow: auto; }
.mdxi-labels { display: flex; flex-wrap: wrap; gap: 8px 20px; align-items: center; padding: 10px 32px; border-bottom: 1px solid var(--mdxi-border); font-size: 13px; position: sticky; top: 0; background: var(--mdxi-bg); z-index: 1; }
.mdxi-labels:empty { display: none; }
.mdxi-labels-item { display: flex; gap: 6px; align-items: center; }
.mdxi-labels-key { color: var(--mdxi-muted); }
.mdxi-labels-item .mdxi-input { width: auto; padding: 2px 6px; font-size: 13px; }
.mdxi-labels-unknown { color: var(--mdxi-muted); font-style: italic; }
.mdxi-chip { border: 1px solid var(--mdxi-border); background: none; color: inherit; border-radius: 999px; padding: 0 8px; font: inherit; cursor: pointer; }
.mdxi-chip[aria-pressed="true"] { background: var(--mdxi-accent-bg); border-color: var(--mdxi-accent); color: var(--mdxi-accent); }
.mdxi-doc { max-width: 820px; padding: 24px 32px 80px; }
.mdxi-doc a { color: var(--mdxi-accent); }
.mdxi-doc code { font: 0.9em ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--mdxi-sidebar); padding: 0.1em 0.35em; border-radius: 4px; }
.mdxi-doc pre code { padding: 0; background: none; }
.mdxi-doc pre { background: var(--mdxi-sidebar); padding: 12px; border-radius: 6px; overflow: auto; }
.mdxi-doc table { border-collapse: collapse; }
.mdxi-doc th, .mdxi-doc td { border: 1px solid var(--mdxi-border); padding: 4px 10px; }
.mdxi-empty { color: var(--mdxi-muted); padding: 32px; }
.mdxi-status { position: fixed; right: 12px; bottom: 10px; font-size: 12px; color: var(--mdxi-muted); }
.mdxi-field { margin: 12px 0; }
.mdxi-label { display: block; font-weight: 600; margin-bottom: 4px; }
.mdxi-input { width: 100%; max-width: 480px; padding: 6px 10px; border: 1px solid var(--mdxi-border); border-radius: 6px; background: var(--mdxi-bg); color: inherit; font: inherit; }
.mdxi-input:focus { outline: 2px solid var(--mdxi-accent); outline-offset: -1px; }
.mdxi-textarea { max-width: 100%; resize: vertical; }
.mdxi-options { display: flex; flex-wrap: wrap; gap: 4px 16px; }
.mdxi-option { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; }
.mdxi-field[data-error] .mdxi-input { border-color: var(--mdxi-danger); }
.mdxi-field-error { color: var(--mdxi-danger); font-size: 13px; margin-top: 4px; }
.mdxi-error { border: 1px solid var(--mdxi-danger); background: var(--mdxi-danger-bg); color: var(--mdxi-danger); border-radius: 6px; padding: 8px 12px; margin: 12px 0; }
.mdxi-error-title { font-weight: 600; }
.mdxi-error-message { margin: 0; white-space: pre-wrap; font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; background: none !important; padding: 0 !important; }
@media (max-width: 720px) {
  .mdxi-app { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
  .mdxi-sidebar { max-height: 30vh; border-right: none; border-bottom: 1px solid var(--mdxi-border); }
  .mdxi-doc, .mdxi-labels { padding-left: 16px; padding-right: 16px; }
}
`;
