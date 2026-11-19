#!/usr/bin/env node
/**
 * Capture the two KYVERA demonstration videos from the real local app.
 *
 * Requirements:
 *   - dev server at BASE (default http://localhost:3000)
 *   - local relay at ws://127.0.0.1:7777
 *   - FFMPEG=/path/to/ffmpeg
 *
 * Outputs:
 *   apps/web/public/demo/kyvera-explainer-90s.mp4
 *   apps/web/public/demo/kyvera-judge-demo-3min.mp4
 *   poster images and WebVTT caption files
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const FFMPEG = process.env.FFMPEG;
if (!FFMPEG) {
  console.error("FFMPEG=/path/to/ffmpeg is required");
  process.exit(2);
}

const OUT = resolve("apps/web/public/demo");
const TMP = resolve(".context/video-capture");
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

function vtt(cues) {
  return `WEBVTT\n\n${cues
    .map((cue, index) => `${index + 1}\n${cue.start} --> ${cue.end}\n${cue.text}\n`)
    .join("\n")}`;
}

const explainerCues = [
  { start: "00:00.000", end: "00:12.000", text: "A BCH wallet can change. A Nostr identity can persist. Which wallet is authorized now?" },
  { start: "00:12.000", end: "00:30.000", text: "KYVERA binds two independent keys: BCH and Nostr. Both signatures are verified locally." },
  { start: "00:30.000", end: "00:50.000", text: "Signed records form a hash-linked authorization chain. Relays only supply evidence." },
  { start: "00:50.000", end: "00:70.000", text: "An authorized rotation moves the current wallet to B and marks A superseded." },
  { start: "00:70.000", end: "00:82.000", text: "Wallet A's historical proof stays valid. It is simply no longer current." },
  { start: "00:82.000", end: "00:90.000", text: "KYVERA. Keys change. Trust shouldn't disappear." },
];

const judgeCues = [
  { start: "00:00.000", end: "00:12.000", text: "KYVERA is a decentralized identity-continuity protocol for BCH and Nostr." },
  { start: "00:12.000", end: "00:30.000", text: "Create a binding with two independent keys. No server holds the identity." },
  { start: "00:30.000", end: "00:50.000", text: "The Trust Challenge runs Bind, Verify, Authenticate, Rotate and Prove with real verifier logic." },
  { start: "00:50.000", end: "01:10.000", text: "Authentication uses a fresh, single-use challenge and a short-lived relying-party session." },
  { start: "01:10.000", end: "01:30.000", text: "Rotation requires the old wallet, the new wallet and the Nostr key." },
  { start: "01:30.000", end: "01:50.000", text: "Historical proof remains valid after rotation; current authorization moves." },
  { start: "01:50.000", end: "02:10.000", text: "The merchant demo updates its payment destination only after verification." },
  { start: "02:10.000", end: "02:25.000", text: "The standalone relying party verifies the same public protocol without KYVERA's website." },
  { start: "02:25.000", end: "02:41.000", text: "Fail-closed policy blocks partial or stale relay states. Real-wallet and public-relay interoperability remain untested." },
];

async function installCaption(page, title, body) {
  await page.evaluate(
    ({ title, body }) => {
      let style = document.getElementById("kyvera-video-style");
      if (!style) {
        style = document.createElement("style");
        style.id = "kyvera-video-style";
        style.textContent = `
          html { scrollbar-width: none; }
          ::-webkit-scrollbar { display: none; }
          #kyvera-video-caption {
            position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147483647;
            padding: 26px 56px 32px; pointer-events: none;
            background: linear-gradient(180deg, rgba(4,6,8,0) 0%, rgba(4,6,8,.88) 34%, rgba(4,6,8,.98) 100%);
            font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          #kyvera-video-caption .title { color:#F28A54; font-size:19px; font-weight:650; letter-spacing:.16em; text-transform:uppercase; }
          #kyvera-video-caption .body { margin-top:8px; color:#F5F1E8; font-size:29px; line-height:1.3; max-width:1500px; }
          #kyvera-video-mark { position:fixed; top:28px; left:36px; z-index:2147483646; color:rgba(245,241,232,.8); font:600 15px/1 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.2em; pointer-events:none; }
        `;
        document.head.appendChild(style);
      }
      let el = document.getElementById("kyvera-video-caption");
      if (!el) {
        el = document.createElement("div");
        el.id = "kyvera-video-caption";
        el.innerHTML = '<div class="title"></div><div class="body"></div>';
        document.body.appendChild(el);
        const mark = document.createElement("div");
        mark.id = "kyvera-video-mark";
        mark.textContent = "KYVERA";
        document.body.appendChild(mark);
      }
      el.querySelector(".title").textContent = title;
      el.querySelector(".body").textContent = body;
    },
    { title, body },
  );
}

async function clearCaption(page) {
  await page.evaluate(() => {
    document.getElementById("kyvera-video-caption")?.remove();
    document.getElementById("kyvera-video-mark")?.remove();
  });
}

async function pause(page, ms) {
  await page.waitForTimeout(ms);
}

async function clickStage(page, label) {
  await page.locator("ol button").filter({ hasText: label }).first().click();
  await pause(page, 1200);
}

async function captureExplainer(browser) {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: TMP, size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();
  const video = page.video();

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await installCaption(page, "The problem", "A BCH wallet can change. A Nostr identity can persist. How does another app know which wallet is authorized now?");
  await pause(page, 11000);
  await caption(page, "KYVERA", "Two independent keys. One canonical identity.");
  await pause(page, 9000);

  await page.goto(`${BASE}/challenge`, { waitUntil: "networkidle" });
  await caption(page, "Bind", "BCH and Nostr sign one genesis record.");
  await pause(page, 9000);
  await clickStage(page, "Verify");
  await caption(page, "Verify", "The verifier resolves the signed chain itself.");
  await pause(page, 9000);
  await clickStage(page, "Rotate");
  await caption(page, "Rotate", "Wallet A authorizes wallet B. A forged branch is rejected.");
  await pause(page, 10000);
  await clickStage(page, "Prove");
  await caption(page, "Prove", "Wallet A's proof stays valid. Wallet A is no longer authorized.");
  await pause(page, 11000);

  await page.goto(`${BASE}/merchant`, { waitUntil: "networkidle" });
  await caption(page, "Merchant identity", "The payment destination unlocks only after verification, then follows a rotation.");
  await pause(page, 9000);

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await caption(page, "KYVERA", "Keys change. Trust shouldn't disappear.");
  await pause(page, 10000);

  await page.goto(`${BASE}/challenge`, { waitUntil: "networkidle" });
  await clearCaption(page);
  await clickStage(page, "Prove");
  await page.screenshot({ path: resolve(OUT, "kyvera-explainer-poster.jpg"), type: "jpeg", quality: 88 });

  await context.close();
  return video.path();
}

async function caption(page, title, body) {
  await installCaption(page, title, body);
}

async function captureJudge(browser) {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: TMP, size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();
  const video = page.video();

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await caption(page, "KYVERA", "A decentralized identity-continuity protocol for BCH and Nostr.");
  await pause(page, 8000);
  await caption(page, "The problem", "A valid signature is not the same as a current authorization.");
  await pause(page, 7000);

  await page.goto(`${BASE}/create`, { waitUntil: "networkidle" });
  await caption(page, "Create identity", "Two independent keys. The demo path is clearly labelled and uses throwaway keys.");
  await pause(page, 6000);
  await page.getByRole("button", { name: "Generate key" }).click();
  await page.getByRole("button", { name: "Demo", exact: true }).click();
  await page.getByRole("button", { name: "Generate demo wallet" }).click();
  await pause(page, 6000);
  await caption(page, "Proof preview", "The exact BCH proof message and canonical Nostr payload are visible before publishing.");
  await pause(page, 6000);
  await page.getByRole("button", { name: "Publish identity" }).click();
  await page.getByText("Binding published").waitFor({ timeout: 20_000 });
  await caption(page, "Published", "Signed locally and published to the configured demo relay.");
  await pause(page, 9000);

  await page.goto(`${BASE}/challenge`, { waitUntil: "networkidle" });
  await caption(page, "Trust Challenge", "Five stages. Every verdict comes from the real verifier.");
  await pause(page, 9000);
  await clickStage(page, "Bind");
  await caption(page, "Bind", "The BCH signature recovers to the declared wallet; the Nostr signature is checked independently.");
  await pause(page, 7000);
  await clickStage(page, "Verify");
  await caption(page, "Verify", "The chain starts at genesis and must resolve without gaps or equivocation.");
  await pause(page, 7000);
  await clickStage(page, "Authenticate");
  await caption(page, "Authenticate", "A fresh single-use challenge. Replay and unauthorized rotation are rejected.");
  await pause(page, 8000);
  await clickStage(page, "Rotate");
  await caption(page, "Rotate", "The current wallet, the new wallet and the Nostr key must all authorize the move.");
  await pause(page, 8000);
  await clickStage(page, "Prove");
  await caption(page, "Prove", "Historical proof remains true. Current authorization has moved. The old session is invalid.");
  await pause(page, 9000);

  await page.goto(`${BASE}/merchant`, { waitUntil: "networkidle" });
  await caption(page, "Merchant destination", "Verify, unlock, rotate. The destination updates only after successful verification.");
  await pause(page, 7000);
  await page.getByRole("button", { name: "Verify merchant" }).click();
  await pause(page, 5000);
  await page.getByRole("button", { name: "Rotate wallet" }).click();
  await pause(page, 6000);

  await page.goto(`${BASE}/auth-demo`, { waitUntil: "networkidle" });
  await caption(page, "Independent relying party", "The relying party owns the challenge and session; it never asks KYVERA for a login decision.");
  await pause(page, 9000);
  const pill = page.locator("button").filter({ hasText: /npub1/ }).first();
  if (await pill.count()) {
    await pill.click();
    await pause(page, 5000);
  }

  await page.goto(`${BASE}/lab`, { waitUntil: "networkidle" });
  await caption(page, "Security lab", "Conflict, stale history, replay and revocation are explicit states, not silent fallbacks.");
  await pause(page, 10000);

  await caption(page, "Scope", "Local prototype. Real-wallet and public-relay interoperability remain explicitly untested.");
  await pause(page, 12000);

  await page.goto(`${BASE}/challenge`, { waitUntil: "networkidle" });
  await clearCaption(page);
  await clickStage(page, "Authenticate");
  await page.screenshot({ path: resolve(OUT, "kyvera-judge-poster.jpg"), type: "jpeg", quality: 88 });

  await context.close();
  return video.path();
}

function convert(input, output, posterTime) {
  execFileSync(
    FFMPEG,
    [
      "-y",
      "-i",
      input,
      "-an",
      "-vf",
      "scale=1920:1080:flags=lanczos,format=yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "25",
      "-movflags",
      "+faststart",
      output,
    ],
    { stdio: "inherit" },
  );
  execFileSync(
    FFMPEG,
    ["-y", "-ss", posterTime, "-i", output, "-frames:v", "1", "-q:v", "2", output.replace(/\.mp4$/, "-poster.jpg")],
    { stdio: "inherit" },
  );
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const explainerWebm = await captureExplainer(browser);
  convert(explainerWebm, resolve(OUT, "kyvera-explainer-90s.mp4"), "00:00:04");
  writeFileSync(resolve(OUT, "kyvera-explainer-90s.vtt"), vtt(explainerCues));

  const judgeWebm = await captureJudge(browser);
  convert(judgeWebm, resolve(OUT, "kyvera-judge-demo-3min.mp4"), "00:00:10");
  writeFileSync(resolve(OUT, "kyvera-judge-demo-3min.vtt"), vtt(judgeCues));

  console.log("Wrote MP4s, posters and captions to", OUT);
} finally {
  await browser.close();
}
