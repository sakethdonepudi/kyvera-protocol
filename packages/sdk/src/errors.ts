export type KyveraSdkErrorCode =
  | "INVALID_SUBJECT"
  | "INVALID_OPTIONS"
  | "RESOLUTION_FAILED"
  | "ADDRESS_INVALID";

export class KyveraSdkError extends Error {
  readonly code: KyveraSdkErrorCode;
  override readonly cause?: unknown;

  constructor(code: KyveraSdkErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "KyveraSdkError";
    this.code = code;
    this.cause = cause;
  }
}
