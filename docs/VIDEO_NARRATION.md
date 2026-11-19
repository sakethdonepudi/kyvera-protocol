# Narrated Video Production

**Provider:** Microsoft Edge Neural TTS via `edge-tts` 7.3.1  
**V5 film voice:** `en-US-BrianNeural` (calm, confident male, US English)  
**Previous films voice:** `en-US-AndrewNeural`  
**API key:** none embedded; the service is accessed through the local `edge-tts` CLI

No celebrity imitation or voice cloning was used. Narration is generated from the
scripts below and synchronized scene-by-scene with recordings of the deployed
KYVERA application.

---

## 0. V5 product film (primary)

**File:** `apps/web/public/demo/kyvera-v5-product-film.mp4`  
**Captions:** `apps/web/public/demo/kyvera-v5-product-film.vtt`  
**Preview:** `apps/web/public/demo/kyvera-v5-preview.mp4` (15s, silent, 1280×720, 851 KB)  
**Poster:** `apps/web/public/demo/kyvera-v5-poster.webp` (30 KB WebP)  
**Recorded application:** KYVERA v5.0.1, deployed commit `0651b06`  
**Production source:** `scripts/film-v5/`

### Exact narration

**Opening**

> Your digital identity shouldn't disappear when your keys change. A wallet address can prove control. But what happens when that wallet changes, a key is compromised, or authorization is revoked? KYVERA introduces identity continuity for Bitcoin Cash and Nostr.

**Identity creation**

> Two independently controlled keys establish a cryptographic relationship. One belongs to a Bitcoin Cash wallet. The other belongs to a Nostr identity. Each proof is verified independently. Neither private key needs to leave its owner.

**Discovery**

> KYVERA publishes signed identity records through public Nostr relays. Independent applications can retrieve the evidence and verify it without relying on KYVERA's website. A two-relay public lifecycle test reconstructs bind, rotate, and revoke, and rejects a forged rotation. Synchronization assurance is reported separately from cryptographic validity.

**Lifecycle**

> Identity isn't a single signature. It's a history of authorization. When a wallet rotates, the earlier proof remains historically valid. But the old wallet is no longer the current authorized destination. Revocation changes that authorization again.

**Authentication**

> Applications can issue single-use challenges, verify responses, and establish short-lived sessions. Outdated authorization, replayed challenges, and insufficient relay evidence are rejected.

**Developer interoperability**

> KYVERA provides a reusable TypeScript SDK and an independent relying-party example. Applications can inspect cryptographic evidence, authorization history, and synchronization assurance.

**Closing**

> Keys change. Trust shouldn't disappear. KYVERA. The Identity Continuity Protocol.

### Export verification

| Property | V5 product film | Homepage preview |
| --- | --- | --- |
| Duration | **120.00s** | **15.00s** |
| Resolution | 1920×1080 | 1280×720 |
| Frame rate | 30 fps | 30 fps |
| Video | H.264 High, yuv420p | H.264, yuv420p |
| Audio | AAC-LC, 48 kHz, stereo | none (silent by design) |
| Mean volume | **-17.0 dB** | n/a |
| Peak volume | **-2.0 dB** | n/a |
| Captions | **26 WebVTT cues** | n/a |
| Last caption | **01:58.540** | n/a |
| File size | 23 MB | **851 KB** |
| Poster | 30 KB WebP | 30 KB WebP |

Audio was normalized with `loudnorm=I=-16:TP=-1.5:LRA=11` plus a controlled
+2.5 dB lift. The film uses real application screens captured at 1920×1080.
One BCH proof was signed locally to show the real Verified state; **Publish was
not clicked and no identity or transaction was published**.

### Scene map

| Time | Scene | Source |
| --- | --- | --- |
| 0–18.6s | Brand opening, homepage hero | title card + `/` |
| 18.6–36.9s | Create Identity, proof, real Verified state | `/create` |
| 36.9–62.1s | Binding, public verifier, two-relay evidence | title card + `/verify` |
| 62.1–80.8s | BIND → ROTATE → REVOKE timeline | `/` lifecycle |
| 80.8–95.5s | Single-use challenge, replay rejection | `/challenge`, `/auth-demo` |
| 95.5–109.5s | SDK and independent relying party | `/developers`, actual `pnpm rp:demo` output |
| 109.5–120s | Brand closing | title card |

### Rebuild

```bash
BASE=https://kyvera-alpha.vercel.app node scripts/film-v5/capture.mjs
node scripts/film-v5/cards.mjs
python3 scripts/film-v5/narrate.py
python3 scripts/film-v5/build.py
```

Requires Playwright/Chrome, Python 3.11, `edge-tts` and FFmpeg. The Edge TTS
service rejected explicit rate modifiers in this environment, so the default
voice rate was used and audio was normalized in the final encode.

---

## Previous films

## 1. Explainer — exact narration

### Scene 1 — The problem

