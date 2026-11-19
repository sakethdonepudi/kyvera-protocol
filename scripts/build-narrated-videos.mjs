#!/usr/bin/env node
/**
 * Build the narrated KYVERA films from the real application.
 *
 * Voice: Microsoft Edge Neural TTS (`edge-tts`) — en-US-AndrewNeural.
 * No API key is embedded. Requires network access to the Edge speech service.
 * FFMPEG must point to an ffmpeg binary.
 */
import { chromium } from "playwright";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE ?? "https://kyvera-alpha.vercel.app";
const FFMPEG = process.env.FFMPEG;
const VOICE = process.env.TTS_VOICE ?? "en-US-AndrewNeural";
const RATE = process.env.TTS_RATE ?? "-5%";
if (!FFMPEG) {
  console.error("FFMPEG=/path/to/ffmpeg is required");
  process.exit(2);
}

const OUT = resolve("apps/web/public/demo");
const WORK = resolve(".context/narrated-video");
const AUDIO = resolve(WORK, "audio");
const CLIPS = resolve(WORK, "clips");
const RAW = resolve(WORK, "raw");
for (const dir of [OUT, WORK, AUDIO, CLIPS, RAW]) mkdirSync(dir, { recursive: true });

const VIDEOS = [
  {
    id: "kyvera-explainer-90s",
    target: 90,
    pad: 3.4,
    scenes: [
      {
        id: "problem",
        label: "01 / THE PROBLEM",
        headline: "A wallet can change. The identity should not.",
        url: "/demo",
        action: async (page) => {
          await page.getByRole("button", { name: /04 Rotate/ }).click().catch(() => {});
          await page.waitForTimeout(700);
        },
        text:
          "A wallet address can change. But the identity behind it shouldn't have to disappear. In decentralized systems, proving who controls an address is only the beginning. The harder question is what happens when that address changes.",
      },
      {
        id: "meet",
        label: "02 / INTRODUCING KYVERA",
        headline: "Two independent keys. One continuity layer.",
        url: "/",
        text:
          "Meet KYVERA. An open-source identity continuity protocol connecting Bitcoin Cash and Nostr through independent cryptographic proofs. No shared private keys. No centralized identity provider.",
      },
      {
        id: "verify",
        label: "03 / INDEPENDENT VERIFICATION",
        headline: "The evidence is checked, not trusted.",
        url: "/challenge",
        action: async (page) => clickStage(page, "Verify"),
        text:
          "Each binding is cryptographically verified. Independent applications can inspect the evidence and determine whether an authorization chain is valid.",
      },
      {
        id: "rotate",
        label: "04 / CONTINUITY",
        headline: "History stays valid. Authorization moves.",
        url: "/challenge",
        action: async (page) => {
          await clickStage(page, "Rotate");
          await page.waitForTimeout(1800);
          await clickStage(page, "Prove");
        },
        text:
          "When a wallet changes, KYVERA preserves the authorization history. The old proof remains historically valid, but the old wallet is no longer the currently authorized destination.",
      },
      {
        id: "auth",
        label: "05 / AUTHENTICATION",
        headline: "Fresh challenge. Explicit uncertainty.",
        url: "/challenge",
        action: async (page) => clickStage(page, "Authenticate"),
        text:
          "KYVERA also supports challenge-response authentication, revocation, and explicit detection of conflicting or incomplete evidence. When the available information is uncertain, sensitive actions are blocked.",
      },
      {
        id: "close",
        label: "KYVERA",
        headline: "Keys change. Trust shouldn't disappear.",
        url: "/",
        pad: 6.0,
        text:
          "Your keys change. Your identity continues. KYVERA. Keys change. Trust shouldn't disappear.",
      },
    ],
  },
  {
    id: "kyvera-judge-demo-3min",
    target: 180,
    pad: 3.0,
    scenes: [
      {
        id: "intro",
        label: "01 / THE QUESTION",
        headline: "A signature proves the past. Who is authorized now?",
        url: "/",
        text:
          "KYVERA solves a problem that simple wallet-to-profile links cannot. A signature can prove ownership at one moment. But after a wallet is rotated, compromised, or revoked, how does another application know which wallet remains authorized? That is the identity-continuity problem. KYVERA makes current authorization independently verifiable.",
      },
      {
        id: "bind",
        label: "02 / DUAL-KEY BINDING",
        headline: "BCH and Nostr sign separately.",
        url: "/challenge",
        action: async (page) => clickStage(page, "Bind"),
        text:
          "KYVERA binds a Bitcoin Cash wallet and a Nostr identity using separate cryptographic proofs. The Nostr key signs the identity record. The BCH wallet signs a domain-separated message containing the record digest. Both signatures are verified. The verifier never trusts a profile field, a server, or a single signature.",
      },
      {
        id: "verify",
        label: "03 / INDEPENDENT VERIFICATION",
        headline: "Sequence, predecessor and proof role are checked.",
        url: "/challenge",
        action: async (page) => clickStage(page, "Verify"),
        text:
          "The binding and every later transition are canonical, hash-linked records. KYVERA checks sequence numbers, previous-record references, and the authorization rules for bind, rotate, and revoke. Discovery happens through Nostr relays. The verifier reports per-relay freshness, and it refuses to invent a current state when history is incomplete.",
      },
      {
        id: "auth",
        label: "04 / AUTHENTICATION",
        headline: "Single-use challenge. Current-state verification.",
        url: "/challenge",
        action: async (page) => clickStage(page, "Authenticate"),
        text:
          "A relying application issues a fresh, single-use challenge bound to its origin, session, intended identity, and address. The user signs it with the identity key. KYVERA verifies the response against freshly resolved authorization. Replayed challenges, expired challenges, and unauthorized signers are rejected. A session is issued only after verification.",
      },
      {
        id: "rotation",
        label: "05 / ROTATION AND CONTINUITY",
        headline: "Wallet A authorizes Wallet B. The old proof stays true.",
        url: "/challenge",
        action: async (page) => {
          await clickStage(page, "Rotate");
          await page.waitForTimeout(2200);
          await clickStage(page, "Prove");
        },
        text:
          "Now the original wallet is replaced through an authorized rotation. The current wallet authorizes leaving, the new wallet proves control, and the Nostr key binds the transition. Wallet A's historical signature remains valid forever. But it is no longer the current destination. The Time Machine shows that distinction explicitly, and the old application session is invalidated.",
      },
      {
        id: "merchant",
        label: "06 / MERCHANT DESTINATION",
        headline: "Verify, unlock, rotate, update.",
        url: "/merchant",
        action: async (page) => {
          await page.getByRole("button", { name: "Verify merchant" }).click();
          await page.waitForTimeout(2200);
          await page.getByRole("button", { name: "Rotate wallet" }).click();
          await page.waitForTimeout(1800);
        },
        text:
          "The same model can resolve an identity-linked payment destination. A merchant boots from a signed binding. After an authorized rotation, the destination moves to the new wallet, and the old wallet is reported as superseded. If the identity is stale, conflicted, or revoked, payment handoff is blocked.",
      },
      {
        id: "interop",
        label: "07 / INDEPENDENT INTEROPERABILITY",
        headline: "The verifier runs without KYVERA's website.",
        url: "/developers",
        action: async (page) => {
          await page.getByText("Standalone relying party", { exact: false }).scrollIntoViewIfNeeded().catch(() => {});
          await page.waitForTimeout(700);
        },
        text:
          "The verifier and relying-party example can run independently of KYVERA's website. This is a working open-source prototype with documented limitations, not a claim of production-grade wallet interoperability. Your keys change. Your identity continues. KYVERA.",
      },
      {
        id: "close",
        label: "KYVERA",
        headline: "Keys change. Trust shouldn't disappear.",
        url: "/",
        pad: 5.0,
        text: "KYVERA. Keys change. Trust shouldn't disappear.",
      },
    ],
  },
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

async function clickStage(page, label) {
  await page.locator("ol button").filter({ hasText: label }).first().click();
  await page.waitForTimeout(900);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function narrate(text, audio, subtitles) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      run("edge-tts", [
        "-v",
        VOICE,
        `--rate=${RATE}`,
        "-t",
        text,
        "--write-media",
        audio,
        "--write-subtitles",
        subtitles,
      ]);
      return;
    } catch (error) {
      lastError = error;
      console.log(`  TTS attempt ${attempt} failed; retrying`);
      sleep(1800);
    }
  }
  throw lastError;
}

