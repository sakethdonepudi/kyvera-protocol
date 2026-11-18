import { describe, expect, it } from "vitest";
import {
  buildBchProofMessage,
  digestOf,
  sealRecord,
  type SignedRecord,
} from "@kyvera/core";
import {
  bchKeyPairFromPrivateKey,
  signBitcoinMessage,
  testBchKeyPair,
  verifyBitcoinMessageSignature,
} from "@kyvera/bch";
import { createBindRecord, verifyEventRecord, verifyRecord } from "@kyvera/verifier";
import {
  T0,
  clone,
  eventWithContent,
  makeIdentity,
  rawEvent,
  reSign,
  testNostrSecret,
  verifyAt,
} from "./helpers.js";
import { signerFromSecretKey } from "@kyvera/nostr";

const NOW = T0 + 3600;

describe("dual-key binding", () => {
  it("accepts a valid bind signed by both independent keys", async () => {
    const identity = await makeIdentity("binding-valid");
    const result = verifyAt(identity.bind.event, NOW);
    expect(result.ok).toBe(true);
    expect(result.recordId).toBe(identity.bind.recordId);
  });

  it("uses distinct secp256k1 keys for Nostr and BCH", async () => {
    const identity = await makeIdentity("binding-distinct");
    expect(identity.subject).not.toBe(identity.bchA.publicKey.slice(2));
  });

  it("rejects a BCH proof whose signature was altered", async () => {
    const identity = await makeIdentity("binding-bad-bch-sig");
    const record = clone(identity.bind.record);
    const signature = record.proofs.bch[0]!.signature;
    record.proofs.bch[0]!.signature = `${signature.slice(0, 10)}A${signature.slice(11)}`;
    const event = await reSign(record, identity.secret);
    const result = verifyAt(event, NOW);
    expect(result.ok).toBe(false);
    expect(["BCH_SIGNATURE_INVALID", "BCH_SIGNATURE_NOT_BY_ADDRESS"]).toContain(result.code);
  });

  it("rejects a BCH proof produced by a different wallet", async () => {
    const identity = await makeIdentity("binding-wrong-wallet");
    const record = clone(identity.bind.record);
    const other = testBchKeyPair("binding-wrong-wallet intruder");
    record.payload.bch = other.identity;
    record.proofs.bch[0]!.address = other.identity.address;
    record.proofs.bch[0]!.signature = signBitcoinMessage(
      identity.bchA.privateKey,
      buildBchProofMessage("new", other.identity.address, digestOf(record.payload)),
    );
    const event = await reSign(record, identity.secret);
    const result = verifyAt(event, NOW);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("BCH_SIGNATURE_NOT_BY_ADDRESS");
  });

  it("rejects a signature over a different payload digest", async () => {
    const identity = await makeIdentity("binding-mismatched-payload");
    const record = clone(identity.bind.record);
    const wrongDigest = "11".repeat(32);
    record.proofs.bch[0]!.signature = signBitcoinMessage(
      identity.bchA.privateKey,
      buildBchProofMessage("new", identity.bchA.identity.address, wrongDigest),
    );
    const event = await reSign(record, identity.secret);
    const result = verifyAt(event, NOW);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("BCH_SIGNATURE_NOT_BY_ADDRESS");
  });

  it("rejects a declared BCH key that does not control the address", async () => {
    const identity = await makeIdentity("binding-key-address-mismatch");
    const record = clone(identity.bind.record);
    record.payload.bch!.publicKey = identity.bchB.publicKey;
    record.proofs.bch[0]!.signature = signBitcoinMessage(
      identity.bchA.privateKey,
      buildBchProofMessage("new", identity.bchA.identity.address, digestOf(record.payload)),
    );
    const event = await reSign(record, identity.secret);
    const result = verifyAt(event, NOW);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("BCH_PROOF_KEY_MISMATCH");
  });

  it("rejects a malformed subject public key", async () => {
    const identity = await makeIdentity("binding-malformed-pubkey");
    const record = clone(identity.bind.record);
    record.payload.subject = record.payload.subject.toUpperCase();
    const result = verifyRecord(record, { now: NOW });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("SUBJECT_INVALID");
  });

  it("rejects an unsupported signature format", async () => {
    const identity = await makeIdentity("binding-bad-format");
    const record = clone(identity.bind.record);
    record.proofs.bch[0]!.signature = "not-a-signature";
    const result = verifyRecord(record, { now: NOW });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("BCH_PROOF_SIGNATURE_SHAPE");
  });

  it("rejects an event whose content was edited after signing", async () => {
    const identity = await makeIdentity("binding-edited-event");
    const event = clone(identity.bind.event);
    event.created_at += 1;
    const result = verifyAt(event, NOW);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("NOSTR_SIGNATURE_INVALID");
  });

  it("rejects an invalid Nostr signature", async () => {
    const identity = await makeIdentity("binding-bad-nostr");
    const event = clone(identity.bind.event);
    event.sig = "00".repeat(64);
    const result = verifyAt(event, NOW);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("NOSTR_SIGNATURE_INVALID");
  });

  it("rejects non-canonical JSON even with a valid Nostr signature", async () => {
    const identity = await makeIdentity("binding-non-canonical");
    const content = identity.bind.event.content.replace("{", '{  ');
    const event = eventWithContent(identity.bind.event, content, identity.secret);
    const result = verifyAt(event, NOW);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("CONTENT_NOT_CANONICAL");
  });

  it("rejects a record issued in the future", async () => {
    const identity = await makeIdentity("binding-future", NOW + 10_000);
    const result = verifyAt(identity.bind.event, NOW);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("ISSUED_IN_FUTURE");
  });

  it("rejects reuse of the Nostr key as the BCH key", async () => {
    const secret = testNostrSecret("binding-key-reuse");
    const signer = signerFromSecretKey(secret);
    const subject = await signer.getPublicKey();
    const reused = bchKeyPairFromPrivateKey(secret);
    const created = await createBindRecord({
      signer,
      bchPrivateKey: reused.privateKey,
      bch: reused.identity,
      issuedAt: T0,
    });
    const result = verifyEventRecord(created.event, { now: NOW });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("KEY_REUSE");
  });

  it("rejects a binding on the wrong network", async () => {
    const identity = await makeIdentity("binding-network");
    const result = verifyEventRecord(identity.bind.event, { now: NOW, network: "chipnet" });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("BCH_NETWORK_UNEXPECTED");
  });

  it("recovers the exact signing key from a wallet-format signature", async () => {
    const key = testBchKeyPair("binding-recovery");
    const message = buildBchProofMessage("new", key.identity.address, "ab".repeat(32));
    const signature = signBitcoinMessage(key.privateKey, message);
    const check = verifyBitcoinMessageSignature(key.identity.address, message, signature);
    expect(check.ok).toBe(true);
    expect(check.publicKey).toBe(key.publicKey);
  });

  it("rejects a valid BCH signature presented for a different address", async () => {
    const a = testBchKeyPair("binding-cross-address-a");
    const b = testBchKeyPair("binding-cross-address-b");
    const signature = signBitcoinMessage(a.privateKey, "hello");
    const check = verifyBitcoinMessageSignature(b.identity.address, "hello", signature);
    expect(check.ok).toBe(false);
  });

  it("requires exactly one new-key proof on bind", async () => {
    const identity = await makeIdentity("binding-proof-count");
    const payload = clone(identity.bind.record.payload);
    const record: SignedRecord = sealRecord(payload, []);
    const event = rawEvent(record, identity.secret);
    const result = verifyAt(event, NOW);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("PROOF_ROLE_MATRIX");
  });
});
