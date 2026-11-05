export const styles = `
:root {
  --mdxi-bg: #eaf4fc;
  --mdxi-island: #ffffff;
  --mdxi-fg: #2b3a4a;
  --mdxi-muted: #7f93a8;
  --mdxi-soft: #f1f7fd;
  --mdxi-hover: #dcecf9;
  --mdxi-accent: #3d9be9;
  --mdxi-accent-fg: #2479c4;
  --mdxi-accent-bg: #d6eafb;
  --mdxi-danger: #e5677a;
  --mdxi-danger-fg: #c2415a;
  --mdxi-danger-bg: #fdecef;
  --mdxi-shadow: 0 1px 2px rgba(61, 120, 180, 0.06), 0 8px 24px rgba(61, 120, 180, 0.07);
  --mdxi-radius: 22px;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root {
    --mdxi-bg: #121c27;
    --mdxi-island: #1a2734;
    --mdxi-fg: #dde8f3;
    --mdxi-muted: #8297ad;
    --mdxi-soft: #223243;
    --mdxi-hover: #253749;
    --mdxi-accent: #6bb6f5;
    --mdxi-accent-fg: #8cc7f8;
    --mdxi-accent-bg: #23415d;
    --mdxi-danger: #f08a9a;
    --mdxi-danger-fg: #f6a6b3;
    --mdxi-danger-bg: #3a2530;
    --mdxi-shadow: none;
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body {
  background: var(--mdxi-bg);
  color: var(--mdxi-fg);
  font: 15px/1.75 ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", "Zen Maru Gothic", "M PLUS Rounded 1c", -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans JP", sans-serif;
  -webkit-font-smoothing: antialiased;
}
#mdxi-root { height: 100%; }
button { font: inherit; color: inherit; }
::selection { background: var(--mdxi-accent-bg); }

.mdxi-app { display: grid; grid-template-columns: 240px minmax(0, 1fr); height: 100%; }

/* sidebar */
.mdxi-sidebar { overflow: auto; padding: 20px 12px 24px 16px; font-size: 14px; }
.mdxi-brand { display: flex; align-items: center; justify-content: space-between; padding: 0 10px 14px; }
.mdxi-brand a { font-size: 20px; font-weight: 800; letter-spacing: 0.02em; color: var(--mdxi-accent-fg); text-decoration: none; }
.mdxi-menu { display: none; }
.mdxi-tree, .mdxi-tree ul { list-style: none; margin: 0; padding: 0; }
.mdxi-tree ul ul { padding-left: 14px; }
.mdxi-tree a, .mdxi-tree-dir {
  display: flex; align-items: center; gap: 6px; width: 100%;
  padding: 5px 10px; border-radius: 12px; border: 0; background: none;
  color: inherit; text-align: left; text-decoration: none; cursor: pointer;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  transition: background-color 0.15s;
}
.mdxi-tree a:hover, .mdxi-tree-dir:hover { background: var(--mdxi-hover); }
.mdxi-tree a[aria-current="page"] { background: var(--mdxi-island); color: var(--mdxi-accent-fg); box-shadow: var(--mdxi-shadow); }
.mdxi-tree-dir { font-weight: 600; }
.mdxi-tree-dir::before { color: var(--mdxi-muted); }
.mdxi-tree-dir::before {
  content: ""; flex: none; width: 6px; height: 6px; margin: 0 2px;
  border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; border-radius: 1px;
  transform: rotate(45deg) translate(-1px, -1px); transition: transform 0.15s;
}
.mdxi-tree-dir[aria-expanded="false"]::before { transform: rotate(-45deg); }
.mdxi-tree-empty { padding: 5px 10px; color: var(--mdxi-muted); }

/* main */
.mdxi-main { overflow: auto; }
/* the document is centered in the viewport when there is room: (viewport - doc) / 2 - sidebar */
.mdxi-page { display: flex; align-items: flex-start; gap: 16px; padding: 16px 16px 16px max(0px, calc((100vw - 860px) / 2 - 240px)); }
.mdxi-doc, .mdxi-labels { background: var(--mdxi-island); border-radius: var(--mdxi-radius); box-shadow: var(--mdxi-shadow); }
.mdxi-doc { flex: 1; min-width: 0; max-width: 860px; padding: 32px 44px 56px; }
.mdxi-labels {
  position: sticky; top: 16px; flex: none; width: 220px;
  display: flex; flex-direction: column; gap: 14px; padding: 18px; font-size: 13px;
}
.mdxi-labels-item { display: flex; flex-direction: column; gap: 6px; }
.mdxi-labels-key { color: var(--mdxi-muted); font-weight: 700; padding-left: 4px; }
.mdxi-labels-item .mdxi-input { max-width: none; padding: 6px 12px; font-size: 13px; }
.mdxi-labels-unknown { color: var(--mdxi-muted); }
.mdxi-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.mdxi-chip {
  border: 0; background: var(--mdxi-soft); color: inherit; border-radius: 999px;
  padding: 3px 12px; cursor: pointer; transition: background-color 0.15s, color 0.15s;
}
.mdxi-chip[aria-pressed="true"] { background: var(--mdxi-accent-bg); color: var(--mdxi-accent-fg); font-weight: 700; }
.mdxi-empty { display: grid; place-items: center; min-height: 100%; color: var(--mdxi-muted); }
.mdxi-status {
  position: fixed; right: 20px; bottom: 16px; padding: 4px 14px; border-radius: 999px;
  background: var(--mdxi-island); box-shadow: var(--mdxi-shadow); color: var(--mdxi-muted); font-size: 12px;
  transition: opacity 0.2s;
}
.mdxi-status:empty { opacity: 0; pointer-events: none; }
.mdxi-status[data-kind="error"] { background: var(--mdxi-danger-bg); color: var(--mdxi-danger-fg); }

/* document content */
.mdxi-doc > :first-child { margin-top: 0; }
.mdxi-doc h1 { font-size: 1.75em; line-height: 1.35; margin: 0 0 0.8em; }
.mdxi-doc h2 { font-size: 1.3em; margin: 2em 0 0.6em; }
.mdxi-doc h3 { font-size: 1.1em; margin: 1.6em 0 0.5em; }
.mdxi-doc a { color: var(--mdxi-accent-fg); text-underline-offset: 3px; }
.mdxi-doc hr { border: 0; height: 6px; margin: 2em 0; background: radial-gradient(circle, var(--mdxi-accent-bg) 3px, transparent 3.5px) center / 18px 6px repeat-x; }
.mdxi-doc blockquote { margin: 1em 0; padding: 10px 18px; border-radius: 16px; background: var(--mdxi-soft); color: var(--mdxi-muted); }
.mdxi-doc blockquote > :first-child { margin-top: 0; }
.mdxi-doc blockquote > :last-child { margin-bottom: 0; }
.mdxi-doc code { font: 0.88em ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--mdxi-soft); padding: 0.15em 0.45em; border-radius: 6px; }
.mdxi-doc pre { background: var(--mdxi-soft); padding: 14px 18px; border-radius: 16px; overflow: auto; }
.mdxi-doc pre code { padding: 0; background: none; }
.mdxi-doc table { border-collapse: separate; border-spacing: 0; border-radius: 14px; overflow: hidden; background: var(--mdxi-soft); }
.mdxi-doc th, .mdxi-doc td { padding: 6px 14px; text-align: left; }
.mdxi-doc th { background: var(--mdxi-accent-bg); }
.mdxi-doc tr:nth-child(even) td { background: var(--mdxi-hover); }
.mdxi-doc img { max-width: 100%; border-radius: 14px; }

/* inputs */
.mdxi-field { margin: 18px 0; }
.mdxi-label { display: block; font-weight: 700; margin: 0 0 6px 4px; }
.mdxi-input {
  width: 100%; max-width: 480px; padding: 9px 14px; border: 0; border-radius: 14px;
  background: var(--mdxi-soft); color: inherit; font: inherit;
  transition: background-color 0.15s, box-shadow 0.15s;
}
.mdxi-input:focus { outline: none; background-color: var(--mdxi-island); box-shadow: 0 0 0 3px var(--mdxi-accent-bg), 0 0 0 1.5px var(--mdxi-accent) inset; }
.mdxi-input::placeholder { color: var(--mdxi-muted); opacity: 0.8; }
select.mdxi-input {
  appearance: none; padding-right: 36px; cursor: pointer;
  background-image: linear-gradient(45deg, transparent 50%, var(--mdxi-muted) 50%), linear-gradient(135deg, var(--mdxi-muted) 50%, transparent 50%);
  background-position: right 18px center, right 13px center; background-size: 5px 5px; background-repeat: no-repeat;
}
.mdxi-textarea { display: block; resize: vertical; }
.mdxi-options { display: flex; flex-wrap: wrap; gap: 8px; }
.mdxi-option {
  display: inline-flex; gap: 8px; align-items: center; cursor: pointer;
  padding: 6px 14px 6px 10px; border-radius: 999px; background: var(--mdxi-soft);
  transition: background-color 0.15s;
}
.mdxi-option:has(input:checked) { background: var(--mdxi-accent-bg); color: var(--mdxi-accent-fg); }
.mdxi-doc input[type="checkbox"], .mdxi-doc input[type="radio"] { accent-color: var(--mdxi-accent); width: 16px; height: 16px; margin: 0; }
.mdxi-field[data-error] .mdxi-input { background-color: var(--mdxi-danger-bg); box-shadow: 0 0 0 1.5px var(--mdxi-danger) inset; }
.mdxi-field-error { color: var(--mdxi-danger-fg); font-size: 13px; margin: 6px 0 0 4px; }

/* errors */
.mdxi-error { background: var(--mdxi-danger-bg); color: var(--mdxi-danger-fg); border-radius: 16px; padding: 12px 18px; margin: 16px 0; }
.mdxi-error-title { font-weight: 700; }
.mdxi-error-message { margin: 4px 0 0; white-space: pre-wrap; font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; background: none !important; padding: 0 !important; overflow: auto; }

/* responsive */
@media (max-width: 1100px) {
  .mdxi-page { flex-direction: column-reverse; align-items: stretch; gap: 12px; }
  .mdxi-doc { max-width: none; }
  .mdxi-labels { position: static; width: auto; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 10px 20px; padding: 12px 18px; }
  .mdxi-labels-item { flex-direction: row; align-items: center; gap: 8px; }
  .mdxi-labels-key { padding-left: 0; }
  .mdxi-labels-item .mdxi-input { width: auto; }
}
@media (max-width: 720px) {
  .mdxi-app { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }
  .mdxi-sidebar { padding: 12px 12px 0; overflow: visible; position: relative; z-index: 2; }
  .mdxi-brand { padding: 0 6px; }
  .mdxi-menu {
    display: grid; place-items: center; width: 38px; height: 38px; border: 0; border-radius: 12px;
    background: var(--mdxi-island); box-shadow: var(--mdxi-shadow); cursor: pointer;
  }
  .mdxi-menu span, .mdxi-menu span::before, .mdxi-menu span::after {
    display: block; width: 16px; height: 2px; border-radius: 2px; background: var(--mdxi-fg); transition: transform 0.2s, background-color 0.2s;
  }
  .mdxi-menu span { position: relative; }
  .mdxi-menu span::before, .mdxi-menu span::after { content: ""; position: absolute; left: 0; }
  .mdxi-menu span::before { top: -5px; }
  .mdxi-menu span::after { top: 5px; }
  .mdxi-app[data-menu="open"] .mdxi-menu span { background: transparent; }
  .mdxi-app[data-menu="open"] .mdxi-menu span::before { transform: translateY(5px) rotate(45deg); }
  .mdxi-app[data-menu="open"] .mdxi-menu span::after { transform: translateY(-5px) rotate(-45deg); }
  .mdxi-tree, .mdxi-tree-empty {
    display: none; position: absolute; left: 12px; right: 12px; top: calc(100% + 8px);
    max-height: 60vh; overflow: auto; padding: 10px; border-radius: 18px;
    background: var(--mdxi-island); box-shadow: 0 12px 40px rgba(40, 90, 140, 0.18);
  }
  .mdxi-app[data-menu="open"] .mdxi-tree, .mdxi-app[data-menu="open"] .mdxi-tree-empty { display: block; }
  .mdxi-tree a[aria-current="page"] { background: var(--mdxi-accent-bg); box-shadow: none; }
  .mdxi-page { padding: 12px; }
  .mdxi-doc { padding: 22px 20px 40px; border-radius: 18px; }
  .mdxi-labels { border-radius: 18px; padding: 10px 14px; }
}
`;
