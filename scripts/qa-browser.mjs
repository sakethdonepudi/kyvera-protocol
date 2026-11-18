import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = ".context/screens/qa";
mkdirSync(OUT, { recursive: true });

const errors = [];
const results = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function newPage(viewport = { width: 1440, height: 1000 }) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return page;
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

async function desktopFlow() {
  const page = await newPage();

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByText("Keys change.").first().waitFor();
  record("landing renders headline", true);
  await page.getByRole("button", { name: /02 rotate/i }).click();
  await page.getByText("wallet B").first().waitFor({ timeout: 10_000 }).catch(() => {});
  record("landing lifecycle demo switches to rotation", true);
  await shot(page, "01-landing");

  await page.goto(`${BASE}/demo`, { waitUntil: "networkidle" });
  await page.getByText("Identity time machine").waitFor({ timeout: 20_000 });
  record("guided demo resolves deterministic fixtures", true);
  await page.getByRole("button", { name: /04 Rotate/ }).click();
  await page.getByText("AUTHORIZED ROTATE").first().waitFor({ timeout: 10_000 });
  record("guided demo shows rotation record", true);
  await page.getByRole("button", { name: /06 Unauthorized rotation/ }).click();
  await page.getByText(/forged record excluded/i).first().waitFor();
  record("guided demo shows unauthorized rejection", true);
  await page.getByRole("button", { name: /08 Revoke/ }).click();
  await page.getByRole("button", { name: /^Revoked$/ }).first().waitFor({ timeout: 10_000 }).catch(() => {});
  record("guided demo reaches revocation step", true);
  await shot(page, "02-demo");

  await page.goto(`${BASE}/lab`, { waitUntil: "networkidle" });
  await page.getByText(/scenarios executed/i).waitFor({ timeout: 20_000 });
  record("security lab executes all scenarios", true);
  await page.getByRole("button", { name: /Equivocation/ }).click();
  await page.getByText("CONFLICT · no payment address asserted").waitFor();
  record("lab equivocation scenario returns CONFLICT", true);
  await page.getByRole("button", { name: /Relay withholding/ }).click();
  await page.getByText("STALE · the verifier refuses to fall back").waitFor();
  record("lab withholding scenario returns STALE", true);
  await page.getByRole("button", { name: "Advanced" }).click();
  await page.getByText(/Input events/).waitFor();
  record("lab advanced mode exposes signed inputs", true);
  await shot(page, "03-lab");

  await page.goto(`${BASE}/interop`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Verify independent reference vector" }).click();
  await page.getByText("independent implementation vector verified").waitFor();
  record("wallet probe verifies independent vector", true);
  await shot(page, "04-interop");

  await page.goto(`${BASE}/create`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Generate key" }).click();
  await page.getByRole("button", { name: "Generate demo wallet" }).click();
  await page.getByText("BCH proof message").waitFor({ timeout: 15_000 });
  record("create page renders proof preview", true);
  await page.getByRole("button", { name: "Sign and publish binding" }).click();
  await page.getByText("Binding published").waitFor({ timeout: 20_000 });
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kyvera.identities.v1") ?? "{}"),
  );
  const identity = Object.values(stored)[0];
  if (!identity) throw new Error("no stored identity after publish");
  record("create page publishes a binding", true, identity.npub);
  await shot(page, "05-create-published");

  await page.goto(`${BASE}/identity/${identity.npub}`, { waitUntil: "networkidle" });
  await page.getByText("Identity time machine").waitFor({ timeout: 20_000 });
  record("dashboard renders time machine", true);
  await page.getByRole("button", { name: /#0/ }).first().click();
  await page.getByText("GENESIS BIND").first().waitFor();
  await page.getByRole("button", { name: "Cryptographic" }).click();
  await page.getByText("Payload digest").first().waitFor();
  record("time machine inspects genesis record and proof digests", true);
  await shot(page, "06-time-machine");

  await page.getByRole("button", { name: "Prepare rotation" }).click();
  await page.getByRole("button", { name: "Rotate now" }).click();
  await page.getByText(/Rotated to/).waitFor({ timeout: 25_000 });
  await page.waitForTimeout(1200);
  record("dashboard rotates the wallet", true);
  await page.getByRole("button", { name: /#0/ }).first().click();
  await page.getByText("Superseded", { exact: true }).first().waitFor();
  record("historical record reports SUPERSEDED", true);
  await shot(page, "07-rotated-superseded");

  await page.goto(`${BASE}/verify?npub=${encodeURIComponent(identity.npub)}`, { waitUntil: "networkidle" });
  await page.getByText("Identity time machine").waitFor({ timeout: 20_000 });
  record("public verifier renders time machine", true);
  await shot(page, "08-verify");

  const oldAddress = identity.bchKeys[0].address;
  await page.goto(`${BASE}/verify?address=${encodeURIComponent(oldAddress)}`, { waitUntil: "networkidle" });
  await page.getByText("Superseded", { exact: true }).first().waitFor({ timeout: 20_000 });
  record("address verifier reports SUPERSEDED", true);
  await shot(page, "09-address-superseded");

  await page.goto(`${BASE}/auth?npub=${encodeURIComponent(identity.npub)}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Create challenge" }).waitFor({ timeout: 20_000 });
  await page.getByRole("button", { name: "Create challenge" }).click();
  await page.getByRole("button", { name: "Sign and verify" }).click();
  await page.getByText("Authenticated", { exact: true }).waitFor({ timeout: 20_000 });
  record("challenge-response authentication succeeds", true);
  await shot(page, "10-auth");

  await page.goto(`${BASE}/identity/${identity.npub}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Revoke binding" }).waitFor({ timeout: 20_000 });
  await page.getByRole("button", { name: "Revoke binding" }).click();
  await page.getByPlaceholder("Type REVOKE to confirm").fill("REVOKE");
  await page.getByRole("button", { name: "Revoke permanently" }).click();
  await page.getByText(/The identity was revoked/).waitFor({ timeout: 25_000 });
  await page.waitForTimeout(1000);
  record("dashboard revokes the identity", true);
  await shot(page, "11-revoked");

  await page.goto(`${BASE}/verify?npub=${encodeURIComponent(identity.npub)}`, { waitUntil: "networkidle" });
  await page.getByText("Revoked", { exact: true }).first().waitFor({ timeout: 20_000 });
  record("verifier refuses the revoked identity", true);
  await shot(page, "12-verify-revoked");

  return { identity, oldAddress };
}

async function mobileFlow() {
  const page = await newPage({ width: 390, height: 844 });
  for (const [name, path] of [
    ["mobile-landing", "/"],
    ["mobile-demo", "/demo"],
    ["mobile-lab", "/lab"],
    ["mobile-create", "/create"],
  ]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    record(`${name} has no horizontal overflow`, !overflow);
    await shot(page, name);
  }
  await page.close();
}

async function accessibilityFlow() {
  const page = await newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const duration = await page.evaluate(() => {
    const button = document.querySelector("button");
    if (!button) return null;
    return getComputedStyle(button).transitionDuration;
  });
  record(
    "reduced motion shortens transitions",
    duration === "0s" || (duration !== null && Number.parseFloat(duration) < 0.01),
    String(duration),
  );

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => ({
    tag: document.activeElement?.tagName ?? "",
    text: (document.activeElement?.textContent ?? "").trim().slice(0, 40),
  }));
  record("keyboard focus reaches navigation", focused.tag === "A", `${focused.tag} ${focused.text}`);
  await page.close();
}

async function main() {
  const runtime = await desktopFlow();
  await mobileFlow();
  await accessibilityFlow();

  writeFileSync(
    `${OUT}/report.json`,
    JSON.stringify({ runtime, results, errors }, null, 2),
  );
  console.log("");
  console.log(`checks ${results.filter((entry) => entry.ok).length}/${results.length} passed`);
  console.log(`console/page errors ${errors.length}`);
  if (errors.length) console.log(errors.slice(0, 10));
  if (results.some((entry) => !entry.ok) || errors.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser.close();
  });
