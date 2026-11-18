/**
 * Generates deterministic cross-implementation test vectors.
 *
 *   pnpm build && pnpm vectors
 *
 * Every value in tests/fixtures/vectors.json is derived from unspendable test
 * keys (sha256 of a label) and fixed nonces, so the file is reproducible.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { schnorr } from "@noble/curves/secp256k1";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { binToHex, sha256, utf8ToBin } from "@bitauth/libauth";
import {
  buildBchProofMessage,
  canonicalize,
  sha256Hex,
  type KyveraEvent,
} from "@kyvera/core";
import {
  hashBitcoinMessage,
  signBitcoinMessage,
  testBchKeyPair,
  verifyBitcoinMessageSignature,
} from "@kyvera/bch";
import { buildRecordEvent, type NostrSigner } from "@kyvera/nostr";
import { getEventHash } from "nostr-tools/pure";
import {
  createBindRecord,
  createRevokeRecord,
  createRotateRecord,
  resolveEvents,
  verifyEventRecord,
} from "@kyvera/verifier";

const T = 1_794_000_000;
const NOW = T + 3_600;

function testNostrSecret(label: string): Uint8Array {
  return sha256.hash(utf8ToBin(`kyvera test nostr key: ${label}`));
}

/**
 * BIP-340 signing uses auxiliary randomness by default. Vectors use a fixed
 * all-zero aux value so regenerating the file is byte-identical; verification
 * is identical to any other Schnorr signature.
 */
function deterministicSigner(secret: Uint8Array): NostrSigner {
  const pubkey = bytesToHex(schnorr.getPublicKey(secret));
  return {
    getPublicKey: async () => pubkey,
    signEvent: async (template) => {
      const event = {
        kind: template.kind,
        created_at: template.created_at,
        tags: template.tags,
        content: template.content,
        pubkey,
      };
      const id = getEventHash(event);
      const sig = bytesToHex(schnorr.sign(hexToBytes(id), secret, new Uint8Array(32)));
      return { ...event, id, sig };
    },
  };
}

