#!/usr/bin/env node
/**
 * Builds a single self-contained HTML file with the real verifier bundled.
 * Open demo/kyvera-standalone.html in any modern browser. No install, relay or
 * network required.
 */
import { build } from "esbuild";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

const result = await build({
  entryPoints: [`${root}demo/standalone.ts`],
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  minify: true,
  external: ["ws"],
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});

const script = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>KYVERA — standalone identity continuity demo</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0a0a08; color: #f1ecdf; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
  a { color: #f1ecdf; }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 0 22px; }
  header { border-bottom: 1px solid rgba(241,236,223,.12); }
  .bar { height: 66px; display: flex; align-items: center; justify-content: space-between; }
  .brand { display: flex; gap: 12px; align-items: center; letter-spacing: .26em; font-weight: 600; font-size: 14px; }
  .brand svg { width: 24px; height: 24px; }
  .brand small { display: block; letter-spacing: .18em; font-size: 8px; color: #8f8a7d; margin-top: 3px; font-weight: 400; }
  .micro { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9px; text-transform: uppercase; letter-spacing: .16em; color: #8f8a7d; }
  .dim { color: #8f8a7d; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .hero { padding: 54px 0 38px; display: grid; gap: 38px; grid-template-columns: 1.05fr .95fr; align-items: end; }
  h1 { font-family: "Iowan Old Style", Palatino, Georgia, serif; font-weight: 400; font-size: clamp(38px, 6vw, 66px); line-height: .98; letter-spacing: -.035em; margin: 14px 0 0; }
  h1 em { color: #f05a28; font-style: normal; }
  h2 { font-family: "Iowan Old Style", Palatino, Georgia, serif; font-weight: 400; font-size: 29px; line-height: 1.1; letter-spacing: -.02em; margin: 10px 0 0; }
  h3 { font-family: ui-monospace, Menlo, monospace; font-size: 9px; letter-spacing: .16em; text-transform: uppercase; color: #8f8a7d; margin: 24px 0 8px; font-weight: 500; }
  p { color: #d8d1c2; font-size: 13px; line-height: 1.65; }
  .lede { max-width: 540px; }
  .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
  .chip { border: 1px solid rgba(241,236,223,.18); padding: 6px 9px; font-family: ui-monospace, Menlo, monospace; font-size: 8.5px; letter-spacing: .1em; text-transform: uppercase; }
  .chip.green { border-color: rgba(94,156,130,.55); color: #86bca4; }
  .chip.orange { border-color: rgba(240,90,40,.6); color: #ff7040; }
  button { font: inherit; cursor: pointer; }
  .run { background: #f05a28; border: 0; color: #0a0a08; padding: 11px 16px; font-size: 12px; font-weight: 600; }
  .run:disabled { opacity: .6; cursor: wait; }
  .ghost { background: transparent; border: 1px solid rgba(241,236,223,.22); color: #f1ecdf; padding: 9px 12px; font-size: 11px; }
  .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; border-top: 1px solid rgba(241,236,223,.1); border-bottom: 1px solid rgba(241,236,223,.1); padding: 10px 0; margin: 26px 0; }
  .lifecycle { display: flex; align-items: stretch; gap: 0; margin: 18px 0 8px; }
  .life-node { border: 1px solid rgba(241,236,223,.14); padding: 12px; width: 31%; min-width: 0; }
  .life-node.live { border-color: rgba(94,156,130,.5); background: rgba(94,156,130,.04); }
  .life-node.dead { border-color: rgba(194,91,78,.45); }
  .connector { width: 3.5%; border-top: 1px solid rgba(241,236,223,.25); margin-top: 44px; }
  .node-status { font-family: ui-monospace, Menlo, monospace; font-size: 11px; letter-spacing: .14em; margin: 8px 0 6px; }
  .address { font-size: 9px; word-break: break-all; color: #d8d1c2; min-height: 24px; }
  .grid { display: grid; grid-template-columns: 320px 1fr; gap: 24px; margin: 26px 0 50px; }
  .scenarios { display: flex; flex-direction: column; gap: 7px; }
  .scenario { text-align: left; background: rgba(15,15,12,.45); border: 1px solid rgba(241,236,223,.13); padding: 12px; color: #f1ecdf; }
  .scenario:hover { border-color: rgba(241,236,223,.32); }
  .scenario.active { border-color: rgba(240,90,40,.65); background: rgba(240,90,40,.04); }
  .scenario-top { display: flex; justify-content: space-between; }
  .scenario-title { font-size: 12.5px; margin-top: 7px; }
  .scenario-q { font-size: 10.5px; line-height: 1.5; color: #8f8a7d; margin-top: 3px; }
  .verdict { border: 1px solid rgba(241,236,223,.2); padding: 3px 6px; font-family: ui-monospace, Menlo, monospace; font-size: 8px; letter-spacing: .12em; text-transform: uppercase; }
  .verdict.ok { border-color: rgba(94,156,130,.6); color: #86bca4; }
  .verdict.warn { border-color: rgba(240,90,40,.6); color: #ff7040; }
  .verdict.bad { border-color: rgba(194,91,78,.6); color: #e5a49c; }
  .verdict.muted { color: #d8d1c2; }
  .detail { border: 1px solid rgba(241,236,223,.14); background: rgba(15,15,12,.5); padding: 20px; min-width: 0; }
  .detail-head { display: flex; justify-content: space-between; gap: 10px; }
  .question { font-size: 12px; color: #8f8a7d; margin: 4px 0 0; }
  .headline { border-left: 2px solid #f05a28; padding-left: 10px; font-family: ui-monospace, Menlo, monospace; font-size: 11px; letter-spacing: .08em; margin-top: 18px; }
  .checks { list-style: none; padding: 0; margin: 0; }
  .checks li { display: flex; gap: 9px; border-bottom: 1px solid rgba(241,236,223,.07); padding: 8px 0; font-size: 11.5px; }
  .checks li:last-child { border-bottom: 0; }
  .checks .micro { font-size: 8.5px; letter-spacing: .05em; text-transform: none; margin-top: 3px; word-break: break-all; }
  .tick { width: 14px; height: 14px; border: 1px solid rgba(94,156,130,.6); display: inline-flex; align-items: center; justify-content: center; font-size: 8px; flex: 0 0 auto; margin-top: 1px; color: #86bca4; }
  .tick.no { border-color: rgba(194,91,78,.6); color: #e5a49c; }
  .foot { display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid rgba(241,236,223,.1); margin-top: 18px; padding-top: 10px; }
  pre { background: #070706; border: 1px solid rgba(241,236,223,.1); padding: 12px; overflow: auto; max-height: 360px; font-family: ui-monospace, Menlo, monospace; font-size: 9px; line-height: 1.55; color: #b7b1a4; }
  footer { border-top: 1px solid rgba(241,236,223,.12); padding: 24px 0 40px; display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; font-size: 10px; color: #8f8a7d; }
  @media (max-width: 800px) {
    .hero, .grid { grid-template-columns: 1fr; }
    .lifecycle { flex-direction: column; }
    .life-node { width: 100%; }
    .connector { width: 100%; height: 16px; border-top: 0; border-left: 1px solid rgba(241,236,223,.25); margin: 0 0 0 18px; }
  }
</style>
</head>
<body>
<header><div class="wrap bar">
  <div class="brand">
    <svg viewBox="0 0 26 26" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="23" height="23" stroke="#f1ecdf"/><circle cx="13" cy="10.5" r="3.2" stroke="#f1ecdf"/><path d="M13 13.7v6.1M10.3 17h5.4" stroke="#f1ecdf"/></svg>
    <div>KYVERA<small>Identity continuity</small></div>
  </div>
  <div class="micro">Standalone verifier · no install</div>
</div></header>

<main class="wrap">
  <section class="hero">
    <div>
      <div class="micro" style="color:#f05a28">BCH Blaze 2026 · Paytaca identity bounty</div>
      <h1>Keys change.<br/>Trust shouldn’t<br/><em>disappear.</em></h1>
      <p class="lede">Explore identity continuity.</p>
      <p class="micro dim">Deterministic fixtures · verified locally</p>
    </div>
    <div>
      <div class="micro">Lifecycle</div>
      <div class="lifecycle" id="lifecycle"></div>
      <div class="micro dim" style="margin-top:10px">ACTIVE is asserted only when the chain is valid and a current address exists.</div>
    </div>
  </section>

  <div class="toolbar">
    <div class="micro" id="status">Loading verifier…</div>
    <div style="display:flex;gap:8px">
      <button class="ghost" id="advanced">Advanced mode</button>
      <button class="run" id="run">Re-run verification</button>
    </div>
  </div>

  <div class="grid">
    <div class="scenarios" id="scenarios"></div>
    <div class="detail" id="detail"></div>
  </div>
</main>

<footer class="wrap">
  <div>KYVERA / Identity continuity protocol</div>
  <div>Limits: no recovery, no absolute rollback protection, no production audit. <a href="https://github.com/sakethdonepudi/kyvera-protocol">Source</a></div>
</footer>

<script type="module">${script}</script>
</body>
</html>`;

const out = `${root}demo/kyvera-standalone.html`;
const publicOut = `${root}apps/web/public/kyvera-standalone.html`;
writeFileSync(out, html);
writeFileSync(publicOut, html);
console.log(`wrote ${out} and ${publicOut} (${(html.length / 1024).toFixed(0)} KB)`);
