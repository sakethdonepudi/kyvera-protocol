/**
 * Relying-party authentication helpers.
 *
 * These are re-exported from @kyvera/verifier so applications can import a
 * single SDK package. The service is in-memory; a production relying party
 * should persist challenges and sessions atomically (see examples/relying-party).
 */
export {
  AUTH_KIND,
  AUTH_PROTOCOL,
  AUTH_REQUEST_PROTOCOL,
  APP_SESSION_PROTOCOL,
  AuthRequestService,
  MemoryAuthRequestStore,
  authRequestDigest,
  buildAuthEvent,
  buildAuthRequestEvent,
  createAuthChallenge,
  createAuthRequest,
  issueAppSession,
  validateAppSession,
  verifyAuthEvent,
  verifyAuthRequestEvent,
  type AppSession,
  type AuthCheck,
  type AuthRequestStore,
  type AuthChallenge,
  type AuthRequest,
  type SessionCheck,
  type VerifyAuthOptions,
  type VerifyAuthRequestOptions,
} from "@kyvera/verifier";
