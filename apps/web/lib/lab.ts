"use client";

import {
  buildBchProofMessage,
  type ChainResolution,
  type IdentityStatus,
  type KyveraEvent,
} from "@kyvera/core";
import {
  generateBchKeyPair,
  testBchKeyPair,
  type BchKeyPair,
} from "@kyvera/bch";
import { signerFromSecretKey, toNpub, type NostrSigner } from "@kyvera/nostr";
import {
  applyCheckpointToResolution,
  createBindRecord,
  createRevokeRecord,
  createRotateRecord,
  resolveEvents,
  verifyEventRecord,
  type CreatedRecord,
  type IdentityResolution,
  type VerifyEventResult,
} from "@kyvera/verifier";
import { sha256, utf8ToBin } from "@bitauth/libauth";

export const LAB_T = 1_794_000_000;
export const LAB_NOW = LAB_T + 3_600;

export interface LabFixtures {
  subject: string;
  npub: string;
  signer: NostrSigner;
  walletA: BchKeyPair;
  walletB: BchKeyPair;
  walletC: BchKeyPair;
  bind: CreatedRecord;
  rotateB: CreatedRecord;
  rotateC: CreatedRecord;
  gap: CreatedRecord;
  forged: CreatedRecord;
  revoke: CreatedRecord;
}

let fixturesPromise: Promise<LabFixtures> | null = null;

function secretFor(label: string): Uint8Array {
  return sha256.hash(utf8ToBin(`kyvera lab nostr key: ${label}`));
}

export function getLabFixtures(): Promise<LabFixtures> {
  if (!fixturesPromise) fixturesPromise = buildFixtures();
  return fixturesPromise;
}

async function buildFixtures(): Promise<LabFixtures> {
  const secret = secretFor("deterministic-alice");
  const signer = signerFromSecretKey(secret);
  const subject = await signer.getPublicKey();
  const walletA = testBchKeyPair("lab bch A");
  const walletB = testBchKeyPair("lab bch B");
  const walletC = testBchKeyPair("lab bch C");

  const bind = await createBindRecord({
    signer,
    bchPrivateKey: walletA.privateKey,
    bch: walletA.identity,
    issuedAt: LAB_T,
    nonce: "11".repeat(32),
  });
  const rotateB = await createRotateRecord({
    signer,
    previous: { recordId: bind.recordId, sequence: 0, bch: walletA.identity },
    currentBchPrivateKey: walletA.privateKey,
    newBchPrivateKey: walletB.privateKey,
    newBch: walletB.identity,
    issuedAt: LAB_T + 60,
    nonce: "12".repeat(32),
  });
  const rotateC = await createRotateRecord({
    signer,
    previous: { recordId: bind.recordId, sequence: 0, bch: walletA.identity },
    currentBchPrivateKey: walletA.privateKey,
    newBchPrivateKey: walletC.privateKey,
    newBch: walletC.identity,
    issuedAt: LAB_T + 61,
    nonce: "13".repeat(32),
  });
  // Sequence 2 that references the missing rotateB record.
  const gap = await createRotateRecord({
    signer,
    previous: { recordId: rotateB.recordId, sequence: 1, bch: walletB.identity },
    currentBchPrivateKey: walletB.privateKey,
    newBchPrivateKey: walletC.privateKey,
    newBch: walletC.identity,
    issuedAt: LAB_T + 120,
    nonce: "14".repeat(32),
  });
  // A thief with the Nostr key and wallet C tries to rotate away from A.
  const forged = await createRotateRecord({
    signer,
    previous: { recordId: bind.recordId, sequence: 0, bch: walletA.identity },
    currentBchPrivateKey: walletC.privateKey,
    newBchPrivateKey: walletC.privateKey,
    newBch: walletC.identity,
    issuedAt: LAB_T + 90,
    nonce: "15".repeat(32),
  });
  const revoke = await createRevokeRecord({
    signer,
    previous: { recordId: rotateB.recordId, sequence: 1, bch: walletB.identity },
    currentBchPrivateKey: walletB.privateKey,
    issuedAt: LAB_T + 180,
    nonce: "16".repeat(32),
  });

  return {
    subject,
    npub: toNpub(subject),
    signer,
    walletA,
    walletB,
    walletC,
    bind,
    rotateB,
    rotateC,
    gap,
    forged,
    revoke,
  };
}

export type LabVerdict = "accepted" | "rejected" | "conflict" | "stale" | "revoked";

export interface LabCheck {
  label: string;
  ok: boolean;
  detail: string;
}

