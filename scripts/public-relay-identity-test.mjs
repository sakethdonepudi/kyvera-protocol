#!/usr/bin/env node
/**
 * Disposable public-relay lifecycle test.
 *
 * PUBLISHES PUBLIC NOSTR EVENTS. Do not run without explicit authorization.
 *
 * Required:
 *   I_AUTHORIZE_PUBLIC_RELAY_TEST=yes
 *   KYVERA_PUBLIC_RELAY=wss://relay.example
 *
 * Generates throwaway keys in memory, publishes bind -> rotate -> revoke
 * (legacy + public mirrors), attempts an unauthorized rotation, verifies the
 * full lifecycle, and checks missing-history behavior. It never spends funds,
 * requests a wallet, or prints a private key.
 */
import {
  NOSTR_KIND,
  NOSTR_PUBLIC_KIND,
  createRotatePayload,
  digestOf,
  sealRecord,
} from "@kyvera/core";
import { generateBchKeyPair } from "@kyvera/bch";
import {
  buildRecordEvent,
  generateNostrSecretKey,
  publishToRelays,
  queryRelays,
  signerFromSecretKey,
  subjectFilter,
  toNpub,
} from "@kyvera/nostr";
import {
  createBindRecord,
  createRevokeRecord,
  createRotateRecord,
  resolveEvents,
  resolveIdentity,
  signBchProof,
} from "@kyvera/verifier";

const relays = (process.env.KYVERA_PUBLIC_RELAY ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
if (relays.length === 0) {
  console.error("KYVERA_PUBLIC_RELAY is required (one or more comma-separated relay URLs).");
  process.exit(2);
}
const isLocal = relays.every((relay) => /^ws:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(relay));
if (isLocal) {
  if (process.env.I_AUTHORIZE_LOCAL_RELAY_TEST !== "yes") {
    console.error("Refusing local writes: set I_AUTHORIZE_LOCAL_RELAY_TEST=yes for the disposable local relay test.");
    process.exit(2);
  }
} else {
  if (process.env.I_AUTHORIZE_PUBLIC_RELAY_TEST !== "yes") {
    console.error("Refusing to publish: set I_AUTHORIZE_PUBLIC_RELAY_TEST=yes only with explicit authorization.");
    process.exit(2);
  }
  for (const relay of relays) {
    if (!/^wss:\/\//.test(relay)) {
      console.error(`KYVERA_PUBLIC_RELAY must use wss:// for public relays: ${relay}`);
      process.exit(2);
    }
  }
}

const secret = generateNostrSecretKey();
const signer = signerFromSecretKey(secret);
const subject = await signer.getPublicKey();
const walletA = generateBchKeyPair("mainnet");
const walletB = generateBchKeyPair("mainnet");
const walletC = generateBchKeyPair("mainnet");
const issuedAt = Math.floor(Date.now() / 1000);

const evidence = {
  relays,
  npub: toNpub(subject),
  issuedAt,
  bind: null,
  rotate: null,
  forged: null,
  revoke: null,
  observations: [],
  retrieved: null,
};

console.log(isLocal ? "Disposable LOCAL-relay lifecycle test" : "Disposable public-relay lifecycle test");
console.log(`relays:  ${relays.join(", ")}`);
console.log(`npub:    ${toNpub(subject)}`);
console.log(`address: ${walletA.identity.address}`);
console.log("No private key will be printed. Keys are discarded when this process exits.");

async function publish(record, label) {
  const reports = await Promise.all([
    publishToRelays(relays, record.event),
    publishToRelays(relays, record.publicEvent),
  ]);
  const accepted = reports.some((group) => group.some((report) => report.ok));
  console.log(`${label}: legacy=${record.event.id} public=${record.publicEvent.id} accepted=${accepted}`);
  console.log(`  legacy ${JSON.stringify(reports[0])}`);
  console.log(`  public ${JSON.stringify(reports[1])}`);
  if (!accepted) {
    throw new Error(`${label} was not accepted by the relay`);
  }
  evidence[label] = {
    legacyEventId: record.event.id,
    publicEventId: record.publicEvent.id,
    legacyReport: reports[0],
    publicReport: reports[1],
    recordId: record.recordId,
  };
}

async function waitFor(status) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const resolution = await resolveIdentity({
      subject,
      relays,
      now: Math.floor(Date.now() / 1000),
    });
    evidence.observations.push({
      attempt,
      status: resolution.status,
      reasonCode: resolution.reasonCode,
      assurance: resolution.assurance,
      history: resolution.history.length,
      active: resolution.activeBch?.address ?? null,
      superseded: resolution.superseded.map((entry) => entry.address),
    });
    if (resolution.status === status) return resolution;
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  return resolveIdentity({ subject, relays, now: Math.floor(Date.now() / 1000) });
}