function loudness(file) {
  const output = execFileSync(FFMPEG, ["-i", file, "-af", "volumedetect", "-f", "null", "-"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const match = output.match(/mean_volume: ([-\d.]+) dB/);
  const max = output.match(/max_volume: ([-\d.]+) dB/);
  return { mean: match?.[1], max: max?.[1] };
}

function audioDuration(file) {
  const info = execFileSync("afinfo", [file], { encoding: "utf8" });
  const match = info.match(/estimated duration: ([\d.]+)/);
  if (!match) throw new Error(`could not read duration of ${file}`);
  return Number(match[1]);
}

function parseVtt(text) {
  const cues = [];
  const blocks = text.replace(/\r/g, "").split("\n\n");
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;
    const time = lines.find((line) => line.includes("-->"));
    if (!time) continue;
    const index = lines.indexOf(time);
    const [start, end] = time.split("-->").map((value) => value.trim());
    const textLines = lines.slice(index + 1).filter(Boolean);
    if (!textLines.length) continue;
    cues.push({ start, end, text: textLines.join(" ") });
  }
  return cues;
}

function shiftTimestamp(timestamp, offset) {
  const [clock, ms] = timestamp.replace(",", ".").split(".");
  const [h, m, s] = clock.split(":").map(Number);
  const total = h * 3600 + m * 60 + s + Number(ms) / 1000 + offset;
  const hh = String(Math.floor(total / 3600)).padStart(2, "0");
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(Math.floor(total % 60)).padStart(2, "0");
  const mmm = String(Math.round((total - Math.floor(total)) * 1000)).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${mmm}`;
}

function makeSceneClip(raw, narration, destination, duration) {
  const filter = [
    "[0:v]fps=30,scale=1920:1080:flags=lanczos,setsar=1,tpad=stop_mode=clone:stop_duration=4,trim=duration=" + duration + ",setpts=PTS-STARTPTS,format=yuv420p,fade=t=in:st=0:d=0.35,fade=t=out:st=" + (duration - 0.45) + ":d=0.45[v]",
    "[1:a]adelay=350|350,apad=pad_dur=1.2,loudnorm=I=-16:TP=-1.5:LRA=11,atrim=duration=" + duration + "[a]",
  ].join(";");
  execFileSync(
    FFMPEG,
    [
      "-y",
      "-ss",
      "0.5",
      "-i",
      raw,
      "-i",
      narration,
      "-filter_complex",
      filter,
      "-map",
      "[v]",
      "-map",
      "[a]",
      "-t",
      String(duration),
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      "-movflags",
      "+faststart",
      destination,
    ],
    { stdio: "inherit" },
  );
}

async function recordScene(browser, scene, duration) {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: RAW, size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();
  const video = page.video();
  await page.goto(`${BASE}${scene.url}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  if (scene.action) await scene.action(page);
  await page.evaluate(
    ({ label, headline }) => {
      let style = document.getElementById("kyvera-film-style");
      if (!style) {
        style = document.createElement("style");
        style.id = "kyvera-film-style";
        style.textContent = `
          html { scrollbar-width: none; }
          ::-webkit-scrollbar { display: none; }
          main { animation: kyvera-push 20s ease-out forwards; transform-origin: 50% 12%; }
          @keyframes kyvera-push { from { transform: scale(1.01); } to { transform: scale(1.045); } }
          #kyvera-film-shade { position:fixed; inset:0; z-index:2147483645; pointer-events:none;
            background: radial-gradient(ellipse at 50% 35%, rgba(0,0,0,0) 45%, rgba(0,0,0,.42) 100%),
                        linear-gradient(180deg, rgba(0,0,0,.22) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 72%, rgba(0,0,0,.88) 100%); }
          #kyvera-film-brand { position:fixed; top:28px; left:36px; z-index:2147483647; color:rgba(245,241,232,.85);
            font:600 14px/1 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.24em; pointer-events:none; }
          #kyvera-film-fixture { position:fixed; top:30px; right:36px; z-index:2147483647; color:rgba(245,241,232,.45);
            font:500 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.16em; text-transform:uppercase; pointer-events:none; }
          #kyvera-film-lower { position:fixed; left:56px; right:56px; bottom:44px; z-index:2147483647; pointer-events:none;
            font-family: ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
          #kyvera-film-lower .label { color:#F28A54; font:650 14px/1 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.18em; text-transform:uppercase; }
          #kyvera-film-lower .headline { margin-top:12px; color:#F5F1E8; font-size:30px; line-height:1.22; max-width:1350px; letter-spacing:-.015em; }
        `;
        document.head.appendChild(style);
        const shade = document.createElement("div");
        shade.id = "kyvera-film-shade";
        document.body.appendChild(shade);
        const brand = document.createElement("div");
        brand.id = "kyvera-film-brand";
        brand.textContent = "KYVERA";
        document.body.appendChild(brand);
        const fixture = document.createElement("div");
        fixture.id = "kyvera-film-fixture";
        fixture.textContent = "demo fixtures · no wallet approval";
        document.body.appendChild(fixture);
        const lower = document.createElement("div");
        lower.id = "kyvera-film-lower";
        lower.innerHTML = '<div class="label"></div><div class="headline"></div>';
        document.body.appendChild(lower);
      }
      document.querySelector("#kyvera-film-lower .label").textContent = label;
      document.querySelector("#kyvera-film-lower .headline").textContent = headline;
    },
    { label: scene.label, headline: scene.headline },
  );
  await page.waitForTimeout(Math.ceil((duration + 2.2) * 1000));
  const path = await video.path();
  await context.close();
  return path;
}

async function buildVideo(browser, video) {
  const sceneData = [];
  let total = 0;
  const cues = [];
  for (const scene of video.scenes) {
    const audio = resolve(AUDIO, `${video.id}-${scene.id}.mp3`);
    const subtitles = resolve(AUDIO, `${video.id}-${scene.id}.vtt`);
    console.log(`narration ${video.id}/${scene.id}`);
    narrate(scene.text, audio, subtitles);
    const narration = audioDuration(audio);
    const duration = Math.ceil((narration + (scene.pad ?? video.pad ?? 0.8)) * 10) / 10;
    const raw = await recordScene(browser, scene, duration);
    const clip = resolve(CLIPS, `${video.id}-${scene.id}.mp4`);
    makeSceneClip(raw, audio, clip, duration);
    sceneData.push({ scene, clip, duration, narration });
    const sceneCues = parseVtt(readFileSync(subtitles, "utf8"));
    for (const cue of sceneCues) {
      cues.push({
        start: shiftTimestamp(cue.start, total + 0.35),
        end: shiftTimestamp(cue.end, total + 0.35),
        text: cue.text,
      });
    }
    total += duration;
    console.log(`  ${narration.toFixed(2)}s narration · ${duration.toFixed(1)}s scene`);
  }

  const list = resolve(CLIPS, `${video.id}.txt`);
  writeFileSync(list, sceneData.map((entry) => `file '${entry.clip}'`).join("\n") + "\n");
  const final = resolve(OUT, `${video.id}.mp4`);
  execFileSync(
    FFMPEG,
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      list,
      "-r",
      "30",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      "-movflags",
      "+faststart",
      final,
    ],
    { stdio: "inherit" },
  );
  const vtt = ["WEBVTT", ""];
  cues.forEach((cue, index) => {
    vtt.push(String(index + 1), `${cue.start} --> ${cue.end}`, cue.text, "");
  });
  writeFileSync(resolve(OUT, `${video.id}.vtt`), vtt.join("\n"));
  execFileSync(
    FFMPEG,
    ["-y", "-ss", "00:00:03", "-i", final, "-frames:v", "1", "-q:v", "2", resolve(OUT, `${video.id}-film-poster.jpg`)],
    { stdio: "inherit" },
  );
  console.log(`${video.id}: ${total.toFixed(1)}s · audio ${JSON.stringify(loudness(final))}`);
  return { total, loudness: loudness(final) };
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const video of VIDEOS) {
    await buildVideo(browser, video);
  }
} finally {
  await browser.close();
}
