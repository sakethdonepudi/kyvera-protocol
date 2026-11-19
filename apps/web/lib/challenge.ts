import type { KyveraEvent } from "@kyvera/core";
import type { NostrSigner } from "@kyvera/nostr";
import {
  AuthRequestService,
  buildAuthRequestEvent,
  resolveEvents,
  validateAppSession,
  verifyEventRecord,
  type AppSession,
  type AuthCheck,
  type AuthRequest,
  type IdentityResolution,
  type SessionCheck,
} from "@kyvera/verifier";
import { LAB_NOW, getLabFixtures, type LabFixtures } from "@/lib/lab";

export const CHALLENGE_STAGES = ["Bind", "Verify", "Authenticate", "Rotate", "Prove"] as const;
export type ChallengeStage = (typeof CHALLENGE_STAGES)[number];

export interface ChallengeCheck {
  label: string;
  ok: boolean;
  detail: string;
}

export interface ChallengeResult {
  pass: boolean;
  headline: string;
  checks: ChallengeCheck[];
  evidence?: unknown;
}

function localResolution(
  events: KyveraEvent[],
  now = LAB_NOW,
): IdentityResolution {
  const resolution = resolveEvents(events, { now }).resolution;
  return {
    ...resolution,
    assurance: "FULL",
    sync: { relays: [], responded: 0, total: 0, assurance: "FULL" },
    sources: {},
  };
}

export interface ChallengeAuthEvidence {
  request: AuthRequest;
  check: AuthCheck;
  session?: AppSession;
  replay: AuthCheck;
  unauthorized: AuthCheck;
  sessionAfterRotation?: SessionCheck;
}

export interface ChallengeDemo {
  fixtures: LabFixtures;
  bind: IdentityResolution;
  rotation: IdentityResolution;
  revoked: IdentityResolution;
  bindProof: ReturnType<typeof verifyEventRecord>;
  rotateProof: ReturnType<typeof verifyEventRecord>;
  forgedProof: ReturnType<typeof verifyEventRecord>;
  auth: ChallengeAuthEvidence;
  results: Record<ChallengeStage, ChallengeResult>;
}

export async function runChallengeAuth(input: {
  resolution: IdentityResolution;
  signer: NostrSigner;
  origin: string;
  domain?: string;
  now?: number;
  sessionId?: string;
}): Promise<{ request: AuthRequest; check: AuthCheck; replay: AuthCheck; session?: AppSession }> {
  const now = input.now ?? Math.floor(Date.now() / 1000);
  const service = new AuthRequestService({
    origin: input.origin,
    domain: input.domain,
    ttlSeconds: 120,
    sessionTtlSeconds: 900,
    now: () => now,
    sessionId: input.sessionId,
  });
  const request = service.issue({
    expectedSubject: input.resolution.subject,
    expectedAddress: input.resolution.activeBch?.address ?? null,
  });
  const event = await buildAuthRequestEvent({ request, signer: input.signer, createdAt: now });
  const first = service.verify(event, input.resolution);
  const replay = service.verify(event, input.resolution);
  return { request, check: first.check, session: first.session, replay: replay.check };
}

export function proveSuperseded(
  resolution: IdentityResolution,
  oldAddress: string,
  historicalEvent: KyveraEvent | undefined,
  now = Math.floor(Date.now() / 1000),
): ChallengeResult {
  const historical = historicalEvent ? verifyEventRecord(historicalEvent, { now }) : null;
  const superseded = resolution.superseded.find((entry) => entry.address === oldAddress);
  const current = resolution.activeBch?.address ?? null;
  const checks: ChallengeCheck[] = [
    {
      label: "Old wallet proof still verifies",
      ok: historical?.ok === true,
      detail: historical ? historical.code : "no historical record",
    },
    {
      label: "Old wallet is not the current destination",
      ok: current !== null && current !== oldAddress,
      detail: current ?? "no active address",
    },
    {
      label: "Old wallet is reported superseded",
      ok: Boolean(superseded),
      detail: superseded ? `sequence #${superseded.sequence}` : "not superseded in this chain",
    },
    {
      label: "Current authorization is still ACTIVE",
      ok: resolution.status === "ACTIVE",
      detail: `${resolution.status} · ${resolution.reason}`,
    },
    {
      label: "Full relay agreement for current state",
      ok: resolution.assurance === "FULL",
      detail: resolution.assurance,
    },
  ];
  return {
    pass: checks.every((check) => check.ok),
    headline:
      resolution.assurance !== "FULL"
        ? "Historical proof is valid, but current authorization is not established under partial relay agreement."
        : checks.every((check) => check.ok)
          ? "Historical proof valid. Current authorization moved."
          : "This chain does not yet demonstrate supersession.",
    checks,
    evidence: {
      oldAddress,
      current,
      superseded,
      historical: historical
        ? { ok: historical.ok, code: historical.code, recordId: historical.recordId }
        : null,
    },
  };
}