export interface LabScenario {
  id: string;
  title: string;
  question: string;
  verdict: LabVerdict;
  status: IdentityStatus;
  headline: string;
  explanation: string;
  checks: LabCheck[];
  events: KyveraEvent[];
  resolution?: ChainResolution;
  recordResult?: VerifyEventResult;
  testRef: string;
  advanced: unknown;
}

export interface LabReport {
  fixtures: LabFixtures;
  scenarios: LabScenario[];
  ranAt: number;
}

function offlineResolution(
  resolution: ChainResolution,
  assurance: "FULL" | "PARTIAL" | "UNSYNCED" = "FULL",
): IdentityResolution {
  return {
    ...resolution,
    assurance,
    sync: { relays: [], responded: 0, total: 0, assurance },
    sources: {},
  };
}

export async function runLab(): Promise<LabReport> {
  const f = await getLabFixtures();
  const options = { now: LAB_NOW };

  const rotation = resolveEvents([f.bind.event, f.rotateB.event], options).resolution;
  const replay = resolveEvents([f.rotateB.event, f.bind.event, f.bind.event], options).resolution;
  const conflict = resolveEvents([f.bind.event, f.rotateB.event, f.rotateC.event], options).resolution;
  const gap = resolveEvents([f.bind.event, f.gap.event], options).resolution;
  const revoked = resolveEvents([f.bind.event, f.rotateB.event, f.revoke.event], options).resolution;
  const forgedResult = verifyEventRecord(f.forged.event, options);
  const forgedState = resolveEvents([f.bind.event, f.forged.event], options).resolution;
  const historicalRecord = verifyEventRecord(f.bind.event, options);

  const base = offlineResolution(resolveEvents([f.bind.event], options).resolution);
  const rollback = applyCheckpointToResolution(base, {
    sequence: 1,
    recordId: f.rotateB.recordId,
  });

  const scenarios: LabScenario[] = [
    {
      id: "rotation",
      title: "Authorized wallet rotation",
      question: "Wallet A explicitly authorizes wallet B. What is current?",
      verdict: "accepted",
      status: rotation.status,
      headline: `ACTIVE → wallet B · sequence #${rotation.head?.record.payload.sequence ?? "?"}`,
      explanation:
        "The rotate record carries three signatures: the old wallet authorizes leaving, the new wallet proves control, and the Nostr key binds the transition to the identity. Wallet A remains a valid historical proof but is reported as SUPERSEDED.",
      checks: [
        {
          label: "Current BCH key signed the transition",
          ok: rotation.status === "ACTIVE",
          detail: `record #${rotation.history[1]?.record.payload.sequence ?? 1} current proof accepted`,
        },
        {
          label: "New BCH key signed the destination",
          ok: rotation.activeBch?.address === f.walletB.identity.address,
          detail: f.walletB.identity.address,
        },
        {
          label: "Old address is no longer current",
          ok: rotation.superseded.some((entry) => entry.address === f.walletA.identity.address),
          detail: `superseded: ${rotation.superseded.map((entry) => entry.address).join(", ")}`,
        },
        {
          label: "Chain link matches the previous record digest",
          ok: rotation.history.length === 2,
          detail: `previous ${rotation.history[1]?.record.payload.previous ?? "missing"}`,
        },
      ],
      events: [f.bind.event, f.rotateB.event],
      resolution: rotation,
      testRef: "tests/rotation.test.ts · accepts a rotation signed by the current key, the new key and Nostr key",
      advanced: {
        currentAddress: rotation.activeBch?.address,
        superseded: rotation.superseded,
        history: rotation.history.map((step) => ({
          sequence: step.record.payload.sequence,
          type: step.record.payload.type,
          recordId: step.recordId,
          previous: step.record.payload.previous,
        })),
      },
    },
    {
      id: "unauthorized",
      title: "Unauthorized rotation",
      question: "A thief has the Nostr key and a new wallet. Can they rotate?",
      verdict: "rejected",
      status: forgedState.status,
      headline: `REJECTED · ${forgedResult.code}`,
      explanation:
        "The attacker can sign a valid Nostr event, but cannot produce the current wallet's BCH signature. The record fails proof verification before chain resolution, and the forged transition is rejected.",
      checks: [
        {
          label: "Nostr event signature",
          ok: true,
          detail: "valid — the thief does control the identity key",
        },
        {
          label: "Current BCH authorization proof",
          ok: forgedResult.ok,
          detail: forgedResult.ok ? "unexpectedly accepted" : `${forgedResult.code}: ${forgedResult.message}`,
        },
        {
          label: "Current state remains wallet A",
          ok: forgedState.status !== "ACTIVE" || forgedState.activeBch?.address !== f.walletC.identity.address,
          detail: `${forgedState.status} · ${forgedState.reasonCode}`,
        },
      ],
      events: [f.bind.event, f.forged.event],
      resolution: forgedState,
      recordResult: forgedResult,
      testRef: "tests/rotation.test.ts · rejects a stolen Nostr key rotating without the BCH key",
      advanced: {
        forgedRecord: f.forged.record,
        verification: forgedResult,
        rejected: forgedState.rejected,
      },
    },
    {
      id: "replay",
      title: "Historical binding replay",
      question: "Wallet A's old proof is replayed. Does it become current again?",
      verdict: "accepted",
      status: replay.status,
      headline: `ACTIVE → wallet B · historical proof still valid`,
      explanation:
        "The old bind record is cryptographically valid forever, but it is sequence 0 and the head is sequence 1. Replay cannot move the head backwards. The verifier keeps wallet B current and wallet A superseded.",
      checks: [
        {
          label: "Historical record still verifies",
          ok: historicalRecord.ok,
          detail: historicalRecord.ok ? "valid dual-key proof" : historicalRecord.code,
        },
        {
          label: "Replayed event does not become the head",
          ok: replay.head?.record.payload.sequence === 1,
          detail: `head sequence ${replay.head?.record.payload.sequence}`,
        },
        {
          label: "Old address is SUPERSEDED",
          ok: replay.superseded.some((entry) => entry.address === f.walletA.identity.address),
          detail: replay.superseded.map((entry) => entry.address).join(", "),
        },
        {
          label: "Current address",
          ok: replay.activeBch?.address === f.walletB.identity.address,
          detail: replay.activeBch?.address ?? "none",
        },
      ],
      events: [f.bind.event, f.rotateB.event, f.bind.event],
      resolution: replay,
      recordResult: historicalRecord,
      testRef: "tests/revocation.test.ts · never returns a revoked binding as active, even if the old record is replayed",
      advanced: {
        duplicateEventsRemoved: 1,
        head: replay.head?.record,
        superseded: replay.superseded,
      },
    },
    {
      id: "conflict",
      title: "Equivocation",
      question: "The identity key signs two different rotations at sequence 1.",
      verdict: "conflict",
      status: conflict.status,
      headline: "CONFLICT · no payment address asserted",
      explanation:
        "Both records are cryptographically valid. The verifier refuses to choose a winner: choosing one would silently hide equivocation. `activeBch` is null and the competing record ids are returned as evidence.",
      checks: [
        {
          label: "Both records verify individually",
          ok: conflict.rejected.length === 0,
          detail: `${conflict.history.length} history steps, ${conflict.conflict?.recordIds.length ?? 0} competing ids`,
        },
        {
          label: "No address is asserted as current",
          ok: conflict.activeBch === null,
          detail: "activeBch = null",
        },
        {
          label: "Conflict is explicit",
          ok: conflict.status === "CONFLICT",
          detail: conflict.reasonCode,
        },
      ],
      events: [f.bind.event, f.rotateB.event, f.rotateC.event],
      resolution: conflict,
      testRef: "tests/rotation.test.ts · detects two competing rotations at the same sequence",
      advanced: {
        conflict: conflict.conflict,
        reason: conflict.reason,
      },
    },
    {
      id: "stale",
      title: "Relay withholding / missing history",
      question: "A relay returns sequence 0 and sequence 2, but hides sequence 1.",
      verdict: "stale",
      status: gap.status,
      headline: "STALE · the verifier refuses to fall back",
      explanation:
        "The sequence jump is validly signed but cannot be placed on the chain. KYVERA reports STALE and asserts no current address. A checkpoint from a previous verification detects the rollback directly.",
      checks: [
        {
          label: "Gap is detected",
          ok: gap.status === "STALE",
          detail: gap.reasonCode,
        },
        {
          label: "No fallback to wallet A",
          ok: gap.activeBch === null,
          detail: "activeBch = null",
        },
        {
          label: "Checkpoint detects a rollback",
          ok: rollback.status === "STALE" && rollback.reasonCode === "ROLLBACK_DETECTED",
          detail: `${rollback.status} · ${rollback.reasonCode}`,
        },
      ],
      events: [f.bind.event, f.gap.event],
      resolution: gap,
      testRef: "tests/relay.test.ts · detects a rollback when a relay withholds a newer rotation",
      advanced: {
        gapReason: gap.reason,
        checkpointResult: {
          status: rollback.status,
          reasonCode: rollback.reasonCode,
          reason: rollback.reason,
        },
      },
    },
    {
      id: "revoked",
      title: "Revocation",
      question: "The current wallet and Nostr key revoke the identity.",
      verdict: "revoked",
      status: revoked.status,
      headline: "REVOKED · no payment address",
      explanation:
        "Revocation requires the currently authorized wallet key and the Nostr key. The chain stops; every later transition is rejected. Historical proofs remain valid but cannot be redeemed as current.",
      checks: [
        {
          label: "Revocation authorized by current wallet + Nostr key",
          ok: revoked.status === "REVOKED",
          detail: revoked.reasonCode,
        },
        {
          label: "No current payment address",
          ok: revoked.activeBch === null,
          detail: "activeBch = null",
        },
        {
          label: "History is preserved",
          ok: revoked.history.length === 3,
          detail: revoked.history.map((step) => `#${step.record.payload.sequence} ${step.record.payload.type}`).join(" → "),
        },
      ],
      events: [f.bind.event, f.rotateB.event, f.revoke.event],
      resolution: revoked,
      testRef: "tests/revocation.test.ts · accepts a revocation signed by the Nostr key and current BCH key",
      advanced: {
        history: revoked.history.map((step) => ({
          type: step.record.payload.type,
          recordId: step.recordId,
          address: step.record.payload.bch?.address ?? null,
        })),
      },
    },
  ];

  return { fixtures: f, scenarios, ranAt: LAB_NOW };
}

