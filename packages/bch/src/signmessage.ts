/**
 * BCH message hashing compatible with the Bitcoin Cash / Bitcoin
 * `signmessage` convention used by Electron Cash, Cashonize and Paytaca:
 *
 *   hash256("\x18Bitcoin Signed Message:\n" + compactSize(message.length) + message)
 *
 * The `\x18` prefix is the CompactSize length of the magic string itself.
 * Using this exact convention is what lets a proof created in a real wallet be
 * verified independently here.
 */
import {
  base64ToBin,
  binToBase64,
  binToHex,
  hash160,
  secp256k1,
  sha256,
  utf8ToBin,
  decodeCashAddress,
  encodeCashAddress,
} from "@bitauth/libauth";

const SIGN_MESSAGE_MAGIC = utf8ToBin("Bitcoin Signed Message:\n");

export function compactSize(length: number): Uint8Array {
  if (!Number.isSafeInteger(length) || length < 0) throw new Error("invalid compactSize length");
  if (length < 0xfd) return Uint8Array.of(length);
  if (length <= 0xffff) return Uint8Array.of(0xfd, length & 0xff, (length >> 8) & 0xff);
  if (length <= 0xffffffff) {
    return Uint8Array.of(
      0xfe,
      length & 0xff,
      (length >>> 8) & 0xff,
      (length >>> 16) & 0xff,
      (length >>> 24) & 0xff,
    );
  }
  throw new Error("message too long");
}

export function hashBitcoinMessage(message: string): Uint8Array {
  const body = utf8ToBin(message);
  const magicLength = compactSize(SIGN_MESSAGE_MAGIC.length);
  const bodyLength = compactSize(body.length);
  const preimage = new Uint8Array(magicLength.length + SIGN_MESSAGE_MAGIC.length + bodyLength.length + body.length);
  preimage.set(magicLength, 0);
  preimage.set(SIGN_MESSAGE_MAGIC, magicLength.length);
  preimage.set(bodyLength, magicLength.length + SIGN_MESSAGE_MAGIC.length);
  preimage.set(body, magicLength.length + SIGN_MESSAGE_MAGIC.length + bodyLength.length);
  return sha256.hash(sha256.hash(preimage));
}

/** Signs with a 32-byte private key, returning the 65-byte base64 wallet format. */
export function signBitcoinMessage(privateKey: Uint8Array, message: string): string {
  const result = secp256k1.signMessageHashRecoverableCompact(privateKey, hashBitcoinMessage(message));
  if (typeof result === "string") throw new Error(result);
  // 31 + recovery id = compressed public key; 27 + recovery id = uncompressed.
  return binToBase64(Uint8Array.from([31 + result.recoveryId, ...result.signature]));
}

export interface RecoveredSignature {
  publicKey: Uint8Array;
  compressed: boolean;
  recoveryId: number;
}

export function recoverBitcoinMessageSigner(signatureBase64: string, message: string): RecoveredSignature {
  const bytes = base64ToBin(signatureBase64);
  if (bytes.length !== 65) throw new Error("signature must be 65 bytes");
  const header = bytes[0]!;
  if (header < 27 || header > 34) throw new Error("unsupported signature header");
  const compressed = header >= 31;
  const recoveryId = header - (compressed ? 31 : 27);
  const recover = compressed
    ? secp256k1.recoverPublicKeyCompressed
    : secp256k1.recoverPublicKeyUncompressed;
  const publicKey = recover(bytes.slice(1), recoveryId as 0 | 1 | 2 | 3, hashBitcoinMessage(message));
  if (typeof publicKey === "string") throw new Error(publicKey);
  return { publicKey, compressed, recoveryId };
}

export function publicKeyToAddress(publicKey: Uint8Array, network: "mainnet" | "chipnet" = "mainnet"): string {
  return encodeCashAddress({
    prefix: network === "mainnet" ? "bitcoincash" : "bchtest",
    type: "p2pkh",
    payload: hash160(publicKey),
  }).address;
}

export interface DecodedAddress {
  address: string;
  network: "mainnet" | "chipnet";
  payload: Uint8Array;
}

/**
 * Decodes a P2PKH CashAddr. P2SH and token-aware addresses are rejected:
 * `signmessage` proves possession of a single secp256k1 key, so only P2PKH
 * addresses have a well-defined key-to-address association.
 */
export function decodeP2pkhAddress(address: string): DecodedAddress | string {
  const decoded = decodeCashAddress(address);
  if (typeof decoded === "string") return decoded;
  if (decoded.type !== "p2pkh") return "only P2PKH addresses are supported";
  const prefix = decoded.prefix;
  if (prefix !== "bitcoincash" && prefix !== "bchtest") return `unsupported CashAddr prefix: ${prefix}`;
  return {
    address,
    network: prefix === "bitcoincash" ? "mainnet" : "chipnet",
    payload: decoded.payload,
  };
}

export interface SignatureCheck {
  ok: boolean;
  code: string;
  message: string;
  publicKey?: string;
  address?: string;
}

/**
 * Verifies that `signatureBase64` over `message` was produced by the key whose
 * hash160 is the P2PKH payload of `address`. The public key is recovered from
 * the signature; the caller never supplies it.
 */
export function verifyBitcoinMessageSignature(
  address: string,
  message: string,
  signatureBase64: string,
): SignatureCheck {
  const decoded = decodeP2pkhAddress(address);
  if (typeof decoded === "string") {
    return { ok: false, code: "BCH_ADDRESS_INVALID", message: decoded };
  }
  let recovered: RecoveredSignature;
  try {
    recovered = recoverBitcoinMessageSigner(signatureBase64, message);
  } catch (error) {
    return {
      ok: false,
      code: "BCH_SIGNATURE_INVALID",
      message: error instanceof Error ? error.message : "could not recover public key",
    };
  }
  const digest = binToHex(hash160(recovered.publicKey));
  if (digest !== binToHex(decoded.payload)) {
    return {
      ok: false,
      code: "BCH_SIGNATURE_NOT_BY_ADDRESS",
      message: "signature recovers to a key that does not control the declared address",
    };
  }
  return {
    ok: true,
    code: "OK",
    message: "ok",
    publicKey: binToHex(recovered.publicKey),
    address,
  };
}

/**
 * True when a BCH public key and a Nostr x-only key are the same secp256k1 key.
 * Handles both compressed (33-byte) and uncompressed (65-byte) BCH public keys.
 * Nostr uses the x-coordinate only, so both forms must be compared by x.
 */
export function sameSecp256k1Key(bchPublicKeyHex: string, nostrPublicKeyHex: string): boolean {
  const key = bchPublicKeyHex.toLowerCase();
  const nostr = nostrPublicKeyHex.toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(nostr)) return false;
  let x: string | undefined;
  if (/^0[23][0-9a-f]{64}$/.test(key)) x = key.slice(2);
  else if (/^04[0-9a-f]{128}$/.test(key)) x = key.slice(2, 66);
  return x !== undefined && x === nostr;
}

export function publicKeyFromPrivateKey(privateKey: Uint8Array): Uint8Array {
  const publicKey = secp256k1.derivePublicKeyCompressed(privateKey);
  if (typeof publicKey === "string") throw new Error(publicKey);
  return publicKey;
}
