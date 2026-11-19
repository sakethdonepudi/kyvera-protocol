#!/usr/bin/env node
/**
 * Post-deployment smoke test. Read-only: no relay publication, no wallet,
 * no transaction.
 *
 * Usage:
 *   BASE=https://your-deployment.example pnpm smoke:deploy
 */
import { chromium } from "playwright";

const BASE = (process.env.BASE ?? process.env.POST_DEPLOY_BASE ?? "").replace(/\/$/, "");
if (!BASE) {
  console.error("usage: BASE=https://your-deployment.example pnpm smoke:deploy");
  process.exit(2);
}

const routes = [
  ["/", "Keys change."],
  ["/challenge", "Five stages."],
  ["/merchant", "Sawa Market"],
  ["/auth-demo", "Sign in with an identity"],
  ["/pay", "Pay the person."],
  ["/developers", "Verification is a library call"],
  ["/create", "Bind a Nostr identity"],
  ["/verify", "Trust the signatures"],
];

const failures = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

const response = await page.request.get(`${BASE}/`);
const headers = response.headers();
for (const name of [
  "content-security-policy",
  "strict-transport-security",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
]) {
  if (!headers[name]) failures.push(`missing header: ${name}`);
}
if (!/max-age=/.test(headers["strict-transport-security"] ?? "")) {
  failures.push("HSTS header is present but has no max-age");
}

for (const [path, text] of routes) {
  const res = await page.request.get(`${BASE}${path}`);
  if (!res.ok()) failures.push(`${path} returned HTTP ${res.status()}`);
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.getByText(text, { exact: false }).first().waitFor({ timeout: 20_000 });
}

const scripts = await page.evaluate(() =>
  performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((name) => name.endsWith(".js")),
);
for (const script of scripts) {
  const body = await (await fetch(script)).text();
  if (/ws:\/\/127\.0\.0\.1:7777|ws:\/\/localhost:7777/.test(body)) {
    failures.push(`production bundle contains local relay: ${script}`);
    break;
  }
}

await page.goto(`${BASE}/verify?npub=npub1invalid`, { waitUntil: "networkidle" });
const invalidText = (await page.locator("body").innerText()).toLowerCase();
if (!invalidText.includes("invalid") && !invalidText.includes("could not")) {
  failures.push("invalid npub page did not render an error");
}

if (consoleErrors.length > 0) {
  failures.push(`console/page errors: ${consoleErrors.slice(0, 3).join(" | ")}`);
}

await browser.close();

if (failures.length > 0) {
  console.error("POST-DEPLOY SMOKE: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`POST-DEPLOY SMOKE: PASS (${routes.length} routes, headers and bundle checks)`);
