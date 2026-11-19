import { describe, expect, it } from "vitest";
import { hexToBytes, signBitcoinMessage, testBchKeyPair } from "@kyvera/bch";
import {
  WizardConnectAdapter,
  createKyveraSigningRequest,
  verifyManualSignature,
} from "@kyvera/wallet-bch";

const DIGEST = "ab".repeat(32);

describe("@kyvera/wallet-bch", () => {
  it("verifies a real signmessage proof against the declared address", () => {
    const key = testBchKeyPair("wallet-proof");
    const request = createKyveraSigningRequest({
      role: "new",
      address: key.identity.address,
      payloadDigest: DIGEST,
    });
    const signature = signBitcoinMessage(key.privateKey, request.message);
    const result = verifyManualSignature({
      address: key.identity.address,
      message: request.message,
      signature,
      expectedNetwork: "mainnet",
    });
    expect(result.ok).toBe(true);
    expect(result.address).toBe(key.identity.address);
    expect(result.publicKey).toBeDefined();
  });

  it("rejects a signature that recovers to a different address", () => {
    const key = testBchKeyPair("wallet-owner");
    const attacker = testBchKeyPair("wallet-attacker");
    const request = createKyveraSigningRequest({
      role: "new",
      address: key.identity.address,
      payloadDigest: DIGEST,
    });
    const signature = signBitcoinMessage(attacker.privateKey, request.message);
    const result = verifyManualSignature({
      address: key.identity.address,
      message: request.message,
      signature,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("BCH_SIGNATURE_NOT_BY_ADDRESS");
  });

  it("rejects malformed signatures and wrong networks", () => {
    const key = testBchKeyPair("wallet-errors", "mainnet");
    const chipnet = testBchKeyPair("wallet-errors", "chipnet");
    const request = createKyveraSigningRequest({
      role: "new",
      address: key.identity.address,
      payloadDigest: DIGEST,
    });
    const malformed = verifyManualSignature({
      address: key.identity.address,
      message: request.message,
      signature: "A".repeat(88),
    });
    expect(malformed.ok).toBe(false);
    expect(malformed.code).toBe("BCH_SIGNATURE_INVALID");

    const wrongNetwork = verifyManualSignature({
      address: chipnet.identity.address,
      message: request.message,
      signature: "A".repeat(88),
      expectedNetwork: "mainnet",
    });
    expect(wrongNetwork.ok).toBe(false);
    expect(wrongNetwork.code).toBe("BCH_NETWORK_MISMATCH");
  });

  it("reports WizardConnect address capability but not automatic signing", async () => {
    const key = testBchKeyPair("wizard-connect");
    const adapter = new WizardConnectAdapter({
      manager: { getPubkey: () => hexToBytes(key.publicKey) },
      network: "mainnet",
      name: "Paytaca",
    });
    const connection = await adapter.connect();
    expect(connection.address).toBe(key.identity.address);
    expect(connection.capabilities).toMatchObject({
      connect: true,
      address: true,
      signMessage: false,
    });
    expect(adapter.signMessage).toBeUndefined();
    expect(await adapter.getAddress()).toBe(key.identity.address);
  });
});
