# Standalone demonstration

Open **`kyvera-standalone.html`** in any modern browser. No install, server, relay or network connection is required.

It contains:

- the real KYVERA verifier bundled from `@kyvera/verifier`;
- deterministic, unspendable test keys;
- six executable scenarios: authorized rotation, unauthorized rotation, historical replay, equivocation, missing history/rollback, revocation;
- a simple/advanced disclosure mode with the raw signed events and verifier return values.

The bundle is generated, not hand-written:

```bash
pnpm demo:standalone
```

Then reopen `demo/kyvera-standalone.html`.

The source is `demo/standalone.ts`; the HTML builder is `scripts/build-standalone-demo.mjs`. The fixture engine is shared with the web security lab (`apps/web/lib/lab.ts`).

This file is a fallback for judges who cannot run `pnpm install`. It is not a hosted deployment. A live deployment still requires authorization.