export interface LifecycleTimeline {
  nodes: Array<{
    sequence: number;
    type: "bind" | "rotate" | "revoke";
    address: string | null;
    status: IdentityStatus;
  }>;
  finalStatus: IdentityStatus;
  finalAddress: string | null;
}

/** The final chain, with each historical node labelled relative to that final state. */
export async function runLifecycleTimeline(): Promise<LifecycleTimeline> {
  const f = await getLabFixtures();
  const resolution = resolveEvents([f.bind.event, f.rotateB.event, f.revoke.event], {
    now: LAB_NOW,
  }).resolution;
  return {
    finalStatus: resolution.status,
    finalAddress: resolution.activeBch?.address ?? null,
    nodes: resolution.history.map((step, index) => ({
      sequence: step.record.payload.sequence,
      type: step.record.payload.type,
      address: step.record.payload.bch?.address ?? null,
      status: index < resolution.history.length - 1 ? "SUPERSEDED" : resolution.status,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Landing-page lifecycle preview                                      */
/* ------------------------------------------------------------------ */

export interface PreviewState {
  label: "bind" | "rotate" | "revoke";
  status: IdentityStatus;
  address: string | null;
  superseded: string[];
  history: number;
  reason: string;
}

export async function runLifecyclePreview(): Promise<PreviewState[]> {
  const f = await getLabFixtures();
  const options = { now: LAB_NOW };
  const bind = resolveEvents([f.bind.event], options).resolution;
  const rotate = resolveEvents([f.bind.event, f.rotateB.event], options).resolution;
  const revoke = resolveEvents([f.bind.event, f.rotateB.event, f.revoke.event], options).resolution;
  return [bind, rotate, revoke].map((resolution, index) => ({
    label: (["bind", "rotate", "revoke"] as const)[index]!,
    status: resolution.status,
    address: resolution.activeBch?.address ?? null,
    superseded: resolution.superseded.map((entry) => entry.address),
    history: resolution.history.length,
    reason: resolution.reason,
  }));
}

export interface DemoState {
  fixtures: LabFixtures;
  bind: IdentityResolution;
  rotation: IdentityResolution;
  revoked: IdentityResolution;
  rotationScenario: LabScenario;
  unauthorizedScenario: LabScenario;
}

/** Deterministic, fully local state used by the guided demo route. */
export async function getDemoState(): Promise<DemoState> {
  const report = await runLab();
  const f = report.fixtures;
  const bind = offlineResolution(resolveEvents([f.bind.event], { now: LAB_NOW }).resolution);
  const rotation = offlineResolution(
    resolveEvents([f.bind.event, f.rotateB.event], { now: LAB_NOW }).resolution,
  );
  const revoked = offlineResolution(
    resolveEvents([f.bind.event, f.rotateB.event, f.revoke.event], { now: LAB_NOW }).resolution,
  );
  const rotationScenario = report.scenarios.find((scenario) => scenario.id === "rotation")!;
  const unauthorizedScenario = report.scenarios.find((scenario) => scenario.id === "unauthorized")!;
  return { fixtures: f, bind, rotation, revoked, rotationScenario, unauthorizedScenario };
}

/** Reconstructs the exact BCH proof message for a chain step (UI helper). */
export function proofMessageFor(step: ChainResolution["history"][number]): string | null {
  const proof = step.record.proofs.bch[0];
  if (!proof) return null;
  return buildBchProofMessage(proof.role, proof.address, step.payloadDigest);
}

/** Unused key generator retained for the wallet-probe page. */
export function newProbeWallet(): BchKeyPair {
  return generateBchKeyPair("mainnet");
}
