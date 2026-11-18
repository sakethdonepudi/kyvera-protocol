# KYVERA Design System

**Direction:** premium security research instrument with Swiss editorial influence.
**Not:** generic Web3 gradients, glowing spheres, 3D cubes, fake badges.

The interface is designed to make cryptographic state legible without turning every screen into a JSON viewer. Technical detail is always available, never forced.

---

## 1. Typography

| Role | Stack | Usage |
| --- | --- | --- |
| Display | Iowan Old Style / Palatino / Georgia / serif | Page titles and section statements. Editorial, not decorative. |
| Sans | Helvetica Neue / Helvetica / Arial / system | Controls, body copy, status text. |
| Mono | SF Mono / Menlo / Consolas | Addresses, digests, signatures, timestamps, micro-labels. |

Rules:

- Display headings use tight leading (`0.98–1.1`) and slight negative tracking.
- Micro-labels are 9–10px mono, uppercase, 0.12–0.2em tracking.
- Body copy is 11–14px with generous line-height.
- No display font inside dense data tables.
- Numbers and identifiers are always monospaced.

---

## 2. Colour and themes

Primary theme: obsidian dark. Secondary theme: warm light. Both are driven by CSS variables in `apps/web/app/globals.css`; Tailwind tokens (`.config.ts`) consume them, so every route switches without duplicate styles.

| Token | Dark | Warm light | Meaning |
| --- | --- | --- | --- |
| `charcoal-950` | `#080A0E` | `#F7F5F0` | Page background |
| `charcoal-900` | `#11151A` | `#FFFDF8` | Panels |
| `charcoal-850` | `#161B21` | `#FAF7F1` | Raised panels |
| `charcoal-700` | `#2B333C` | `#E2DCD1` | Hairlines / inset surfaces |
| `ivory` | `#F6F5F1` | `#17191B` | Primary text |
| `ivory-dim` | `#C7C7C0` | `#3F4142` | Secondary text |
| `ivory-muted` | `#8E9497` | `#6C6A64` | Annotations |
| `signal` | `#F28A54` | `#C74B1E` | Action / transition / warning |
| `accent` | `#8FD9BE` | `#2B7056` | Verified / active |
| `ice` | `#A8D9F0` | `#286E91` | Informational freshness |
| `danger` | `#D65E52` | `#A5372D` | Conflict / invalid / revoked |

Rules:

- Signal orange is scarce: actions, current/historical boundary, warnings.
- Mint is reserved for verified states.
- Red is reserved for conflict, invalidity, revocation.
- Muted text is for annotations, never essential body copy.

Theme switching:

- `data-theme="light"` on `<html>`.
- Preference stored in `localStorage["kyvera-theme"]`; an inline pre-paint script prevents flash.
- Toggle in the navigation; `prefers-color-scheme` is not forced.

---

## 3. Glass material

`GlassPanel` / `.glass` / `.glass-strong`:

- translucent surface, 20–26px backdrop blur, thin border, directional shadow;
- fallback to an opaque surface when `backdrop-filter` is unsupported;
- used for navigation, hero instrument, identity summary, payment handoff, Time Machine inspection and dialogs;
- **not** used for long proof text, dense tables or nested glass-on-glass.

Glass radius is 22px; technical cards remain 2px and solid for readability.

---

## 4. Layout and surfaces

- Max content width: 1240px.
- Hairline borders: 1px `var(--glass-border)`.
- Glass surfaces: 22px radius; technical cards: 2px.
- Grid: asymmetric editorial split; 12-column rhythm where useful.
- Background: obsidian or warm white, faint 48px grid, three restrained aurora fields.
- Negative space is deliberate; dense cryptographic detail lives in inspectable panels.

---

## 5. Components

| Component | Rule |
| --- | --- |
| `GlassPanel` | Translucent 22px surface for navigation/summary/inspection/dialogs. |
| `Card` | Solid 2px technical surface for dense data. |
| `Button` primary | Signal fill, charcoal text, rounded-full for primary actions. Disabled becomes a hairline ghost. |
| `Button` secondary | Transparent with an ivory hairline. |
| `StatusBadge` / `VerificationBadge` | The only status-colour chip; label always present. |
| `CopyableHash` | Monospace value + copy control. |
| `Time Machine` | Solid timeline; glass detail drawer; Compare mode separates historical validity from current authorization. |
| `RelayStatus` | Dot + URL + events/latency/EOSE; colour reflects actual reachability. |
| `WalletConnect` | WizardConnect state, QR pairing, wallet name and derived address. |
| `PaymentConfirmation` | Explicit checkbox, re-resolve, destination-change cancellation, BIP21/QR handoff. |
| `SecurityScenario` | Left controls/inputs, right verifier output; simple/advanced. |

## 6. Motion

- One short fade (`160ms`) for resolved content.
- No looping animation, no parallax, no ambient glow.
- Progress bars animate only when a real action is running.
- `prefers-reduced-motion: reduce` reduces all animation and transition durations to ~0ms.

---

## 7. Accessibility

- Semantic `button`, `a`, `label`, `summary` elements.
- Every interactive control has a visible focus ring.
- Icon-only controls have `aria-label` (e.g. relay removal).
- Toggle groups use `aria-pressed`.
- Status meaning is never conveyed by colour alone: the label is always present.
- Keyboard-only navigation is tested in `scripts/qa-browser.mjs`.
- Mobile layouts are checked for horizontal overflow at 390px.
- Long identifiers use `break-all` or scroll containers; they never force page-level overflow.
- Reduced-motion is tested.

---

## 8. Content rules

- Distinguish **cryptographic validity**, **current authorization**, **relay freshness** and **historical state** in every relevant view.
- Never write "verified" for a fixture unless the fixture label is adjacent.
- Never show a fake transaction hash, address or success badge.
- Prefer a precise limitation sentence over a marketing adjective.
- Use "the verifier refuses to fall back" / "no address asserted" rather than implying safety.
- Competitor comparisons are design/scope differences, not vulnerability claims.

---

## 9. Implementation map

- Tokens: `apps/web/tailwind.config.ts`, `apps/web/app/globals.css`
- Primitives: `apps/web/components/ui.tsx` (`GlassPanel`, `VerificationBadge`, `CopyableHash`)
- Chrome / theme: `apps/web/components/chrome.tsx`, `apps/web/components/theme-toggle.tsx`
- Time Machine: `apps/web/components/time-machine.tsx`
- Lifecycle instrument: `apps/web/components/lifecycle-demo.tsx`
- Resolution views: `apps/web/components/resolution.tsx`
- Pay: `apps/web/app/pay/page.tsx`, `apps/web/lib/pay.ts`
- QA: `scripts/qa-browser.mjs`
