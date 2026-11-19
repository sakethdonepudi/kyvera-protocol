# Vercel Deployment

**Status:** deployed at https://kyvera-alpha.vercel.app (commit `2f16977`).
The repository remains private; changing visibility requires owner confirmation.

---

## 1. Vercel project settings

| Setting | Value |
| --- | --- |
| Framework | Next.js |
| Root directory | repository root |
| Install command | `pnpm install --frozen-lockfile` |
| Build command | `pnpm build` |
| Output directory | `apps/web/.next` |
| Node.js | 20+ |
| Package manager | pnpm 9.15.9 (`packageManager`) |

`vercel.json` already contains the install, build and output settings. The
monorepo build compiles `packages/*` before `apps/web`.

## 2. Environment variables

Set these in **Project → Settings → Environment Variables** for Production and
Preview:

```text
NEXT_PUBLIC_KYVERA_RELAYS=wss://nos.lol,wss://relay.primal.net
NEXT_PUBLIC_KYVERA_NETWORK=mainnet
NEXT_PUBLIC_KYVERA_DOMAIN=<deployed-host>
NEXT_PUBLIC_KYVERA_COMMIT=<git-commit-sha>
```

`NEXT_PUBLIC_KYVERA_COMMIT` is emitted as `<meta name="kyvera-commit">` and checked by the post-deployment smoke test.

Notes:

- `NEXT_PUBLIC_*` values are public build-time values. Do not put secrets here.
- The relay set must be reachable from the deployment region. Sensitive
  authentication and payment require **FULL** agreement from every relay in this
  list; one unreachable relay blocks those actions by design.
- Both defaults above answered a read-only kind-30078 probe on 2026-11-19. Relay
  availability changes; run `pnpm relay:health` before deploying and periodically
  afterwards.
- Do not include `ws://127.0.0.1:7777` in production.

## 3. Pre-deployment checks

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
pnpm relay:health wss://nos.lol wss://relay.primal.net
pnpm rp:demo
```

Expected: 136 tests, typecheck clean, 17 routes, 2/2 relays healthy, 10/10 RP
checks.

## 4. Deploy (only with authorization)

```bash
# Preview
vercel

# Production
vercel --prod
```

Or connect the GitHub repository in the Vercel dashboard. No secrets are needed.
The application has no server-side database or API key.

## 5. Post-deployment smoke test

```bash
BASE=https://<deployment-host> pnpm smoke:deploy
```

The script checks:

- HTTP 200 for `/`, `/challenge`, `/merchant`, `/auth-demo`, `/pay`,
  `/developers`, `/create`, `/verify`;
- CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy and
  Permissions-Policy headers;
- no console/page errors while rendering the routes;
- the production JS bundle does not contain a local relay (`127.0.0.1:7777`);
- an invalid npub renders an error instead of crashing.

It is read-only: no relay publication, wallet or transaction.

## 6. Rollback

- Promote the previous Vercel deployment.
- If a relay becomes unhealthy, update `NEXT_PUBLIC_KYVERA_RELAYS`, redeploy and
  rerun the smoke test. Authentication/payment will fail closed until every
  configured relay responds.

## 7. Remaining deployment risk

- Public deployment is live. Real-wallet and public-relay retention evidence are still missing.
- Public-relay retention is not verified.
- Real-wallet pairing/signing is not verified.
- Payment remains a BIP21 handoff, not a transaction receipt.
- The default relay set can change availability at any time; monitor it.
