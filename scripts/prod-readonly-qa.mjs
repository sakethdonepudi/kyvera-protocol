#!/usr/bin/env node
/**
 * Read-only production QA: routes, reload, mobile overflow, video playback,
 * console errors. No writes, no relay publication, no wallet.
 *
 * Usage: BASE=https://your-deployment pnpm prod:qa
 */
import { chromium } from "playwright";

const BASE = (process.env.BASE ?? "").replace(/\/$/, "");
if (!BASE) {
  console.error("usage: BASE=https://your-deployment pnpm prod:qa");
  process.exit(2);
}

const routes = [
  ["/", "Keys change."],
  ["/create", "Create an identity."],
  ["/challenge", "Five stages."],
  ["/verify", "Trust the signatures"],
  ["/auth-demo", "Sign in with an identity"],
  ["/merchant", "Sawa Market"],
  ["/pay", "Pay the person."],
  ["/demo", "Identity time machine"],
  ["/lab", "scenarios executed"],
  ["/interop", "Verify wallet signature"],
  ["/developers", "Verification is a library call"],
  ["/tutorial", "See KYVERA in action."],
];

const failures = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

for (const [path, text] of routes) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.getByText(text, { exact: false }).first().waitFor({ timeout: 20_000 });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText(text, { exact: false }).first().waitFor({ timeout: 20_000 });
  console.log("ok", path);
}

await page.goto(`${BASE}/tutorial`, { waitUntil: "networkidle" });
const videos = page.locator("video");
if ((await videos.count()) !== 3) failures.push("tutorial does not render three videos");
for (let index = 0; index < (await videos.count()); index += 1) {
  const video = videos.nth(index);
  if (!(await video.getAttribute("poster"))) failures.push(`video ${index} missing poster`);
  if (!(await video.evaluate((element) => element.controls))) failures.push(`video ${index} missing controls`);
  if ((await video.locator("track[kind=captions]").count()) !== 1) failures.push(`video ${index} missing captions`);
}
if ((await videos.count()) > 0) {
  await videos.first().evaluate(async (element) => {
    element.muted = true;
    await element.play();
  });
  await page
    .waitForFunction(() => Boolean(document.querySelector("video")?.currentTime > 0.2), { timeout: 15_000 })
    .catch(() => failures.push("tutorial MP4 did not start playback"));
  await videos.first().evaluate((element) => element.pause());
}

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const mobileErrors = [];
mobile.on("console", (message) => {
  if (message.type() === "error") mobileErrors.push(message.text());
});
mobile.on("pageerror", (error) => mobileErrors.push(error.message));
for (const [path, text] of routes) {
  await mobile.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await mobile.getByText(text, { exact: false }).first().waitFor({ timeout: 20_000 });
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) failures.push(`mobile horizontal overflow: ${path}`);
  console.log("mobile ok", path);
}

if (errors.length > 0) failures.push(`console/page errors: ${errors.slice(0, 3).join(" | ")}`);
if (mobileErrors.length > 0) failures.push(`mobile console/page errors: ${mobileErrors.slice(0, 3).join(" | ")}`);

await browser.close();
if (failures.length > 0) {
  console.error("PRODUCTION READ-ONLY QA: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`PRODUCTION READ-ONLY QA: PASS (${routes.length} routes, reload, mobile, video)`);
