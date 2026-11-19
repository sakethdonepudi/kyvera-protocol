/**
 * Seeds the running demo relay with a complete, real identity lifecycle.
 *
 *   pnpm relay            # terminal 1
 *   pnpm demo             # terminal 2
 *
 * Prints the npub and the exact CLI command that reproduces the result.
 */
import { binToHex } from "@bitauth/libauth";
import { generateBchKeyPair } from "@kyvera/bch";
import {
  generateNostrSecretKey,
  publishToRelays,
  signerFromSecretKey,
  toNpub,
} from "@kyvera/nostr";
import {
  createBindRecord,
  createRevokeRecord,
  createRotateRecord,
  resolveAddress,
  resolveIdentity,
} from "@kyvera/verifier";

const relayArg = process.argv.find((arg) => arg.startsWith("--relay="));
const relay = relayArg ? relayArg.slice("--relay=".length) : process.env.KYVERA_RELAY ?? "ws://127.0.0.1:7777";
const revoke = process.argv.includes("--revoke");

async function main() {
  const now = Math.floor(Date.now() / 1000);
  const secret = generateNostrSecretKey();
  const signer = signerFromSecretKey(secret);
  const subject = await signer.getPublicKey();
  const npub = toNpub(subject);

  const walletA = generateBchKeyPair("mainnet");
  const walletB = generateBchKeyPair("mainnet");

  console.log("KYVERA demo seed");
  console.log(`  relay   ${relay}`);
  console.log(`  npub    ${npub}`);

  const bind = await createBindRecord({
    signer,
    bchPrivateKey: walletA.privateKey,
    bch: walletA.identity,
    issuedAt: now,
  });
  const rotation = await createRotateRecord({
    signer,
    previous: { recordId: bind.recordId, sequence: 0, bch: walletA.identity },
    currentBchPrivateKey: walletA.privateKey,
    newBchPrivateKey: walletB.privateKey,
    newBch: walletB.identity,
    issuedAt: now + 1,
  });

  const toPublish = [bind.event, bind.publicEvent, rotation.event, rotation.publicEvent];
  let revocation = null;
  if (revoke) {
    revocation = await createRevokeRecord({
      signer,
      previous: { recordId: rotation.recordId, sequence: 1, bch: walletB.identity },
      currentBchPrivateKey: walletB.privateKey,
      issuedAt: now + 2,
    });
    toPublish.push(revocation.event, revocation.publicEvent);
  }

  for (const event of toPublish) {
    const reports = await publishToRelays([relay], event);
    for (const report of reports) {
      console.log(`  publish ${event.id.slice(0, 12)}… ${report.ok ? "ok" : `failed: ${report.message}`}`);
    }
  }

  const resolved = await resolveIdentity({ subject, relays: [relay], now: now + 10 });
  console.log("");
  console.log(`  status          ${resolved.status} (${resolved.reasonCode})`);
  console.log(`  assurance       ${resolved.assurance} ${resolved.sync.responded}/${resolved.sync.total} relays`);
  console.log(`  current BCH     ${resolved.activeBch?.address ?? "none"}`);
  console.log(`  history         ${resolved.history.map((step) => `#${step.record.payload.sequence} ${step.record.payload.type}`).join(" → ")}`);
  console.log(`  superseded      ${resolved.superseded.map((entry) => entry.address).join(", ") || "none"}`);

  const oldAddress = await resolveAddress({ address: walletA.identity.address, relays: [relay], now: now + 10 });
  console.log(`  address A check ${oldAddress.status}`);
  console.log(`  address B check ${(await resolveAddress({ address: walletB.identity.address, relays: [relay], now: now + 10 })).status}`);

  console.log("");
  console.log("  Verify independently:");
  console.log(`    pnpm cli ${npub} --relay ${relay}`);
  console.log(`    pnpm cli --address ${walletA.identity.address} --relay ${relay}`);
  console.log("");
  console.log(`  Demo Nostr secret (throwaway, never fund): ${binToHex(secret)}`);
  console.log(`  Demo wallet keys are intentionally not printed.`);
  console.log("");
  console.log("  Open:");
  console.log(`    http://localhost:3000/identity/${npub}`);
  console.log(`    http://localhost:3000/verify?npub=${npub}`);
  console.log(`    http://localhost:3000/verify?address=${walletA.identity.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
