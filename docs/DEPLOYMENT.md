# Deployment Guide

**Target:** Vercel (or any Node 20 host)
**Status:** configuration prepared and locally verified; **not deployed** (authorization required).

KYVERA has no backend, database or secret. The web app is a Next.js client; verification runs in the browser or CLI. Deployment is therefore mostly a static-hosting problem, with WebSocket egress to relays.

---

## 1. Repository configuration

`vercel.json` at the repository root:

```json
{
  "framework": "nextjs",
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "pnpm --filter @kyvera/web build",
  "outputDirectory": "apps/web/.next",
  "regions": ["iad1"]
}
```

Import the repository with the **root directory set to the repository root**, not `apps/web`. This keeps pnpm workspace linking intact (`@kyvera/core`, `bch`, `nostr`, `verifier` are built first).

Vercel build order:

1. `pnpm install --frozen-lockfile`
2. `pnpm build` — builds every package in dependency order, then the Next app.

No `prebuild` script is required on Vercel because the web package's dependencies are built by pnpm/Next transpilation. Locally, `pnpm build` builds every package explicitly.

---

## 2. Environment variables

Set these in Vercel Project → Settings → Environment Variables. All are **public build-time values**; never put a secret in `NEXT_PUBLIC_*`.

| Variable | Example | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_KYVERA_RELAYS` | `wss://relay.damus.io,wss://nos.lol` | Public relays. Do not include the local demo relay. |
| `NEXT_PUBLIC_KYVERA_NETWORK` | `mainnet` | `mainnet` or `chipnet`. |
| `NEXT_PUBLIC_KYVERA_DOMAIN` | `kyvera.example` | Domain shown in authentication challenges. Use the deployed host. |

If `NEXT_PUBLIC_KYVERA_RELAYS` is omitted, the production bundle falls back to `wss://relay.damus.io,wss://nos.lol`. Development falls back to `ws://127.0.0.1:7777`.

Template: [`apps/web/.env.production.example`](../apps/web/.env.production.example).

---

## 3. Security headers

`apps/web/next.config.mjs` sets, for every route:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- In production only:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `Content-Security-Policy` with `default-src 'self'`, inline script/style (Next runtime), `'wasm-unsafe-eval'` (libauth), WebSocket `connect-src`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`.

CSP is not applied in development to avoid breaking HMR. A future improvement is a nonce-based CSP; inline allowances are required by the current Next runtime.

Verify after deployment:

```bash
curl -sI https://<host>/ | grep -iE "content-security|x-frame|x-content|referrer|permissions|strict-transport"
```

---

## 4. Pre-deployment checks (local)

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

Then:

```bash
pnpm --filter @kyvera/web start   # production server, default port 3000
```

Smoke-test:

| Route | Expectation |
| --- | --- |
| `/` | Landing + live deterministic lifecycle instrument |
| `/demo` | Eight-step guided demo; no relay needed |
| `/lab` | Six scenarios execute locally |
| `/verify` | Renders; a nonexistent npub returns `UNKNOWN`/`INVALID`, not a crash |
| `/interop` | Wallet probe + independent vector verification |
| `/pay` | Identity-based payment policy + BIP21 handoff; WizardConnect pairing opens |
| `/auth-demo` | Relying-party sign-in, session issuance, replay/logout/revocation states |
| `/challenge` | Five-stage Trust Challenge, guided demo and live identity mode |
| `/merchant` | Self-asserted merchant, verified payment destination and rotation |
| `/developers` | SDK docs and vector download |
| `/kyvera-standalone.html` | Single-file demo loads from the host |
| `/vectors.json` | Deterministic vectors served |
| `/icon.svg` | Icon served |

Relay-unavailable behavior:

- `resolveIdentity` returns `STALE`/`UNSYNCED`, `activeBch = null`.
- The create page retains the signed event locally and reports relay failures; it does not show a fake success.
- `/demo`, `/lab`, `/interop` and the standalone file do not require a relay.

Bundle audit:

```bash
# No dev relay or private key material in the production client bundle
grep -R "ws://127.0.0.1:7777\|ws://localhost:7777" apps/web/.next/static | head
grep -R "nsec1\|BEGIN PRIVATE KEY\|privateKeyHex" apps/web/.next/static | head
```

The SDK contains the word `privateKey` in type/function names; inspect any hit for an actual hardcoded value. There are no secrets or funded keys in the repository. Demo keys are generated at runtime from labelled deterministic inputs, not embedded as spendable material.

---

## 4.5 Vercel preparation

See [`VERCEL_DEPLOYMENT.md`](VERCEL_DEPLOYMENT.md) for project settings, environment
variables, relay health checks and the post-deployment smoke test.

## 5. Deploy

1. Import repository into Vercel.
2. Root directory: repository root.
3. Framework preset: Next.js (config also sets it).
4. Add the three environment variables.
5. Deploy.
6. Verify headers and routes above.
7. Set `NEXT_PUBLIC_KYVERA_DOMAIN` to the final hostname and redeploy (build-time inline).
8. Optional: add the deployment URL to the top-of-page banner required by the Mainnet Track, together with the Widget Factory deck, repository link and EMBER2026 CashTokens address.

---

## 6. Rollback

Vercel keeps immutable deployments. Roll back by promoting the previous deployment. Because there is no database or server state, rollback does not risk data migration.

---

## 7. Known deployment risks

- **Relay egress:** corporate or browser CSP restrictions can block WebSockets. Verify in the target browser.
- **Build-time env:** `NEXT_PUBLIC_*` values are inlined; changing them requires a redeploy.
- **`libauth` top-level await:** the build emits a warning; current Chrome is tested, older browsers are not claimed.
- **WizardConnect:** pairing requires relay egress and a compatible wallet; it is untested with a physical wallet.
- **KYVERA Pay:** the BIP21 handoff does not return a txid and does not construct/broadcast transactions in-app.
- **No hosted demo yet:** this document prepares deployment but does not authorize it.
- **Mainnet Track:** deployment alone does not satisfy WizardConnect or the mainnet-transaction requirement.
