# Submission Eligibility

**Date:** 2026-11-18
**Project:** KYVERA
**Question:** what must be true for KYVERA to be eligible for (A) the Paytaca Decentralized Identity bounty only, and (B) the BCH Blaze 2026 Mainnet Track?

> Official pages change. This record reflects the pages fetched on 2026-11-18. Anything not explicitly stated is marked **unresolved**, not assumed.

---

## 1. Sources

| Source | URL | What it establishes |
| --- | --- | --- |
| Paytaca bounty page | https://bchblaze.cash/bounties/decentralized-identity/ | Bounty requirements, stretch goals, judging words |
| BCH Blaze Bounties board/rules | https://bchblaze.cash/bounties/ | How bounties are judged/paid; no track requirements |
| DoraHacks hackathon Details | https://dorahacks.io/hackathon/bchblaze2026/detail | Eligibility, prizes, judging, schedule |
| DoraHacks Tracks | https://dorahacks.io/hackathon/bchblaze2026/tracks | Mainnet Track requirements |
| DoraHacks Bounties tab | https://dorahacks.io/hackathon/bchblaze2026/bounties | **"No Bounties — There are no Bounties for this hackathon."** |
| DoraHacks Builds tab | https://dorahacks.io/hackathon/bchblaze2026/build | Builds are under organizer review; no public submission list |
| Widget Factory template | https://docs.google.com/presentation/d/1Yfuk9CJkf4U9M_WukcELhumWgj3Ak6345Ewy8hSp-Hk/edit | Required presentation template for Mainnet Track |

**Deadline:** DoraHacks event timeline says **Deadline 2026/11/22 14:00 UTC** (= 19:30 IST). The BCH Blaze site footer says "Nov 14 – 28", which conflicts with the DoraHacks deadline. DoraHacks is the submission platform and is treated as authoritative.

---

## 2. Paytaca bounty requirements (source: bounty page)

The page says the proof of concept should demonstrate:

1. **Identity creation & management** — users hold their own keys, no centralized provider/custodian.
2. **Cryptographic identity binding** — proofs of control over both keys, no private-key exposure, **no key reuse across both**; a profile listing is not enough.
3. **Decentralized discovery** — via Nostr or another decentralized method, no proprietary database.
4. **Verification & authentication** — independent apps can verify and authenticate (e.g. challenge-response) without a central authority.
5. **Working demonstration & documentation** — prototype, source, setup instructions, architecture and verification process.

Stretch goals include identity-based payments, attestations/VCs, portable reputation, **key rotation and recovery with independently verifiable authorization**, selective disclosure, reusable libraries/specs, and on-chain identity commitments.

The page's additional notes say:

> "A focused proof of concept covering binding, discovery, verification and authentication is sufficient."

and:

> "Submissions are evaluated on technical correctness, security, decentralization, interoperability, usability and demo quality."

The bounty page does **not** mention WizardConnect, a mainnet transaction, a presentation deck, a live hosted URL, or a demo video. It requires a "working demonstration" and source code.

### Bounty rules page (bchblaze.cash/bounties/#rules)

- "A single project can submit to as many bounties as they like (provided they meet the requirements)."
- "Bounties will be paid at the discretion of Sponsors … and only for good faith efforts."
- "Submissions for a bounty automatically waive their rights over intellectual property or similar…"
- No separate technical eligibility rules are stated beyond the individual bounty page.

---

## 3. Mainnet Track requirements (source: DoraHacks Details/Tracks)

The Details page states that **winners must integrate their project with BCH and complete all specified requirements of their track to be considered eligible**. The Mainnet Track requirements include:

| # | Requirement | Exact / paraphrased rule |
| --- | --- | --- |
| M1 | Registration/submission | Register on DoraHacks and submit a valid project by the deadline. |
| M2 | Mainnet transaction | "Projects must include at least one feature that involves sending Bitcoin Cash (BCH) mainnet transactions. There is no need to link to a specific transaction, but it must be possible USING the app for anyone (ie the judges) to simply & clearly make a useful BCH mainnet transaction." |
| M3 | Live demo | "Projects must have a live, usable demo of their application that judges can simply click a website link to open & experiment with." |
| M4 | Originality | Original or significantly improved during the hackathon; pre-existing work must be disclosed. |
| M5 | Top-of-page banner | Link to a short presentation using the Widget Factory template; link to the GitHub/lab repository; a CashTokens address for EMBER2026 donations; pre-existing projects must link old and new repos and a pre-hackathon demo. |
| M6 | Wallet integration | "Projects must have a WizardConnect integration or XO Template integration (or both!) for ease of BCH wallet connection." |
| M7 | Roll call | At least one representative attended one BLAZE stream / roll call, unless waived at organizer discretion. |
| M8 | Telegram confirmation | Confirm the project is real in the BCH BLAZE Telegram channel. |