async function main() {
  const aliceSecret = testNostrSecret("alice");
  const aliceSigner = deterministicSigner(aliceSecret);
  const subject = await aliceSigner.getPublicKey();
  const bchA = testBchKeyPair("alice bch A");
  const bchB = testBchKeyPair("alice bch B");
  const bchC = testBchKeyPair("alice bch C");

  const bind = await createBindRecord({
    signer: aliceSigner,
    bchPrivateKey: bchA.privateKey,
    bch: bchA.identity,
    issuedAt: T,
    nonce: "01".repeat(32),
  });
  const rotation = await createRotateRecord({
    signer: aliceSigner,
    previous: { recordId: bind.recordId, sequence: 0, bch: bchA.identity },
    currentBchPrivateKey: bchA.privateKey,
    newBchPrivateKey: bchB.privateKey,
    newBch: bchB.identity,
    issuedAt: T + 60,
    nonce: "02".repeat(32),
  });
  const revocation = await createRevokeRecord({
    signer: aliceSigner,
    previous: { recordId: rotation.recordId, sequence: 1, bch: bchB.identity },
    currentBchPrivateKey: bchB.privateKey,
    issuedAt: T + 120,
    nonce: "03".repeat(32),
  });

  const expired = await createBindRecord({
    signer: deterministicSigner(testNostrSecret("expired")),
    bchPrivateKey: testBchKeyPair("expired bch").privateKey,
    bch: testBchKeyPair("expired bch").identity,
    issuedAt: T,
    expiresAt: T + 100,
    nonce: "04".repeat(32),
  });

  const tampered = JSON.parse(JSON.stringify(bind.record));
  const sig = tampered.proofs.bch[0].signature as string;
  tampered.proofs.bch[0].signature = `${sig.slice(0, 10)}A${sig.slice(11)}`;
  const tamperedBuilt = await buildRecordEvent(tampered, aliceSigner);
  if (!tamperedBuilt.event) throw new Error(tamperedBuilt.message);

  const bchMessage = buildBchProofMessage("new", bchA.identity.address, bind.payloadDigest);
  const bchSignature = signBitcoinMessage(bchA.privateKey, bchMessage);

  const canonicalSamples = [
    { name: "key order", value: { b: 2, a: 1 } },
    { name: "nested", value: { z: [3, { y: true, x: null }], a: "text" } },
    { name: "unicode NFC", value: { name: "Kyve\u0301ra" } },
  ].map((sample) => {
    const canonical = canonicalize(sample.value);
    return { ...sample, canonical, sha256: sha256Hex(new TextEncoder().encode(canonical)) };
  });

  const chains = [
    {
      name: "bind only",
      events: [bind.event],
      now: NOW,
      expect: { status: "ACTIVE", sequence: 0, address: bchA.identity.address },
    },
    {
      name: "rotation supersedes the old address",
      events: [bind.event, rotation.event],
      now: NOW,
      expect: { status: "ACTIVE", sequence: 1, address: bchB.identity.address },
    },
    {
      name: "revocation wins over a replayed binding",
      events: [bind.event, rotation.event, revocation.event, bind.event],
      now: NOW,
      expect: { status: "REVOKED", sequence: 2, address: null },
    },
    {
      name: "missing genesis is stale",
      events: [rotation.event],
      now: NOW,
      expect: { status: "STALE", sequence: null, address: null },
    },
    {
      name: "competing rotations conflict",
      events: [
        bind.event,
        (
          await createRotateRecord({
            signer: aliceSigner,
            previous: { recordId: bind.recordId, sequence: 0, bch: bchA.identity },
            currentBchPrivateKey: bchA.privateKey,
            newBchPrivateKey: bchC.privateKey,
            newBch: bchC.identity,
            issuedAt: T + 61,
            nonce: "05".repeat(32),
          })
        ).event,
        rotation.event,
      ],
      now: NOW,
      expect: { status: "CONFLICT", sequence: null, address: null },
    },
    {
      name: "expired binding",
      events: [expired.event],
      now: T + 200,
      expect: { status: "EXPIRED", sequence: 0, address: expired.record.payload.bch!.address },
    },
  ];

  const vectors = {
    spec: "kyvera-test-vectors-v1",
    note:
      "Keys are unspendable and derived from sha256('kyvera test key: <label>'). Never send funds to these addresses.",
    network: "mainnet",
    subject,
    bch: {
      A: bchA.identity,
      B: bchB.identity,
      C: bchC.identity,
    },
    canonical: canonicalSamples,
    bchMessage: {
      message: bchMessage,
      hash: binToHex(hashBitcoinMessage(bchMessage)),
      address: bchA.identity.address,
      signature: bchSignature,
    },
    records: [
      {
        name: "valid bind",
        event: bind.event,
        recordId: bind.recordId,
        payloadDigest: bind.payloadDigest,
        verify: { ok: true },
      },
      {
        name: "valid rotation",
        event: rotation.event,
        recordId: rotation.recordId,
        payloadDigest: rotation.payloadDigest,
        verify: { ok: true },
      },
      {
        name: "valid revocation",
        event: revocation.event,
        recordId: revocation.recordId,
        payloadDigest: revocation.payloadDigest,
        verify: { ok: true },
      },
      {
        name: "tampered BCH proof",
        event: tamperedBuilt.event,
        verify: { ok: false, code: "BCH_SIGNATURE_NOT_BY_ADDRESS" },
      },
    ],
    chains,
  };

  // Sanity-check every vector before writing it.
  for (const record of vectors.records) {
    const result = verifyEventRecord(record.event as KyveraEvent, { now: NOW });
    if (result.ok !== record.verify.ok) {
      throw new Error(`vector ${record.name} produced ${result.code}`);
    }
    if (!record.verify.ok && result.code !== record.verify.code) {
      throw new Error(`vector ${record.name} produced ${result.code}, expected ${record.verify.code}`);
    }
  }
  for (const chain of chains) {
    const { resolution } = resolveEvents(chain.events as KyveraEvent[], { now: chain.now });
    if (resolution.status !== chain.expect.status) {
      throw new Error(`chain ${chain.name} resolved ${resolution.status}, expected ${chain.expect.status}`);
    }
  }
  const messageCheck = verifyBitcoinMessageSignature(
    bchA.identity.address,
    bchMessage,
    bchSignature,
  );
  if (!messageCheck.ok) throw new Error("BCH message vector does not verify");

  const out = fileURLToPath(new URL("../tests/fixtures/vectors.json", import.meta.url));
  mkdirSync(fileURLToPath(new URL("../tests/fixtures", import.meta.url)), { recursive: true });
  writeFileSync(out, `${JSON.stringify(vectors, null, 2)}\n`);
  process.stdout.write(`wrote ${out}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
