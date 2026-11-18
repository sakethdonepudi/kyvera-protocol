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

## 2. Colour

| Token | Hex | Meaning |
| --- | --- | --- |
| `charcoal-950` | `#0A0A08` | Page background |
| `charcoal-900` | `#0F0F0C` | Panels |
| `charcoal-850` | `#14130F` | Raised panels |
| `charcoal-700` | `#24221C` | Hairlines / inset surfaces |
| `ivory` | `#F1ECDF` | Primary text |
| `ivory-dim` | `#D8D1C2` | Secondary text |
| `ivory-muted` | `#8F8A7D` | Annotations, labels |
| `signal` | `#F05A28` | Action, current transition, warning |
| `accent` | `#5E9C82` | Verified / active / valid |
| `danger` | `#C25B4E` | Conflict, invalid, revoked |

Semantic usage:

- **Signal orange is scarce.** Primary actions, the current/historical boundary, warning states. It is not a decorative wash.
- **Emerald is reserved for verified states** and successful proofs.
- **Red is reserved for conflict, invalidity and revocation.** It is never used for ordinary errors alone.
- Muted ivory carries metadata; it is not used for body text where reading matters.

Contrast: body text uses ivory on charcoal; muted text is reserved for non-essential annotations. Focus outlines use signal orange at 75% opacity with a 2px offset.

---

## 3. Layout and surfaces

- Max content width: 1240px.
- Hairline borders: `1px` ivory at 8–15% opacity.
- Corners: 2px maximum. Pills/status chips use 2px or full radius only when semantically a tag.
- Grid: 12-column editorial layout; asymmetric two-column sections are preferred over centred card stacks.
- Background: near-black with a faint 48px grid, masked to the top of the page.
- Negative space is deliberate. Dense cryptographic detail lives in inspectable panels, not the hero.

---

## 4. Components

| Component | Rule |
| --- | --- |
| `Button` primary | Signal fill, charcoal text, square corners. Disabled becomes a hairline ghost, never a muddy orange. |
| `Button` secondary | Transparent with an ivory hairline. |
| `Card` | 1px hairline, charcoal panel, 2px radius, no shadow. |
| `Badge` | Mono uppercase micro-label; semantic tone only. |
| `StatusBadge` | The only place a status colour becomes a filled chip. |
| `Kicker` / `SectionLabel` | Mono, uppercase, wide tracking; always above a heading. |
| `Input` | Charcoal inset, ivory hairline, signal focus. Labels are mono uppercase. |
| `CopyButton` | Small mono outlined control with copied feedback. |
| `Alert` | Hairline tone, no icon decoration; title + concise body. |
| Time Machine node | 180–210px instrument tile, selected node has a signal top rule and border. |
| Evidence rows | Definition-list style; values break-all, never truncated without a copy control. |

---

## 5. Motion

- One short fade (`160ms`) for resolved content.
- No looping animation, no parallax, no ambient glow.
- Progress bars animate only when a real action is running.
- `prefers-reduced-motion: reduce` reduces all animation and transition durations to ~0ms.

---

## 6. Accessibility

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

## 7. Content rules

- Distinguish **cryptographic validity**, **current authorization**, **relay freshness** and **historical state** in every relevant view.
- Never write "verified" for a fixture unless the fixture label is adjacent.
- Never show a fake transaction hash, address or success badge.
- Prefer a precise limitation sentence over a marketing adjective.
- Use "the verifier refuses to fall back" / "no address asserted" rather than implying safety.
- Competitor comparisons are design/scope differences, not vulnerability claims.

---

## 8. Implementation map

- Tokens: `apps/web/tailwind.config.ts`, `apps/web/app/globals.css`
- Primitives: `apps/web/components/ui.tsx`
- Chrome: `apps/web/components/chrome.tsx`
- Time Machine: `apps/web/components/time-machine.tsx`
- Lifecycle instrument: `apps/web/components/lifecycle-demo.tsx`
- Resolution views: `apps/web/components/resolution.tsx`
- QA: `scripts/qa-browser.mjs`
