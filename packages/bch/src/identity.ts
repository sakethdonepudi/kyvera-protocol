import {
  binToHex,
  generatePrivateKey,
  sha256,
  utf8ToBin,
} from "@bitauth/libauth";
import {
  buildBchProofMessage,
  type BchProofRole,
  type BchIdentity,
  type BchNetwork,
} from "@kyvera/core";
import {
  publicKeyFromPrivateKey,
  publicKeyToAddress,
  verifyBitcoinMessageSignature,
  decodeP2pkhAddress,
  sameSecp256k1Key,
} from "./signmessage.js";

export interface BchKeyPair {
  privateKey: Uint8Array;
  publicKey: string;
  identity: BchIdentity;
}

export function bchKeyPairFromPrivateKey(privateKey: Uint8Array, network: BchNetwork = "mainnet"): BchKeyPair {
  if (privateKey.length !== 32) throw new Error("BCH private key must be 32 bytes");
  const publicKey = publicKeyFromPrivateKey(privateKey);
  const publicKeyHex = binToHex(publicKey);
  const address = publicKeyToAddress(publicKey, network);
  return {
    privateKey,
    publicKey: publicKeyHex,
    identity: { address, network, publicKey: publicKeyHex },
  };
}

export function generateBchKeyPair(network: BchNetwork = "mainnet"): BchKeyPair {
  const privateKey = generatePrivateKey(() => globalThis.crypto.getRandomValues(new Uint8Array(32)));
  if (typeof privateKey === "string") throw new Error(privateKey);
  return bchKeyPairFromPrivateKey(privateKey, network);
}

/** Deterministic, unspendable key material for tests and published vectors. */
export function testBchKeyPair(label: string, network: BchNetwork = "mainnet"): BchKeyPair {
  return bchKeyPairFromPrivateKey(sha256.hash(utf8ToBin(`kyvera test key: ${label}`)), network);
}

export interface BchProofCheck {
  ok: boolean;
  code: string;
  message: string;
  /** Recovered compressed public key (lowercase hex) when verification succeeded. */
  publicKey?: string;
}

/**
 * Verifies a BCH proof against the identity that is authorized to make it.
 * `expectedPublicKey` may be omitted for revocations, where the payload carries
 * no BCH identity and the address comes from the preceding chain record.
 */
export function verifyBchIdentityProof(input: {
  expectedAddress: string;
  expectedPublicKey?: string;
  role: BchProofRole;
  payloadDigest: string;
  signature: string;
  nostrPublicKey?: string;
}): BchProofCheck {
  const message = buildBchProofMessage(input.role, input.expectedAddress, input.payloadDigest);
  const check = verifyBitcoinMessageSignature(input.expectedAddress, message, input.signature);
  if (!check.ok) return check;

  const decoded = decodeP2pkhAddress(input.expectedAddress);
  if (typeof decoded === "string") {
    return { ok: false, code: "BCH_ADDRESS_INVALID", message: decoded };
  }

  if (input.expectedPublicKey) {
    if (check.publicKey !== input.expectedPublicKey) {
      return {
        ok: false,
        code: "BCH_PROOF_KEY_MISMATCH",
        message: "proof signature was not produced by the declared BCH public key",
      };
    }
    const derived = publicKeyToAddress(hexToBytes(input.expectedPublicKey), decoded.network);
    if (derived !== input.expectedAddress) {
      return {
        ok: false,
        code: "BCH_PUBLIC_KEY_ADDRESS_MISMATCH",
        message: "declared BCH public key does not hash to the declared address",
      };
    }
    if (input.nostrPublicKey && sameSecp256k1Key(input.expectedPublicKey, input.nostrPublicKey)) {
      return {
        ok: false,
        code: "KEY_REUSE",
        message: "the BCH and Nostr identities use the same secp256k1 key",
      };
    }
  }

  return { ok: true, code: "OK", message: "ok", publicKey: check.publicKey };
}

export function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) throw new Error("invalid hex");
  const out = new Uint8Array(hex.length / 2);
  for (let index = 0; index < out.length; index += 1) {
    out[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return out;
}
