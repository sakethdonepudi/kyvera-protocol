# Third-Party Notices

KYVERA itself is licensed under the MIT License (see `LICENSE`). It depends on
third-party packages with their own licenses. This inventory is a good-faith
summary, not legal advice; verify the exact obligations with the upstream
projects and counsel before distributing a commercial build.

## Runtime dependencies

| Package | License | Notes |
| --- | --- | --- |
| `@bitauth/libauth` | MIT | BCH primitives and CashAddr |
| `nostr-tools` | Unlicense | Nostr event signing and relay transport |
| `@wizardconnect/core` | LGPL-3.0-or-later | WizardConnect transport/protocol |
| `@wizardconnect/dapp` | LGPL-3.0-or-later | Dapp session/address derivation |
| `@wizardconnect/react` | LGPL-3.0-or-later | React hook and QR dialog |
| `@bch-wc2/interfaces` | MIT | WalletConnect transaction types |
| `@noble/curves`, `@noble/hashes`, `@noble/ciphers` | MIT | Cryptography primitives (transitive) |
| `@scure/*` | MIT | Encoding/HD-key helpers (transitive) |
| `qrcode` | MIT | BIP21 QR generation |
| `react`, `react-dom`, `next` | MIT | Web application |
| `ws` | MIT | Node WebSocket relay client |
| `eventemitter3` | MIT | WizardConnect events |
| `sharp`, `@img/sharp-*` | Apache-2.0 / LGPL-3.0-or-later | Next.js image tooling |

## LGPL note

The `@wizardconnect/*` packages are published under LGPL-3.0-or-later according
to the upstream repository README. The npm package metadata currently reports
`Unknown`, so this must be confirmed for the exact version used. Distributing a
bundled application that includes LGPL code may require preserving notices and
providing the corresponding library source or a relinking mechanism. The full
KYVERA source and lockfile are kept in this repository to support that review.

## Generated artifacts

`demo/kyvera-standalone.html` and `apps/web/public/kyvera-standalone.html` are
generated bundles that include these dependencies. Regenerate them with
`pnpm demo:standalone`; do not edit them by hand.

## Reporting

If you believe a notice is missing or inaccurate, open an issue in the
repository before redistribution.
