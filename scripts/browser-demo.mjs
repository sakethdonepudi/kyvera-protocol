import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = ".context/screens";
mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });

page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`shot ${name}`);
}

async function main() {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await shot("01-landing");

  await page.goto(`${BASE}/create`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Generate key" }).click();
  await page.getByRole("button", { name: "Generate demo wallet" }).click();
  await page.getByText("BCH proof message").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(500);
  await shot("02-create-preview");

  await page.getByRole("button", { name: "Sign and publish binding" }).click();
  await page.getByText("Binding published").waitFor({ timeout: 20_000 });
  await shot("03-create-published");

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("kyvera.identities.v1") ?? "{}"));
  const identity = Object.values(stored)[0];
  if (!identity) throw new Error("no stored identity after publishing");
  console.log(`npub ${identity.npub}`);

  await page.goto(`${BASE}/identity/${identity.npub}`, { waitUntil: "networkidle" });
  await page.getByText("Current authorization").waitFor({ timeout: 20_000 });
  await shot("04-dashboard-active");

  await page.getByRole("button", { name: "Prepare rotation" }).click();
  await page.getByRole("button", { name: "Rotate now" }).click();
  await page.getByText(/Rotated to/).waitFor({ timeout: 25_000 });
  await page.waitForTimeout(1200);
  await shot("05-dashboard-rotated");

  await page.goto(`${BASE}/verify?npub=${encodeURIComponent(identity.npub)}`, { waitUntil: "networkidle" });
  await page.getByText("Authorization history").waitFor({ timeout: 20_000 });
  await shot("06-verify-active");

  const oldAddress = identity.bchKeys[0].address;
  await page.goto(`${BASE}/verify?address=${encodeURIComponent(oldAddress)}`, { waitUntil: "networkidle" });
  await page.getByText("Superseded", { exact: true }).first().waitFor({ timeout: 20_000 });
  await shot("07-verify-superseded");

  await page.goto(`${BASE}/auth?npub=${encodeURIComponent(identity.npub)}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Resolve" }).click();
  await page.getByRole("button", { name: "Create challenge" }).waitFor({ timeout: 20_000 });
  await page.getByRole("button", { name: "Create challenge" }).click();
  await page.getByRole("button", { name: "Sign and verify" }).click();
  await page.getByText("Authenticated", { exact: true }).waitFor({ timeout: 20_000 });
  await shot("08-auth-success");

  await page.goto(`${BASE}/developers`, { waitUntil: "networkidle" });
  await shot("09-developers");

  // Final state transition: revoke, then confirm the verifier refuses the address.
  await page.goto(`${BASE}/identity/${identity.npub}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Revoke binding" }).waitFor({ timeout: 20_000 });
  await page.getByRole("button", { name: "Revoke binding" }).click();
  await page.getByPlaceholder("Type REVOKE to confirm").fill("REVOKE");
  await page.getByRole("button", { name: "Revoke permanently" }).click();
  await page.getByText("The identity was revoked").waitFor({ timeout: 25_000 });
  await page.waitForTimeout(1200);
  await shot("10-dashboard-revoked");

  await page.goto(`${BASE}/verify?npub=${encodeURIComponent(identity.npub)}`, { waitUntil: "networkidle" });
  await page.getByText("Revoked", { exact: true }).first().waitFor({ timeout: 20_000 });
  await shot("11-verify-revoked");

  const state = {
    npub: identity.npub,
    oldAddress,
    subject: identity.subject,
    errors,
  };
  writeFileSync(`${OUT}/state.json`, JSON.stringify(state, null, 2));
  console.log(JSON.stringify(state, null, 2));
  if (errors.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser.close();
  });
