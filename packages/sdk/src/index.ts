export {
  KyveraClient,
  type AddressOptions,
  type KyveraClientOptions,
  type ResolveOptions,
  type VerifyOptions,
} from "./client.js";
export {
  toVerificationResult,
  type KyveraCheck,
  type KyveraHistoricalRecord,
  type KyveraVerificationResult,
} from "./result.js";
export { KyveraSdkError, type KyveraSdkErrorCode } from "./errors.js";
export * from "./auth.js";
export * from "./discovery.js";

export {
  createBindRecord,
  createRevokeRecord,
  createRotateRecord,
  previousStateFrom,
  resolveEvents,
  verifyEventRecord,
  type CreatedRecord,
  type PreviousState,
  type VerifyEventResult,
} from "@kyvera/verifier";
export {
  buildPublicRecordEvent,
  buildRecordEvent,
  buildRecordEventPair,
  generateNostrSecretKey,
  normalizeNostrPublicKey,
  signerFromSecretKey,
  toNpub,
  type NostrSigner,
  type ParsedRecordEvent,
} from "@kyvera/nostr";
export {
  generateBchKeyPair,
  signBitcoinMessage,
  testBchKeyPair,
  verifyBitcoinMessageSignature,
  type BchKeyPair,
  type SignatureCheck,
} from "@kyvera/bch";

/** SDK package version. Kept in sync with package.json at release time. */
export const KYVERA_SDK_VERSION = "0.1.0" as const;