export async function getChallengeDemo(): Promise<ChallengeDemo> {
  const f = await getLabFixtures();
  const bind = localResolution([f.bind.event]);
  const rotation = localResolution([f.bind.event, f.rotateB.event]);
  const revoked = localResolution([f.bind.event, f.rotateB.event, f.revoke.event]);
  const bindProof = verifyEventRecord(f.bind.event, { now: LAB_NOW });
  const rotateProof = verifyEventRecord(f.rotateB.event, { now: LAB_NOW });
  const forgedProof = verifyEventRecord(f.forged.event, { now: LAB_NOW });

  const origin = "https://challenge.kyvera.example";
  const service = new AuthRequestService({
    origin,
    domain: "challenge.kyvera.example",
    ttlSeconds: 120,
    sessionTtlSeconds: 900,
    now: () => LAB_NOW,
    sessionId: "ab".repeat(32),
  });
  const request = service.issue({
    expectedSubject: f.subject,
    expectedAddress: f.walletA.identity.address,
  });
  const event = await buildAuthRequestEvent({ request, signer: f.signer, createdAt: LAB_NOW });
  const first = service.verify(event, bind);
  const replay = service.verify(event, bind);

  const forgedResolution = localResolution([f.bind.event, f.forged.event]);
  const unauthorizedService = new AuthRequestService({
    origin,
    domain: "challenge.kyvera.example",
    ttlSeconds: 120,
    sessionTtlSeconds: 900,
    now: () => LAB_NOW,
    sessionId: "cd".repeat(32),
  });
  const unauthorizedRequest = unauthorizedService.issue({
    expectedSubject: f.subject,
    expectedAddress: f.walletC.identity.address,
  });
  const unauthorizedEvent = await buildAuthRequestEvent({
    request: unauthorizedRequest,
    signer: f.signer,
    createdAt: LAB_NOW,
  });
  const unauthorized = unauthorizedService.verify(unauthorizedEvent, forgedResolution);

  const sessionAfterRotation = first.session
    ? validateAppSession(first.session, rotation, LAB_NOW)
    : undefined;

  const auth: ChallengeAuthEvidence = {
    request,
    check: first.check,
    session: first.session,
    replay: replay.check,
    unauthorized: unauthorized.check,
    sessionAfterRotation,
  };

  const results: Record<ChallengeStage, ChallengeResult> = {
    Bind: {
      pass:
        bindProof.ok === true &&
        bind.status === "ACTIVE" &&
        bind.activeBch?.address === f.walletA.identity.address,
      headline: "Wallet A and Nostr 0x… are now one identity.",
      checks: [
        {
          label: "BCH proof verifies",
          ok: bindProof.ok === true,
          detail: bindProof.ok ? "signmessage recovery matched wallet A" : bindProof.code,
        },
        {
          label: "Nostr event signature verifies",
          ok: bindProof.ok === true,
          detail: bindProof.ok ? "BIP-340 signature accepted" : bindProof.message,
        },
        {
          label: "Genesis chain is ACTIVE",
          ok: bind.status === "ACTIVE",
          detail: `${bind.status} · ${bind.reason}`,
        },
        {
          label: "Current address is wallet A",
          ok: bind.activeBch?.address === f.walletA.identity.address,
          detail: bind.activeBch?.address ?? "none",
        },
      ],
      evidence: { recordId: f.bind.recordId, digest: f.bind.payloadDigest, eventId: f.bind.event.id },
    },
    Verify: {
      pass:
        bindProof.ok === true &&
        bind.history.length === 1 &&
        bind.assurance === "FULL",
      headline: "The identity resolves from signed records, not a database.",
      checks: [
        {
          label: "Both proofs checked independently",
          ok: bindProof.ok === true,
          detail: bindProof.ok ? "BCH + Nostr" : bindProof.code,
        },
        {
          label: "Chain starts at genesis",
          ok: bind.history.length === 1,
          detail: `${bind.history.length} record(s)`,
        },
        {
          label: "No relay dependency for the verdict",
          ok: bind.assurance === "FULL",
          detail: "deterministic local resolution",
        },
        {
          label: "No rejected records in the chain",
          ok: bind.rejected.length === 0,
          detail: `${bind.rejected.length} rejected`,
        },
      ],
      evidence: {
        subject: f.subject,
        npub: f.npub,
        recordId: f.bind.recordId,
        digest: f.bind.payloadDigest,
      },
    },
    Authenticate: {
      pass:
        auth.check.authenticated === true &&
        Boolean(auth.session) &&
        auth.replay.code === "UNKNOWN_CHALLENGE" &&
        auth.unauthorized.code === "ADDRESS_MISMATCH",
      headline: "An independent relying party can issue a session without KYVERA.",
      checks: [
        {
          label: "Challenge signature authenticates",
          ok: auth.check.authenticated === true,
          detail: `${auth.check.code} · ${auth.check.message}`,
        },
        {
          label: "Session issued only after verification",
          ok: Boolean(auth.session),
          detail: auth.session
            ? `TTL ${auth.session.expiresAt - auth.session.issuedAt}s`
            : "none",
        },
        {
          label: "Replay is rejected",
          ok: auth.replay.code === "UNKNOWN_CHALLENGE",
          detail: `${auth.replay.code} · ${auth.replay.message}`,
        },
        {
          label: "Unauthorized rotation cannot sign in",
          ok: auth.unauthorized.code === "ADDRESS_MISMATCH",
          detail: `${auth.unauthorized.code} · ${auth.unauthorized.message}`,
        },
      ],
      evidence: {
        origin: auth.request.origin,
        sessionId: auth.request.sessionId,
        challenge: auth.request.challenge,
        requestDigest: auth.session?.requestDigest,
        token: auth.session?.token,
      },
    },
    Rotate: {
      pass:
        rotateProof.ok === true &&
        rotation.status === "ACTIVE" &&
        rotation.activeBch?.address === f.walletB.identity.address &&
        rotation.superseded.some((entry) => entry.address === f.walletA.identity.address) &&
        forgedProof.ok === false,
      headline: "Wallet A authorized wallet B. A thief could not.",
      checks: [
        {
          label: "Rotation record verifies",
          ok: rotateProof.ok === true,
          detail: rotateProof.ok ? "old key, new key and Nostr signature" : rotateProof.code,
        },
        {
          label: "Wallet B is current",
          ok: rotation.activeBch?.address === f.walletB.identity.address,
          detail: rotation.activeBch?.address ?? "none",
        },
        {
          label: "Wallet A is superseded",
          ok: rotation.superseded.some((entry) => entry.address === f.walletA.identity.address),
          detail: `${rotation.superseded.length} superseded address(es)`,
        },
        {
          label: "Unauthorized rotation is rejected",
          ok: forgedProof.ok === false,
          detail: forgedProof.ok ? "forged record accepted" : forgedProof.code,
        },
      ],
      evidence: {
        rotateRecordId: f.rotateB.recordId,
        newAddress: f.walletB.identity.address,
        rejectedRecordId: f.forged.recordId,
      },
    },
    Prove: {
      pass:
        bindProof.ok === true &&
        rotation.activeBch?.address !== f.walletA.identity.address &&
        rotation.superseded.some((entry) => entry.address === f.walletA.identity.address) &&
        auth.sessionAfterRotation?.code === "SESSION_ADDRESS_CHANGED",
      headline: "Wallet A's proof is still true. It is simply no longer authorized.",
      checks: [
        {
          label: "Historical wallet A proof still verifies",
          ok: bindProof.ok === true,
          detail: bindProof.ok ? "cryptographically valid forever" : bindProof.code,
        },
        {
          label: "Wallet A is no longer current",
          ok: rotation.activeBch?.address !== f.walletA.identity.address,
          detail: rotation.activeBch?.address ?? "none",
        },
        {
          label: "Wallet A is explicitly superseded",
          ok: rotation.superseded.some((entry) => entry.address === f.walletA.identity.address),
          detail: f.walletA.identity.address,
        },
        {
          label: "Existing session is invalidated",
          ok: auth.sessionAfterRotation?.code === "SESSION_ADDRESS_CHANGED",
          detail: auth.sessionAfterRotation
            ? `${auth.sessionAfterRotation.code} · ${auth.sessionAfterRotation.message}`
            : "no session",
        },
      ],
      evidence: {
        historicalRecord: f.bind.recordId,
        currentAddress: rotation.activeBch?.address,
        oldAddress: f.walletA.identity.address,
        sessionAfterRotation: auth.sessionAfterRotation,
      },
    },
  };

  return { fixtures: f, bind, rotation, revoked, bindProof, rotateProof, forgedProof, auth, results };
}
