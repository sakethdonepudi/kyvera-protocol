import { describe, expect, it } from "vitest";
import { verifyBitcoinMessageSignature } from "@kyvera/bch";

/**
 * Independent interoperability vector.
 *
 * Source: nostr-bch-bind v1 reference implementation and test vectors,
 * https://gist.github.com/apeirs/aff6b63931c57e1a0729a72770abb325
 * (file bind-vectors.json, vector "valid signmessage binding").
 *
 * KYVERA implements the same wallet signmessage convention. Verifying a
 * signature produced by a different independently-written implementation is
 * evidence that the BCH proof format is interoperable, not merely self-tested.
 */
describe("BCH signmessage interoperability", () => {
  it("verifies a signature published by the nostr-bch-bind reference implementation", () => {
    const address = "bitcoincash:qzavy69mgnnrzz5ua0td95ee4n298dvs2uuyrtlwen";
    const message = [
      "nostr-bch-bind:v1",
      "npub:3a5bce3ac4e98bbc0b231ebbab2647bdacef00478e6b9515c853806e303ced94",
      "bch:bitcoincash:qzavy69mgnnrzz5ua0td95ee4n298dvs2uuyrtlwen",
      "created:1794000000",
    ].join("\n");
    const signature =
      "Hxa2Bc7VquIL7IWRY0r9IXxrqURhqzjZRI0Q306JLroCOOm/4M+iT8HkXDUiSkbR9DF6loHGB5TA7qDfoCH5p9A=";

    const result = verifyBitcoinMessageSignature(address, message, signature);
    expect(result).toMatchObject({ ok: true, address });
    expect(result.publicKey).toBeDefined();
  });

  it("rejects that signature when the message is changed", () => {
    const address = "bitcoincash:qzavy69mgnnrzz5ua0td95ee4n298dvs2uuyrtlwen";
    const signature =
      "Hxa2Bc7VquIL7IWRY0r9IXxrqURhqzjZRI0Q306JLroCOOm/4M+iT8HkXDUiSkbR9DF6loHGB5TA7qDfoCH5p9A=";
    const result = verifyBitcoinMessageSignature(address, "different message", signature);
    expect(result.ok).toBe(false);
  });
});