try {
  const bind = await createBindRecord({
    signer,
    bchPrivateKey: walletA.privateKey,
    bch: walletA.identity,
    issuedAt,
  });
  await publish(bind, "bind");
  const active = await waitFor("ACTIVE");
  if (active.status !== "ACTIVE" || active.activeBch?.address !== walletA.identity.address) {
    throw new Error(`binding did not resolve ACTIVE: ${active.status} ${active.reasonCode}`);
  }

  const rotate = await createRotateRecord({
    signer,
    previous: { recordId: bind.recordId, sequence: 0, bch: walletA.identity },
    currentBchPrivateKey: walletA.privateKey,
    newBchPrivateKey: walletB.privateKey,
    newBch: walletB.identity,
    issuedAt: issuedAt + 1,
  });
  await publish(rotate, "rotate");
  const rotated = await waitFor("ACTIVE");
  if (
    rotated.status !== "ACTIVE" ||
    rotated.activeBch?.address !== walletB.identity.address ||
    !rotated.superseded.some((entry) => entry.address === walletA.identity.address) ||
    rotated.history.length < 2
  ) {
    throw new Error(`rotation did not preserve full history: ${rotated.status} ${rotated.reasonCode}`);
  }

  // A thief with the Nostr key and a new wallet cannot produce the current
  // wallet's signature. Publish the forged record and confirm it is rejected.
  const forgedPayload = createRotatePayload({
    subject,
    previousRecordId: bind.recordId,
    sequence: 1,
    bch: walletC.identity,
    issuedAt: issuedAt + 2,
  });
  const forgedDigest = digestOf(forgedPayload);
  const forgedCurrent = signBchProof(walletC.privateKey, "current", walletA.identity.address, forgedDigest);
  const forgedNew = signBchProof(walletC.privateKey, "new", walletC.identity.address, forgedDigest);
  const forgedRecord = sealRecord(forgedPayload, [forgedCurrent, forgedNew]);
  const forgedBuilt = await buildRecordEvent(forgedRecord, signer);
  if (!forgedBuilt.ok || !forgedBuilt.event) throw new Error(forgedBuilt.message);
  const forgedReports = await publishToRelays(relays, forgedBuilt.event);
  console.log(`forged:  ${forgedBuilt.event.id} accepted=${forgedReports.some((report) => report.ok)}`);
  console.log(`  ${JSON.stringify(forgedReports)}`);
  evidence.forged = {
    eventId: forgedBuilt.event.id,
    report: forgedReports,
  };
  const afterForged = await resolveIdentity({
    subject,
    relays,
    now: Math.floor(Date.now() / 1000),
  });
  if (
    afterForged.activeBch?.address !== walletB.identity.address ||
    !afterForged.rejected.some((entry) => entry.eventId === forgedBuilt.event.id)
  ) {
    throw new Error("forged rotation was not rejected while preserving wallet B");
  }

  const revoke = await createRevokeRecord({
    signer,
    previous: { recordId: rotate.recordId, sequence: 1, bch: walletB.identity },
    currentBchPrivateKey: walletB.privateKey,
    issuedAt: issuedAt + 3,
  });
  await publish(revoke, "revoke");
  const revoked = await waitFor("REVOKED");
  if (revoked.status !== "REVOKED" || revoked.activeBch !== null) {
    throw new Error(`revocation did not terminate the chain: ${revoked.status} ${revoked.reasonCode}`);
  }

  const aggregate = await queryRelays(relays, [subjectFilter(subject)]);
  const publicEvents = aggregate.events.filter((event) => event.kind === NOSTR_PUBLIC_KIND);
  const legacyEvents = aggregate.events.filter((event) => event.kind === NOSTR_KIND);
  evidence.retrieved = {
    publicCount: publicEvents.length,
    legacyCount: legacyEvents.length,
    publicIds: publicEvents.map((event) => event.id),
    legacyIds: legacyEvents.map((event) => event.id),
    sources: aggregate.sources,
  };
  if (publicEvents.length < 3 || legacyEvents.length < 3) {
    throw new Error(
      `expected at least 3 events of each kind, got public=${publicEvents.length} legacy=${legacyEvents.length}`,
    );
  }

  // Missing-history behavior: dropping the rotation must return STALE, never
  // a fallback to wallet A.
  const gap = resolveEvents([bind.event, revoke.event], {
    now: Math.floor(Date.now() / 1000),
  }).resolution;
  if (gap.status !== "STALE" || gap.activeBch !== null) {
    throw new Error(`missing rotation did not fail closed: ${gap.status} ${gap.reasonCode}`);
  }

  evidence.final = {
    status: revoked.status,
    reasonCode: revoked.reasonCode,
    assurance: revoked.assurance,
    history: revoked.history.map((step) => ({
      sequence: step.record.payload.sequence,
      type: step.record.payload.type,
      eventId: step.eventId,
      address: step.record.payload.bch?.address ?? null,
    })),
    gap: { status: gap.status, reasonCode: gap.reasonCode },
  };

  console.log(`observed: ${revoked.status} · ${revoked.reasonCode} · ${revoked.assurance}`);
  console.log(`history:  ${revoked.history.length} valid records`);
  console.log(`retrieved: public=${publicEvents.length} legacy=${legacyEvents.length}`);
  console.log(`missing history: ${gap.status} · ${gap.reasonCode}`);
  console.log("EVIDENCE_JSON " + JSON.stringify(evidence));
  console.log("Test complete. The identity is revoked; no active public address remains.");
  process.exit(0);
} catch (error) {
  console.error("PUBLIC RELAY TEST FAILED");
  console.error(error instanceof Error ? error.message : String(error));
  console.log("EVIDENCE_JSON " + JSON.stringify(evidence));
  process.exit(1);
}
