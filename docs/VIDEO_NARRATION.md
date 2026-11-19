# Narrated Video Production

**Provider:** Microsoft Edge Neural TTS via `edge-tts` 7.3.1  
**Voice:** `en-US-AndrewNeural` (warm, confident male, US English)  
**Rate:** `-5%`  
**API key:** none embedded; the service is accessed through the local `edge-tts` CLI

No celebrity imitation or voice cloning was used. The narration was generated from
the scripts below and synchronized scene-by-scene with recordings of the deployed
KYVERA application.

---

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
| Duration | **92.13s** | **183.73s** |
| Resolution | 1920×1080 | 1920×1080 |
| Frame rate | 30 fps | 30 fps |
| Video | H.264 High, yuv420p | H.264 High, yuv420p |
| Audio | AAC-LC, 48 kHz, mono | AAC-LC, 48 kHz, mono |
| Mean volume | **-16.8 dB** | **-16.6 dB** |
| Peak volume | **-1.5 dB** | **-1.4 dB** |
| Black frames >0.6s | none detected | none detected |
| Captions | 19 WebVTT cues | 36 WebVTT cues |
| Last caption | 01:26.352 | 02:58.939 |

Audio was normalized with `loudnorm=I=-16:TP=-1.5:LRA=11`; no clipping was
observed. Captions are generated from the TTS cue timings and shifted per scene,
then served as a WebVTT `<track>`; they are not a replacement for the accessible
subtitle track.

The films use actual deployed screens. Demo fixtures are labelled on-screen. No
wallet approval, transaction, txid or confirmation is simulated.

---

## 4. Rebuild

```bash
FFMPEG=/path/to/ffmpeg node scripts/build-narrated-videos.mjs
```

Requires `edge-tts` and network access to the Edge speech service. If the TTS
service is unavailable, the script retries and then fails rather than silently
producing a silent video.
