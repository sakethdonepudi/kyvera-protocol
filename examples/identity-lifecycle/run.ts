/**
 * Executable end-to-end demonstration of the KYVERA lifecycle, with no
 * external services: an in-process relay, real signatures, real verification.
 *
 *   pnpm demo:lifecycle
 */
import { binToHex } from "@bitauth/libauth";
import { generateBchKeyPair } from "@kyvera/bch";
import { generateNostrSecretKey, signerFromSecretKey, toNpub } from "@kyvera/nostr";
import {
  createBindRecord,
  createRevokeRecord,
  createRotateRecord,
  resolveAddress,
  resolveIdentity,
  verifyEventRecord,
} from "@kyvera/verifier";
import { LocalRelay } from "../../tests/support/relay.js";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : ` — got ${String(actual)}, expected ${String(expected)}`}`);
}

async function main() {
  const relay = await LocalRelay.start();
  const now = Math.floor(Date.now() / 1000);
  const secret = generateNostrSecretKey();
  const signer = signerFromSecretKey(secret);
  const subject = await signer.getPublicKey();
  const walletA = generateBchKeyPair("mainnet");
  const walletB = generateBchKeyPair("mainnet");
  const walletC = generateBchKeyPair("mainnet");

  console.log("KYVERA lifecycle demonstration");
  console.log(`  npub      ${toNpub(subject)}`);
  console.log(`  relay     ${relay.url}`);
  console.log("");

  const bind = await createBindRecord({
    signer,
    bchPrivateKey: walletA.privateKey,
    bch: walletA.identity,
    issuedAt: now,
  });
  relay.seed(bind.event);

  console.log("1. Genesis binding");
  const afterBind = await resolveIdentity({ subject, relays: [relay.url], now: now + 5 });
  check("status", afterBind.status, "ACTIVE");
  check("active address", afterBind.activeBch?.address, walletA.identity.address);
  check("sequence", afterBind.head?.record.payload.sequence, 0);

  console.log("");
  console.log("2. Rotation: wallet A authorizes wallet B");
  const rotation = await createRotateRecord({
    signer,
    previous: { recordId: bind.recordId, sequence: 0, bch: walletA.identity },
    currentBchPrivateKey: walletA.privateKey,
    newBchPrivateKey: walletB.privateKey,
    newBch: walletB.identity,
    issuedAt: now + 1,
  });
  relay.seed(rotation.event);

  const afterRotate = await resolveIdentity({ subject, relays: [relay.url], now: now + 6 });
  check("status", afterRotate.status, "ACTIVE");
  check("active address", afterRotate.activeBch?.address, walletB.identity.address);
  check("sequence", afterRotate.head?.record.payload.sequence, 1);
  check("old address status", (await resolveAddress({ address: walletA.identity.address, relays: [relay.url], now: now + 6 })).status, "SUPERSEDED");
  check("new address status", (await resolveAddress({ address: walletB.identity.address, relays: [relay.url], now: now + 6 })).status, "ACTIVE");
  check("historical proof still verifies", verifyEventRecord(bind.event, { now: now + 6 }).ok, true);

  console.log("");
  console.log("3. Unauthorized rotation is rejected");
  const forged = await createRotateRecord({
    signer,
    previous: { recordId: rotation.recordId, sequence: 1, bch: walletB.identity },
    // Attacker controls the Nostr key and wallet C, but not wallet B.
    currentBchPrivateKey: walletC.privateKey,
    newBchPrivateKey: walletC.privateKey,
    newBch: walletC.identity,
    issuedAt: now + 2,
  });
  check("forged record verifies", verifyEventRecord(forged.event, { now: now + 6 }).ok, false);

  console.log("");
  console.log("4. Revocation by the currently authorized keys");
  const revocation = await createRevokeRecord({
    signer,
    previous: { recordId: rotation.recordId, sequence: 1, bch: walletB.identity },
    currentBchPrivateKey: walletB.privateKey,
    issuedAt: now + 3,
  });
  relay.seed(revocation.event);

  const afterRevoke = await resolveIdentity({ subject, relays: [relay.url], now: now + 7 });
  check("status", afterRevoke.status, "REVOKED");
  check("active address", afterRevoke.activeBch, null);
  check("revoked address lookup", (await resolveAddress({ address: walletB.identity.address, relays: [relay.url], now: now + 7 })).status, "REVOKED");
  check("old address remains superseded", (await resolveAddress({ address: walletA.identity.address, relays: [relay.url], now: now + 7 })).status, "SUPERSEDED");
  check("history length", afterRevoke.history.length, 3);

  console.log("");
  console.log("5. A stale relay cannot roll the state back (with a checkpoint)");
  const staleRelay = await LocalRelay.start();
  staleRelay.seed(bind.event);
  const rollback = await resolveIdentity({
    subject,
    relays: [staleRelay.url],
    now: now + 8,
    checkpoint: { sequence: 1, recordId: rotation.recordId },
  });
  check("status", rollback.status, "STALE");
  check("reason", rollback.reasonCode, "ROLLBACK_DETECTED");
  await staleRelay.close();

  console.log("");
  console.log("6. Conflicting histories are not resolved silently");
  const equivocationRelay = await LocalRelay.start();
  const otherRotation = await createRotateRecord({
    signer,
    previous: { recordId: bind.recordId, sequence: 0, bch: walletA.identity },
    currentBchPrivateKey: walletA.privateKey,
    newBchPrivateKey: walletC.privateKey,
    newBch: walletC.identity,
    issuedAt: now + 1,
  });
  equivocationRelay.seed(bind.event, rotation.event, otherRotation.event);
  const conflict = await resolveIdentity({ subject, relays: [equivocationRelay.url], now: now + 9 });
  check("status", conflict.status, "CONFLICT");
  check("active address", conflict.activeBch, null);
  await equivocationRelay.close();

  console.log("");
  console.log(`  nostr secret (throwaway): ${binToHex(secret)}`);
  console.log(`  ${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);

  await relay.close();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
