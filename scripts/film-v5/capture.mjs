#!/usr/bin/env node
/**
 * Captures the real KYVERA v5.0.1 application at 1920×1080 for the product film.
 *
 * Usage:
 *   BASE=https://kyvera-alpha.vercel.app node scripts/film-v5/capture.mjs
 *
 * The script never publishes an identity, signs a relay event or spends funds.
 * It does sign one canonical BCH proof locally to show the real Verified state.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { signBitcoinMessage, testBchKeyPair } from "@kyvera/bch";

const BASE = process.env.BASE ?? "https://kyvera-alpha.vercel.app";
const OUT = process.env.OUT ?? ".context/film-v5/screens";
const PUBLIC_NPUB =
  "npub18r22gp9eml92422y5m5fq7lryws22vgcek4prqgt6spqwdfy07cq6u6hs4";

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  colorScheme: "dark",
});

page.on("console", (message) => {
  if (message.type() === "error") console.error("console:", message.text());
});
page.on("pageerror", (error) => console.error("pageerror:", error.message));

async function settle(milliseconds = 700) {
  await page.waitForTimeout(milliseconds);
  await page.addStyleTag({
    content: `::-webkit-scrollbar{display:none!important}html{scrollbar-width:none!important}`,
  }).catch(() => {});
}

async function shot(name) {
  await settle();
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`captured ${name}`);
}

async function goto(path, waitFor) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 90_000 });
  if (waitFor) await page.getByText(waitFor, { exact: false }).first().waitFor({ timeout: 60_000 });
  await settle(1000);
}

async function scrollTo(text) {
  const target = page.getByText(text, { exact: false }).first();
  await target.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(500);
}

// 1. Homepage hero and lifecycle
await goto("/", "Keys change.");
await shot("homepage-hero");

await scrollTo("Identity lifecycle");
await shot("homepage-lifecycle-bind");

await page.getByRole("button", { name: /02 rotate/i }).click();
await settle(500);
await shot("homepage-lifecycle-rotate");

await page.getByRole("button", { name: /03 revoke/i }).click();
await settle(500);
await shot("homepage-lifecycle-revoke");

// 2. Create Identity — default, demo proof, and a real locally verified signature
await goto("/create", "Create an identity.");
await shot("create-default");

await page.getByRole("button", { name: "Generate key" }).click();
await settle(600);
await page.getByRole("button", { name: "Demo", exact: true }).click();
await page.getByRole("button", { name: "Generate demo wallet" }).click();
await page.getByText("BCH proof message").waitFor({ timeout: 20_000 });
await scrollTo("BCH proof message");
await shot("create-proof");

// Real local verification: known key, real canonical message, real signature.
const key = testBchKeyPair("kyvera film v5 create", "mainnet");
await page.getByRole("button", { name: "Paste", exact: true }).click();
await page.getByPlaceholder(/bitcoincash:q/).fill(key.identity.address);
await page.getByRole("button", { name: "Continue" }).click();
const proof = page.locator("pre").filter({ hasText: "KYVERA/v1/bch-proof" }).first();
await proof.waitFor({ timeout: 20_000 });
const message = (await proof.textContent()).trim();
const signature = signBitcoinMessage(key.privateKey, message);
await page.getByPlaceholder("Paste base64 signature").fill(signature);
await page.getByTestId("signature-ok").waitFor({ timeout: 20_000 });
await scrollTo("Ownership verified");
await shot("create-verified");

// 3. Public verification of the disposable two-relay lifecycle (ends REVOKED)
await goto(`/verify?npub=${encodeURIComponent(PUBLIC_NPUB)}`, "Identity time machine");
await page.getByText("Revoked", { exact: true }).first().waitFor({ timeout: 60_000 }).catch(() => {});
await shot("verify-public-revoked");
await scrollTo("Identity time machine");
await shot("verify-time-machine");

// 4. Trust Challenge
await goto("/challenge", "Five stages.");
await shot("challenge-bind");
await page.locator("ol button").filter({ hasText: "Authenticate" }).click();
await page.getByText(/independent relying party/i).first().waitFor({ timeout: 30_000 });
await shot("challenge-authenticate");
await page.locator("ol button").filter({ hasText: "Prove" }).click();
await page.getByText(/no longer authorized/i).first().waitFor({ timeout: 30_000 });
await shot("challenge-prove");

// 5. Authentication / relying-party surface
await goto("/auth-demo", "Sign in with an identity");
await shot("auth-demo-signed-out");
await page.getByRole("button", { name: "Unauthorized rotation" }).click();
await page.getByText(/ADDRESS_MISMATCH/).first().waitFor({ timeout: 30_000 });
await shot("auth-demo-rejection");

// 6. Merchant continuity
await goto("/merchant", "Sawa Market");
await shot("merchant-unverified");
await page.getByRole("button", { name: "Verify merchant" }).click();
await page.getByText("wallet A", { exact: false }).first().waitFor({ timeout: 20_000 });
await shot("merchant-verified");
await page.getByRole("button", { name: "Rotate wallet" }).click();
await page.getByText("wallet B", { exact: false }).first().waitFor({ timeout: 20_000 });
await page.getByText(/superseded/).first().waitFor({ timeout: 20_000 });
await shot("merchant-rotated");

// 7. Interactive demo / Time Machine
await goto("/demo", "Explore identity continuity.");
await shot("demo-top");
await scrollTo("Identity time machine");
await shot("demo-time-machine");

// 8. Developer surface
await goto("/developers", "Verification is a library call");
await scrollTo("resolveIdentity");
await shot("developers-sdk");

await browser.close();
console.log(`\nScreenshots written to ${OUT}`);
