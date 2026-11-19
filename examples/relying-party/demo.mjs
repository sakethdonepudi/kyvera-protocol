#!/usr/bin/env node
/**
 * Independent relying-party demonstration.
 *
 * Uses only the public KYVERA packages. It does not call the KYVERA web app,
 * a KYVERA API, or any proprietary service. It builds deterministic sample
 * records, authenticates a user with a single-use challenge, and verifies
 * rotation, revocation, replay and session invalidation.
 *
 * Run: pnpm rp:demo
 */
import { createHash } from "node:crypto";
import {
  AuthRequestService,
  KyveraClient,
  buildAuthRequestEvent,
  createBindRecord,
  createRevokeRecord,
  createRotateRecord,
  resolveEvents,
  signerFromSecretKey,
  testBchKeyPair,
  toNpub,
  toVerificationResult,
  validateAppSession,
} from "@kyvera/sdk";

const T = 1_794_000_000;
const NOW = T + 3_600;
const ORIGIN = "https://sawa.example";

const results = [];
function check(label, ok, detail = "") {
  results.push({ label, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

function digest(label) {
  return createHash("sha256").update(label).digest();
}

async function main() {
  console.log(`\nKYVERA independent relying-party demo\norigin: ${ORIGIN}\n`);

  const signer = signerFromSecretKey(digest("kyvera independent rp nostr key"));
  const subject = await signer.getPublicKey();
  const walletA = testBchKeyPair("rp bch A");
  const walletB = testBchKeyPair("rp bch B");
  const walletC = testBchKeyPair("rp bch C");

  const bind = await createBindRecord({
    signer,
    bchPrivateKey: walletA.privateKey,
    bch: walletA.identity,
    issuedAt: T,
    nonce: "21".repeat(32),
  });
  const rotate = await createRotateRecord({
    signer,
    previous: { recordId: bind.recordId, sequence: 0, bch: walletA.identity },
    currentBchPrivateKey: walletA.privateKey,
    newBchPrivateKey: walletB.privateKey,
    newBch: walletB.identity,
    issuedAt: T + 60,
    nonce: "22".repeat(32),
  });
  const gap = await createRotateRecord({
    signer,
    previous: { recordId: rotate.recordId, sequence: 1, bch: walletB.identity },
    currentBchPrivateKey: walletB.privateKey,
    newBchPrivateKey: walletC.privateKey,
    newBch: walletC.identity,
    issuedAt: T + 180,
    nonce: "24".repeat(32),
  });
  const revoke = await createRevokeRecord({
    signer,
    previous: { recordId: rotate.recordId, sequence: 1, bch: walletB.identity },
    currentBchPrivateKey: walletB.privateKey,
    issuedAt: T + 120,
    nonce: "23".repeat(32),
  });

  const bindResolution = resolveEvents([bind.event], { now: NOW }).resolution;
  check(
    "genesis binding resolves ACTIVE",
    bindResolution.status === "ACTIVE" &&
      bindResolution.activeBch?.address === walletA.identity.address,
    bindResolution.reasonCode,
  );

  const rp = new AuthRequestService({
    origin: ORIGIN,
    domain: "sawa.example",
    ttlSeconds: 120,
    sessionTtlSeconds: 900,
    now: () => NOW,
    sessionId: "ab".repeat(32),
  });
  const request = rp.issue({
    expectedSubject: subject,
    expectedAddress: walletA.identity.address,
  });
  const authEvent = await buildAuthRequestEvent({ request, signer, createdAt: NOW });
  const login = rp.verify(authEvent, bindResolution);
  check(
    "single-use challenge authenticates",
    login.check.authenticated === true && Boolean(login.session),
    login.check.code,
  );
  check(
    "replay is rejected",
    rp.verify(authEvent, bindResolution).check.code === "UNKNOWN_CHALLENGE",
  );

  const stranger = signerFromSecretKey(digest("kyvera stranger nostr key"));
  const strangerRp = new AuthRequestService({
    origin: ORIGIN,
    ttlSeconds: 120,
    now: () => NOW,
    sessionId: "cd".repeat(32),
  });
  const strangerRequest = strangerRp.issue({ expectedSubject: subject });
  const strangerEvent = await buildAuthRequestEvent({
    request: strangerRequest,
    signer: stranger,
    createdAt: NOW,
  });
  check(
    "a different signer is rejected",
    strangerRp.verify(strangerEvent, bindResolution).check.code === "SUBJECT_MISMATCH",
  );

  const rotation = resolveEvents([bind.event, rotate.event], { now: NOW }).resolution;
  check(
    "authorized rotation moves to wallet B",
    rotation.status === "ACTIVE" &&
      rotation.activeBch?.address === walletB.identity.address &&
      rotation.superseded.some((entry) => entry.address === walletA.identity.address),
    rotation.reasonCode,
  );
  check(
    "old wallet remains a valid historical proof",
    resolveEvents([bind.event], { now: NOW }).resolution.activeBch?.address === walletA.identity.address,
  );
  check(
    "session is invalidated after rotation",
    login.session ? validateAppSession(login.session, rotation, NOW).code === "SESSION_ADDRESS_CHANGED" : false,
  );

  const revoked = resolveEvents([bind.event, rotate.event, revoke.event], { now: NOW }).resolution;
  check(
    "revocation terminates the chain",
    revoked.status === "REVOKED",
    revoked.reasonCode,
  );
  check(
    "session is invalidated after revocation",
    login.session ? validateAppSession(login.session, revoked, NOW).code === "SESSION_IDENTITY_REVOKED" : false,
  );

  const incomplete = resolveEvents([bind.event, gap.event], { now: NOW }).resolution;
  check(
    "missing history cannot silently claim the latest sequence",
    incomplete.status === "STALE" &&
      incomplete.reasonCode === "MISSING_CHAIN_SEGMENT" &&
      incomplete.head?.record.payload.sequence === 0,
    `${incomplete.status} · ${incomplete.reasonCode} · head #${incomplete.head?.record.payload.sequence ?? "?"}`,
  );

  const publicOnly = resolveEvents([bind.publicEvent, rotate.publicEvent, revoke.publicEvent], {
    now: NOW,
  }).resolution;
  check(
    "public regular-event mirror resolves the full lifecycle",
    publicOnly.status === "REVOKED" && publicOnly.history.length === 3,
    `${publicOnly.status} · public kind ${bind.publicEvent.kind}`,
  );

  const structured = toVerificationResult(
    {
      ...revoked,
      assurance: "FULL",
      sync: { relays: [], responded: 0, total: 0, assurance: "FULL" },
      sources: {},
    },
    toNpub(subject),
  );
  check(
    "SDK separates cryptographic validity from current authorization",
    structured.cryptographicValidity === true &&
      structured.historicalValidity.valid === true &&
      structured.currentAuthorization.authorized === false &&
      structured.status === "REVOKED",
    `status ${structured.status} · records ${structured.historicalValidity.records.length}`,
  );

  const offline = new KyveraClient({ relays: [], now: () => NOW });
  check(
    "SDK reports UNSYNCED without relays",
    (await offline.verify(toNpub(subject))).evidenceCompleteness.assurance === "UNSYNCED",
  );

  const passed = results.filter((result) => result.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  console.log("No KYVERA website, API, relay or proprietary service was used.\n");
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
