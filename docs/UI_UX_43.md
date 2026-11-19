# KYVERA 4.3 — Premium Minimal Interface

**Live:** https://kyvera-alpha.vercel.app
**Scope:** product-wide UI/UX refinement. No protocol, verification, wallet, authentication, payment, rotation, revocation or security-policy logic changed.

## 1. Design intent

Show the product; do not repeatedly explain it. The primary reading path is now the lifecycle, the interaction and the verifier result. Long evidence remains available through disclosure.

## 2. Removed or condensed content

- Tutorial: removed the long “real product from Create Identity…” introduction, “What to look for”, “What is not shown”, bullet lists and decorative chips. The page is now a title, subtitle, two video choices, a large player and a discreet “Demo details” disclosure.
- Demo: replaced the self-contained-demonstration paragraph with **“Explore identity continuity.”** Removed the four decorative badges and shortened every step description. Demo limitations sit in an accessible “Demo data” disclosure.
- Homepage: removed the six-section documentation flow, competitor comparison, result-space grid, repeated disclaimers and secondary-link row. The hero has one primary CTA (“Create identity”) and one secondary CTA (“Explore demo”), with the lifecycle as the focal visual.
- Create: removed the repeated workflow explanation and duplicate relay heading; the Connect → Sign → Verified → Publish stepper is a compact four-segment progress rail.
- Challenge: shortened every stage description, removed the kicker and simplified fixture-mode copy. Proof JSON remains in the evidence disclosure.
- Authentication: shortened the challenge explanation, removed decorative assurance chips and condensed the session/negative-check copy.
- Merchant: shortened the self-assertion copy and safety list; the payment destination remains explicit and locked until verification.
- Footer: reduced to a short prototype statement rather than a repeated security paragraph.

## 3. Glass implementation

- `.glass`, `.glass-strong`, `.glass-nav` use layered translucent gradients, 24–26px backdrop blur with saturation lift, a fine border, inset top highlight and a directional shadow.
- The page carries three restrained diffusion fields (warm, mint, ice) plus a faint grid behind the top of the page, so the blur has actual texture to refract.
- Glass is used for navigation, the landing lifecycle instrument, primary interactive panels, selected verification panels, the payment destination, the video container and dialogs.
- Ordinary content stays on flat graphite surfaces. No nested glass-on-glass.
- `@supports not (backdrop-filter)` falls back to an opaque surface. `prefers-reduced-motion` collapses transitions to ~0ms.

## 4. Lifecycle redesign

`apps/web/components/lifecycle-demo.tsx` is now a verifier-driven timeline:

- BIND → ROTATE → REVOKE, horizontal on desktop and vertical on mobile.
- Each stage shows a sequence marker, action, lifecycle role and short address.
- The selected stage reveals the state at that step, the verifier reason, valid-record count, superseded history, copy control and a full-address disclosure.
- A revoked chain explicitly states that no address is currently authorized.
- Statuses come from `runLifecyclePreview()` / `resolveEvents()`; no visual status is hardcoded.

## 5. Evidence

Before/after screenshots are in:

- `docs/screenshots/4.3/before/`
- `docs/screenshots/4.3/after/`
- `docs/screenshots/4.3/responsive/`

The responsive set covers 375, 390, 768 and 1440 px for the homepage, create, challenge, tutorial, authentication and merchant pages. Automated checks confirm no horizontal overflow at any of those widths.

## 6. Verification

- `pnpm test` — 136/136
- `pnpm typecheck` — pass
- `pnpm build` — pass
- `pnpm qa:browser` — 64/64, 0 console/page errors
- `pnpm rp:demo` — 10/10
- production smoke — 9 routes, headers and bundle checks
- production read-only QA — 12 routes, reload, mobile, video

## 7. Preserved security semantics

- Real signature verification and authorization-chain checks are untouched.
- Fail-closed relay policy is unchanged.
- `PARTIAL`, `STALE`, `UNSYNCED`, `CONFLICT`, `REVOKED` and `INVALID` remain visible and are never rendered as `ACTIVE`.
- Rejection, uncertainty and failed-verification states remain explicit.
- Wallet signing instructions and limitations remain at the point of action.
- Revocation/conflict warnings and payment-handoff limitations remain visible.
- Deterministic fixtures remain labelled.
- Narrated MP4s and official brand assets are preserved.

## 8. Remaining UI notes

- The narrated films still show the pre-4.3 interface; they were intentionally preserved.
- Real-wallet interoperability and real-funds payment remain untested.
- No independent security audit is claimed.