> A wallet address can change. But the identity behind it shouldn't have to
> disappear. In decentralized systems, proving who controls an address is only
> the beginning. The harder question is what happens when that address changes.

### Scene 2 — Meet KYVERA

> Meet KYVERA. An open-source identity continuity protocol connecting Bitcoin
> Cash and Nostr through independent cryptographic proofs. No shared private
> keys. No centralized identity provider.

### Scene 3 — Verification

> Each binding is cryptographically verified. Independent applications can
> inspect the evidence and determine whether an authorization chain is valid.

### Scene 4 — Rotation

> When a wallet changes, KYVERA preserves the authorization history. The old
> proof remains historically valid, but the old wallet is no longer the currently
> authorized destination.

### Scene 5 — Authentication and uncertainty

> KYVERA also supports challenge-response authentication, revocation, and
> explicit detection of conflicting or incomplete evidence. When the available
> information is uncertain, sensitive actions are blocked.

### Scene 6 — Closing

> Your keys change. Your identity continues. KYVERA. Keys change. Trust shouldn't
> disappear.

---

## 2. Judge walkthrough — exact narration

### 01 — Introduction

> KYVERA solves a problem that simple wallet-to-profile links cannot. A signature
> can prove ownership at one moment. But after a wallet is rotated, compromised,
> or revoked, how does another application know which wallet remains authorized?
> That is the identity-continuity problem. KYVERA makes current authorization
> independently verifiable.

### 02 — Dual-key binding

> KYVERA binds a Bitcoin Cash wallet and a Nostr identity using separate
> cryptographic proofs. The Nostr key signs the identity record. The BCH wallet
> signs a domain-separated message containing the record digest. Both signatures
> are verified. The verifier never trusts a profile field, a server, or a single
> signature.

### 03 — Independent verification

> The binding and every later transition are canonical, hash-linked records.
> KYVERA checks sequence numbers, previous-record references, and the
> authorization rules for bind, rotate, and revoke. Discovery happens through
> Nostr relays. The verifier reports per-relay freshness, and it refuses to
> invent a current state when history is incomplete.

### 04 — Authentication

> A relying application issues a fresh, single-use challenge bound to its origin,
> session, intended identity, and address. The user signs it with the identity
> key. KYVERA verifies the response against freshly resolved authorization.
> Replayed challenges, expired challenges, and unauthorized signers are rejected.
> A session is issued only after verification.

### 05 — Rotation and continuity

> Now the original wallet is replaced through an authorized rotation. The current
> wallet authorizes leaving, the new wallet proves control, and the Nostr key binds
> the transition. Wallet A's historical signature remains valid forever. But it
> is no longer the current destination. The Time Machine shows that distinction
> explicitly, and the old application session is invalidated.

### 06 — Merchant destination

> The same model can resolve an identity-linked payment destination. A merchant
> boots from a signed binding. After an authorized rotation, the destination
> moves to the new wallet, and the old wallet is reported as superseded. If the
> identity is stale, conflicted, or revoked, payment handoff is blocked.

### 07 — Independent interoperability

> The verifier and relying-party example can run independently of KYVERA's
> website. This is a working open-source prototype with documented limitations,
> not a claim of production-grade wallet interoperability. Your keys change. Your
> identity continues. KYVERA.

### 08 — Closing

> KYVERA. Keys change. Trust shouldn't disappear.

---

## 3. Export verification

| Property | Explainer | Judge demo |
| --- | --- | --- |
| Duration | **96.93s** (2.4s logo reveal at both ends) | **188.53s** (2.4s logo reveal at both ends) |
| Resolution | 1920×1080 | 1280×720 |
| Frame rate | 30 fps | 30 fps |
| Video | H.264 High, yuv420p | H.264 High, yuv420p |
| Audio | AAC-LC, 48 kHz, mono | AAC-LC, 48 kHz, mono |
| Mean volume | **-17.3 dB** | **-16.8 dB** |
| Peak volume | **-1.5 dB** | **-1.4 dB** |
| Black frames >0.6s | none detected | none detected |
| Captions | 19 WebVTT cues | 36 WebVTT cues |
| Last caption | 01:28.752 | 03:01.339 |

Audio was normalized with `loudnorm=I=-16:TP=-1.5:LRA=11`; no clipping was
observed. Captions are generated from the TTS cue timings and shifted per scene,
then served as a WebVTT `<track>`; they are not a replacement for the accessible
subtitle track.

The two previous films open and close with a 2.4-second reveal of the approved raster primary
logo (opacity and scale, no stretching, no recoloring), then use actual deployed
screens. Demo fixtures are labelled on-screen. No wallet approval, transaction,
txid or confirmation is simulated.

---

## 4. Rebuild

```bash
FFMPEG=/path/to/ffmpeg node scripts/build-narrated-videos.mjs
```

Requires `edge-tts` and network access to the Edge speech service. If the TTS
service is unavailable, the script retries and then fails rather than silently
producing a silent video.
