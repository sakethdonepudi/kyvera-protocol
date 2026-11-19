#!/usr/bin/env node
/**
 * Renders the cinematic title and transition cards used by the V5 film.
 * Output: .context/film-v5/cards/*.png at 1920×1080.
 */
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const OUT = ".context/film-v5/cards";
mkdirSync(OUT, { recursive: true });
const logo = readFileSync("apps/web/public/brand/kyvera-primary-logo.png").toString("base64");
const logoSrc = `data:image/png;base64,${logo}`;

const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1920px; height: 1080px; background: #07090c; color: #f6f5f1; }
  body {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    background:
      radial-gradient(1100px 700px at 78% -10%, rgba(242,138,84,.16), transparent 62%),
      radial-gradient(900px 600px at 4% 20%, rgba(143,217,190,.09), transparent 64%),
      radial-gradient(700px 500px at 55% 108%, rgba(168,217,240,.06), transparent 68%),
      #07090c;
    overflow: hidden;
    position: relative;
  }
  body::after {
    content: "";
    position: absolute; inset: 0;
    background-image:
      linear-gradient(to right, rgba(246,245,241,.035) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(246,245,241,.035) 1px, transparent 1px);
    background-size: 96px 96px;
    mask-image: radial-gradient(ellipse at center, black, transparent 82%);
    pointer-events: none;
  }
  .frame { position: relative; z-index: 2; width: 100%; height: 100%; padding: 92px 120px; display: flex; flex-direction: column; }
  .eyebrow { font-family: ui-monospace, Menlo, monospace; font-size: 16px; letter-spacing: .18em; text-transform: uppercase; color: #f28a54; }
  .eyebrow.dim { color: #8e9497; }
  h1 { font-family: "Iowan Old Style", Palatino, Georgia, serif; font-weight: 400; line-height: .98; letter-spacing: -.025em; }
  .accent { color: #f28a54; }
  .muted { color: #9da1a2; }
  .glass {
    background: linear-gradient(150deg, rgba(255,255,255,.075), rgba(255,255,255,.022));
    border: 1px solid rgba(255,255,255,.12);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.1), 0 30px 90px -50px rgba(0,0,0,.9);
    backdrop-filter: blur(24px) saturate(1.35);
    border-radius: 26px;
  }
  .logo { display: block; object-fit: contain; border-radius: 18px; }
  .footer { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; font-family: ui-monospace, Menlo, monospace; font-size: 14px; letter-spacing: .12em; text-transform: uppercase; color: #6f7477; }
`;

const cards = {
  opening: `
    <div class="frame" style="align-items:center; justify-content:center; text-align:center;">
      <img class="logo" src="${logoSrc}" style="width:520px; margin-bottom:76px;" />
      <h1 style="font-size:112px; max-width:1400px;">Identity should outlast<br/>its <span class="accent">keys.</span></h1>
      <div style="margin-top:44px; font-family:ui-monospace,Menlo,monospace; font-size:15px; letter-spacing:.2em; text-transform:uppercase; color:#9da1a2;">Bitcoin Cash × Nostr</div>
    </div>`,

  binding: `
    <div class="frame">
      <div class="eyebrow">01 / Cryptographic binding</div>
      <h1 style="font-size:92px; margin-top:36px; max-width:1500px;">Two keys.<br/>One verified <span class="accent">relationship.</span></h1>
      <div style="display:flex; gap:28px; margin-top:74px; align-items:stretch;">
        <div class="glass" style="flex:1; padding:42px 46px;">
          <div style="font-family:ui-monospace,Menlo,monospace; font-size:13px; letter-spacing:.16em; text-transform:uppercase; color:#8e9497;">Bitcoin Cash wallet</div>
          <div style="font-family:ui-monospace,Menlo,monospace; font-size:26px; margin-top:18px; color:#f6f5f1;">signmessage proof</div>
          <div style="font-size:18px; color:#9da1a2; margin-top:14px;">The current wallet authorizes the transition.</div>
        </div>
        <div style="display:flex; align-items:center; font-size:44px; color:#f28a54; padding:0 6px;">→</div>
        <div class="glass" style="flex:1; padding:42px 46px;">
          <div style="font-family:ui-monospace,Menlo,monospace; font-size:13px; letter-spacing:.16em; text-transform:uppercase; color:#8e9497;">Nostr identity</div>
          <div style="font-family:ui-monospace,Menlo,monospace; font-size:26px; margin-top:18px; color:#f6f5f1;">Schnorr signature</div>
          <div style="font-size:18px; color:#9da1a2; margin-top:14px;">The identity key signs the canonical record.</div>
        </div>
      </div>
      <div class="glass" style="margin-top:36px; padding:26px 34px; display:flex; align-items:center; gap:18px; border-color:rgba(143,217,190,.3);">
        <span style="width:12px; height:12px; border-radius:999px; background:#8fd9be; box-shadow:0 0 18px rgba(143,217,190,.5);"></span>
        <span style="font-family:ui-monospace,Menlo,monospace; font-size:15px; letter-spacing:.12em; text-transform:uppercase; color:#b4ebd7;">Verified binding</span>
        <span style="font-size:17px; color:#9da1a2; margin-left:auto;">Neither private key leaves its owner.</span>
      </div>
    </div>`,

  discovery: `
    <div class="frame">
      <div class="eyebrow">02 / Public discovery</div>
      <h1 style="font-size:92px; margin-top:36px; max-width:1500px;">Discoverable.<br/>Independently <span class="accent">verifiable.</span></h1>
      <div class="glass" style="margin-top:66px; padding:32px 38px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:22px;">
          <div style="font-family:ui-monospace,Menlo,monospace; font-size:13px; letter-spacing:.16em; text-transform:uppercase; color:#8e9497;">Public relay evidence</div>
          <div style="font-family:ui-monospace,Menlo,monospace; font-size:13px; letter-spacing:.12em; text-transform:uppercase; color:#b4ebd7;">FULL · 2 / 2 relays</div>
        </div>
        <div style="display:flex; justify-content:space-between; padding:18px 0; border-top:1px solid rgba(255,255,255,.09);">
          <span style="font-family:ui-monospace,Menlo,monospace; font-size:20px;">wss://nos.lol</span>
          <span style="font-family:ui-monospace,Menlo,monospace; font-size:16px; color:#9da1a2;">7 events · EOSE</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:18px 0; border-top:1px solid rgba(255,255,255,.09);">
          <span style="font-family:ui-monospace,Menlo,monospace; font-size:20px;">wss://relay.primal.net</span>
          <span style="font-family:ui-monospace,Menlo,monospace; font-size:16px; color:#9da1a2;">7 events · EOSE</span>
        </div>
      </div>
      <div style="display:flex; gap:34px; margin-top:42px; font-size:20px; color:#9da1a2;">
        <span>bind → rotate → revoke</span>
        <span style="color:#f28a54;">forged rotation rejected</span>
        <span>short-lived retention observed</span>
      </div>
      <div class="footer"><span>Recorded from KYVERA v5.0.1</span><span>Two independent relays</span></div>
    </div>`,

  lifecycle: `
    <div class="frame">
      <div class="eyebrow">03 / Identity continuity</div>
      <h1 style="font-size:96px; margin-top:36px; max-width:1600px;">Historical proof is not<br/>current <span class="accent">authorization.</span></h1>
      <div style="display:flex; gap:30px; margin-top:76px;">
        <div class="glass" style="flex:1; padding:46px;">
          <div style="font-family:ui-monospace,Menlo,monospace; font-size:13px; letter-spacing:.16em; text-transform:uppercase; color:#8e9497;">Historical validity</div>
          <div style="font-family:'Iowan Old Style',Palatino,Georgia,serif; font-size:38px; margin-top:20px;">Wallet A's proof<br/>remains valid.</div>
          <div style="font-size:18px; color:#9da1a2; margin-top:22px;">The signatures, digest and authorization at sequence #0 are still true.</div>
        </div>
        <div class="glass" style="flex:1; padding:46px; border-color:rgba(242,138,84,.28);">
          <div style="font-family:ui-monospace,Menlo,monospace; font-size:13px; letter-spacing:.16em; text-transform:uppercase; color:#8e9497;">Current authorization</div>
          <div style="font-family:'Iowan Old Style',Palatino,Georgia,serif; font-size:38px; margin-top:20px;">Wallet B is the<br/>current destination.</div>
          <div style="font-size:18px; color:#9da1a2; margin-top:22px;">Rotation moves the head. Revocation ends it. Neither rewrites history.</div>
        </div>
      </div>
    </div>`,


  "rp-terminal": `
    <div class="frame">
      <div class="eyebrow">04 / Independent interoperability</div>
      <h1 style="font-size:84px; margin-top:34px;">A relying party<br/>outside <span class="accent">KYVERA.</span></h1>
      <div class="glass" style="margin-top:52px; padding:34px 40px; font-family:ui-monospace,Menlo,monospace; font-size:19px; line-height:1.9;">
        <div style="color:#8e9497;">$ pnpm rp:demo</div>
        <div style="color:#b4ebd7;">PASS  genesis binding resolves ACTIVE</div>
        <div style="color:#b4ebd7;">PASS  single-use challenge authenticates</div>
        <div style="color:#b4ebd7;">PASS  replay is rejected</div>
        <div style="color:#b4ebd7;">PASS  authorized rotation moves to wallet B</div>
        <div style="color:#b4ebd7;">PASS  session is invalidated after rotation</div>
        <div style="color:#b4ebd7;">PASS  revocation terminates the chain</div>
        <div style="color:#f28a54; margin-top:12px;">13/13 checks passed</div>
        <div style="color:#9da1a2; font-size:15px; margin-top:8px;">No KYVERA website, API or relay.</div>
      </div>
    </div>`,
  closing: `
    <div class="frame" style="align-items:center; justify-content:center; text-align:center;">
      <img class="logo" src="${logoSrc}" style="width:600px; margin-bottom:64px;" />
      <h1 style="font-size:74px; max-width:1500px;">Keys change.<br/>Trust shouldn't <span class="accent">disappear.</span></h1>
      <div style="margin-top:54px; font-family:ui-monospace,Menlo,monospace; font-size:17px; letter-spacing:.16em; text-transform:uppercase; color:#9da1a2;">KYVERA · The Identity Continuity Protocol</div>
      <div style="margin-top:20px; font-family:ui-monospace,Menlo,monospace; font-size:16px; color:#f28a54;">kyvera-alpha.vercel.app</div>
    </div>`,
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
for (const [name, body] of Object.entries(cards)) {
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body>${body}</body></html>`, { waitUntil: "load" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`rendered ${name}`);
}
await browser.close();
