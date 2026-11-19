import {
  buildBchProofMessage,
  type BchNetwork,
  type BchProofRole,
} from "@kyvera/core";
import {
  decodeP2pkhAddress,
  publicKeyToAddress,
  verifyBitcoinMessageSignature,
  type SignatureCheck,
} from "@kyvera/bch";

export interface WalletCapabilities {
  connect: boolean;
  address: boolean;
  /** True only when the wallet exposes an arbitrary message-signing API. */
  signMessage: boolean;
  network: BchNetwork | null;
}

export interface WalletConnection {
  id: string;
  name: string;
  address: string | null;
  network: BchNetwork | null;
  capabilities: WalletCapabilities;
}

export interface WalletSignature {
  address: string;
  message: string;
  signature: string;
  format: "bch-signmessage-v1";
}

/**
 * Capability-based adapter. `signMessage` is optional: a wallet that only
 * exposes an address must not be presented as able to sign automatically.
 */
export interface BchWalletAdapter {
  id: string;
  connect(): Promise<WalletConnection>;
  getAddress(): Promise<string>;
  getCapabilities(): Promise<WalletCapabilities>;
  signMessage?(message: string): Promise<WalletSignature>;
}

export interface PubkeySource {
  getPubkey(childIndex: number, index: bigint): Uint8Array | undefined;
}

/**
 * WizardConnect adapter. The integrated WizardConnect API exposes the wallet
 * public key/address but no arbitrary message-signing method, so this adapter
 * reports `signMessage: false` and never fabricates a signature.
 */
export class WizardConnectAdapter implements BchWalletAdapter {
  readonly id = "wizardconnect";
  private readonly manager: PubkeySource;
  private readonly network: BchNetwork;
  private readonly name: string;
  private address: string | null = null;

  constructor(input: { manager: PubkeySource; network: BchNetwork; name?: string }) {
    this.manager = input.manager;
    this.network = input.network;
    this.name = input.name ?? "WizardConnect wallet";
  }

  private derive(): string | null {
    try {
      const publicKey = this.manager.getPubkey(0, 0n);
      if (!publicKey) return null;
      return publicKeyToAddress(publicKey, this.network);
    } catch {
      return null;
    }
  }

  async connect(): Promise<WalletConnection> {
    this.address = this.derive();
    return {
      id: this.id,
      name: this.name,
      address: this.address,
      network: this.address ? this.network : null,
      capabilities: await this.getCapabilities(),
    };
  }

  async getAddress(): Promise<string> {
    const address = this.address ?? this.derive();
    if (!address) throw new Error("wallet has not exposed a public key");
    this.address = address;
    return address;
  }

  async getCapabilities(): Promise<WalletCapabilities> {
    return {
      connect: true,
      address: true,
      signMessage: false,
      network: this.network,
    };
  }
}

export interface ManualSignatureInput {
  address: string;
  message: string;
  signature: string;
  expectedNetwork?: BchNetwork;
}

export interface ManualSignatureResult {
  ok: boolean;
  code: string;
  message: string;
  address?: string;
  network?: BchNetwork;
  publicKey?: string;
}

/**
 * Verifies a signature produced manually in a wallet. This is a real proof
 * workflow: the user signs the exact canonical message in their wallet and the
 * application verifies it locally. It is not an automated wallet integration.
 */
export function verifyManualSignature(input: ManualSignatureInput): ManualSignatureResult {
  const address = input.address.trim().toLowerCase();
  const decoded = decodeP2pkhAddress(address);
  if (typeof decoded === "string") {
    return { ok: false, code: "BCH_ADDRESS_INVALID", message: decoded };
  }
  if (input.expectedNetwork && decoded.network !== input.expectedNetwork) {
    return {
      ok: false,
      code: "BCH_NETWORK_MISMATCH",
      message: `address is on ${decoded.network}, expected ${input.expectedNetwork}`,
    };
  }
  const check: SignatureCheck = verifyBitcoinMessageSignature(address, input.message, input.signature.trim());
  if (!check.ok) {
    return { ok: false, code: check.code, message: check.message };
  }
  return {
    ok: true,
    code: "OK",
    message: "signature recovers to the declared address",
    address,
    network: decoded.network,
    publicKey: check.publicKey,
  };
}

export interface KyveraSigningRequest {
  role: BchProofRole;
  address: string;
  payloadDigest: string;
  message: string;
}

/** Canonical message the user must sign in the wallet. */
export function createKyveraSigningRequest(input: {
  role: BchProofRole;
  address: string;
  payloadDigest: string;
}): KyveraSigningRequest {
  return {
    role: input.role,
    address: input.address,
    payloadDigest: input.payloadDigest,
    message: buildBchProofMessage(input.role, input.address, input.payloadDigest),
  };
}

export { buildBchProofMessage, decodeP2pkhAddress };