The Details page also warns judges will look at projects in a low-priority queue if roll call was missed, and that mockups/scaffolds that are not usable will lose credibility.

---

## 4. A vs B: applicability

| Requirement | A. Paytaca bounty only | B. Mainnet Track | KYVERA today |
| --- | --- | --- | --- |
| Public deployment / live URL | **Ambiguous** — "working demonstration" is required, but a hosted URL is not explicitly stated | **Mandatory** (M3) | ❌ Not deployed |
| WizardConnect or XO | **Not stated** | **Mandatory** (M6) | ◐ WizardConnect adapter integrated and pairing dialog works; **not tested with a physical wallet**. No XO. |
| BCH mainnet transaction feature | **Not stated** | **Mandatory** (M2) | ◐ BIP21 handoff can initiate a wallet payment; no in-app tx construction, broadcast or txid. Confirm whether this satisfies "using the app". |
| Demo video | **Ambiguous** — "working demonstration"; video not explicitly required | **Not explicitly required**; live demo is required | ❌ Not recorded |
| Presentation deck (Widget Factory) | **Not stated** on bounty page | **Mandatory** in top banner (M5) | ❌ Not prepared |
| Source repository | **Required** ("source code") | **Mandatory** banner link (M5) | ⚠️ Repository exists but is **private**; it must be public or explicitly accessible to judges |
| On-chain evidence / tx link | **Not stated** | No specific tx link required, but the feature must be usable (M2) | ❌ |
| Registration | Not stated on bounty page | **Mandatory** (M1) | ❌ Not confirmed |
| Roll call / Telegram | Not stated | **Mandatory** unless waived (M7/M8) | ❌ Not confirmed |
| Banner / EMBER address | Not stated | **Mandatory** (M5) | ❌ Not prepared |

---

## 5. Critical unresolved questions

1. **Is there a bounty-only submission path?** DoraHacks' Bounties tab says there are **no bounties on the platform**. The Paytaca bounty lives on bchblaze.cash. The page says "submit your BUIDL" and links to DoraHacks. It does not say whether a project can be considered for the bounty without entering the Mainnet Track, or whether Mainnet Track eligibility gates bounty eligibility.
2. **Do Mainnet Track requirements apply to bounty entries?** DoraHacks says winners must complete "all specified requirements of their track"; the bounty page says a focused PoC is sufficient. These are not clearly reconciled. **Do not assume the bounty exemption covers track eligibility.**
3. **Does "at least one feature that involves sending BCH mainnet transactions" require KYVERA itself to send BCH, or would a payment-by-identity feature satisfy it?** A payment feature was not implemented (P2 stretch).
4. **Does WizardConnect apply if the app uses external wallet signing rather than connection?** The rule says "WizardConnect integration or XO Template integration"; a signmessage-paste flow is not WizardConnect.
5. **Is a demo video required for the bounty?** The bounty requires a "working demonstration"; a video is conventional but not explicitly quoted. The workspace brief earlier asked for one.
6. **What is the exact deadline?** DoraHacks says 22 Nov 14:00 UTC; the bchblaze.cash footer says Nov 14–28. Use DoraHacks, but confirm.

**Recommended action:** contact Paytaca (Telegram link on the bounty page) and BCH Blaze organizers **before spending engineering time on Mainnet Track features**, and ask specifically: "For the Decentralized Identity bounty, is a DoraHacks Mainnet Track submission required, and do the live-demo/WizardConnect/mainnet-transaction rules apply?" Record the answer here.

---

## 6. KYVERA compliance summary

| Area | Status |
| --- | --- |
| Bounty R1 creation/management | ✅ self-custodial demo/NIP-07/external wallet flows |
| Bounty R2 dual-key binding | ✅ tests + independent vector |
| Bounty R3 discovery | ✅ Nostr relays, multi-relay |
| Bounty R4 verification/auth | ✅ SDK, CLI, `/auth-demo` relying-party session journey (154 tests, 64 browser checks) |
| Bounty R5 demonstration/docs | ✅ locally; no hosted URL |
| Rotation stretch goal | ✅ rotation; recovery explicitly not claimed |
| Mainnet M2 mainnet transaction | ◐ BIP21 handoff only; no in-app broadcast/txid |
| Mainnet M3 live demo | ❌ |
| Mainnet M5 presentation/banner | ❌ |
| Mainnet M6 WizardConnect/XO | ◐ WizardConnect adapter, untested with wallet; no XO |
| Mainnet M7/M8 roll call/Telegram | ❌ unverified |

**Eligibility verdict:** KYVERA is technically strong for the Paytaca bounty's five requirements but **not currently eligible for the Mainnet Track as-is**. Bounty-only eligibility is **unresolved** and must be confirmed with the sponsor/organizers. Do not submit claiming Mainnet Track eligibility without a wallet-tested WizardConnect/XO integration and a confirmed mainnet transaction flow (the public demo is now deployed).
