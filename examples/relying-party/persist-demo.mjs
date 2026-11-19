#!/usr/bin/env node
/**
 * Durable independent relying-party demonstration.
 *
 * Creates a file-backed challenge/session store, authenticates with a fresh
 * service instance (simulating a process restart), validates the persisted
 * session, then proves that rotation and revocation invalidate it.
 *
 * Uses only @kyvera/sdk. No KYVERA website, API, relay or database is used.
 * Deterministic fixtures are used and labelled as such.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  AuthRequestService,
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
import { FileAuthRequestStore } from "./file-store.mjs";

const T = 1_794_000_000;
const NOW = T + 3_600;
const ORIGIN = "https://rp.example";
const SESSION_ID = "cd".repeat(32);

function check(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

function digest(label) {
  return createHash("sha256").update(label).digest();
}

const dir = mkdtempSync(join(tmpdir(), "kyvera-rp-"));
const storeFile = join(dir, "sessions.json");

try {
  const signer = signerFromSecretKey(digest("durable rp nostr key"));
  const subject = await signer.getPublicKey();
  const walletA = testBchKeyPair("durable rp A");
  const walletB = testBchKeyPair("durable rp B");

  const bind = await createBindRecord({
    signer,
    bchPrivateKey: walletA.privateKey,
    bch: walletA.identity,
    issuedAt: T,
    nonce: "31".repeat(32),
  });
  const rotateRecord = await createRotateRecord({
    signer,
    previous: { recordId: bind.recordId, sequence: 0, bch: walletA.identity },
    currentBchPrivateKey: walletA.privateKey,
    newBchPrivateKey: walletB.privateKey,
    newBch: walletB.identity,
    issuedAt: T + 60,
    nonce: "32".repeat(32),
  });
  const revokeRecord = await createRevokeRecord({
    signer,
    previous: { recordId: rotateRecord.recordId, sequence: 1, bch: walletB.identity },
    currentBchPrivateKey: walletB.privateKey,
    issuedAt: T + 120,
    nonce: "33".repeat(32),
  });

  const bindResolution = {
    ...resolveEvents([bind.event], { now: NOW }).resolution,
    assurance: "FULL",
    sync: { relays: [], responded: 0, total: 0, assurance: "FULL" },
    sources: {},
  };
  const rotated = {
    ...resolveEvents([bind.event, rotateRecord.event], { now: NOW }).resolution,
    assurance: "FULL",
    sync: { relays: [], responded: 0, total: 0, assurance: "FULL" },
    sources: {},
  };
  const revoked = {
    ...resolveEvents([bind.event, rotateRecord.event, revokeRecord.event], { now: NOW }).resolution,
    assurance: "FULL",
    sync: { relays: [], responded: 0, total: 0, assurance: "FULL" },
    sources: {},
  };

  // A process starts, issues a challenge, then exits.
  const first = new AuthRequestService({
    origin: ORIGIN,
    domain: "rp.example",
    ttlSeconds: 120,
    sessionTtlSeconds: 900,
    now: () => NOW,
    sessionId: SESSION_ID,
    store: new FileAuthRequestStore(storeFile),
  });
  const request = first.issue({
    expectedSubject: subject,
    expectedAddress: walletA.identity.address,
  });
  check("challenge was written to the durable store", new FileAuthRequestStore(storeFile).read().requests[request.challenge] !== undefined);

  // A new process starts with the same store and consumes the challenge.
  const second = new AuthRequestService({
    origin: ORIGIN,
    domain: "rp.example",
    ttlSeconds: 120,
    sessionTtlSeconds: 900,
    now: () => NOW,
    sessionId: SESSION_ID,
    store: new FileAuthRequestStore(storeFile),
  });
  const event = await buildAuthRequestEvent({ request, signer, createdAt: NOW });
  const login = second.verify(event, bindResolution);
  check(
    "challenge from a previous process authenticates once",
    login.check.authenticated === true && Boolean(login.session),
    login.check.code,
  );

  // A third process reads the persisted session.
  const third = new AuthRequestService({
    origin: ORIGIN,
    domain: "rp.example",
    ttlSeconds: 120,
    sessionTtlSeconds: 900,
    now: () => NOW,
    sessionId: SESSION_ID,
    store: new FileAuthRequestStore(storeFile),
  });
  const persisted = third.validate(login.session.token, bindResolution);
  check("session survives a process restart", persisted.valid === true, persisted.code);

  const afterRotation = validateAppSession(login.session, rotated, NOW);
  check(
    "rotation invalidates the persisted session",
    afterRotation.code === "SESSION_ADDRESS_CHANGED",
    afterRotation.code,
  );
  const afterRevocation = validateAppSession(login.session, revoked, NOW);
  check(
    "revocation invalidates the persisted session",
    afterRevocation.code === "SESSION_IDENTITY_REVOKED",
    afterRevocation.code,
  );

  const structured = toVerificationResult(revoked, toNpub(subject));
  check(
    "structured SDK result shows REVOKED and no authorized destination",
    structured.status === "REVOKED" &&
      structured.currentAuthorization.authorized === false &&
      structured.cryptographicValidity === true,
    `${structured.status} · records ${structured.historicalValidity.records.length}`,
  );

  third.logout(login.session.token);
  check(
    "logout removes the persisted session",
    third.validate(login.session.token, bindResolution).code === "SESSION_UNKNOWN",
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
