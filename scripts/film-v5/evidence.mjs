#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "https://kyvera-alpha.vercel.app";
const OUT = "docs/screenshots/v5-film";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const [label, viewport] of [
  ["desktop", { width: 1440, height: 1000 }],
  ["mobile", { width: 390, height: 844 }],
]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1.5 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByText("See identity continuity.").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/homepage-film-${label}.png`, fullPage: false });

  await page.goto(`${BASE}/demo`, { waitUntil: "networkidle" });
  await page.getByText("KYVERA in action.").waitFor();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/demo-film-${label}.png`, fullPage: false });

  await page.goto(`${BASE}/tutorial`, { waitUntil: "networkidle" });
  await page.getByText("See KYVERA in action.").waitFor();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/tutorial-film-${label}.png`, fullPage: false });

  await page.close();
}
await browser.close();
console.log(`wrote film screenshots to ${OUT}`);
