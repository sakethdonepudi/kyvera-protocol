# Security Policy

KYVERA is a hackathon prototype and has not been independently audited. Do not use it to protect real funds.

## Reporting a vulnerability

If you find a security issue in this repository, please report it privately to the maintainers rather than opening a public issue with a working exploit. Include:

- affected component and version/commit;
- a minimal reproduction;
- impact assessment;
- whether any key or funds could be affected.

There is no bug bounty program. Reports will be acknowledged on a best-effort basis.

## Scope

In scope:

- canonical encoding and record validation (`packages/core`);
- BCH proof verification and address association (`packages/bch`);
- Nostr event binding and relay handling (`packages/nostr`);
- chain resolution and authentication (`packages/verifier`);
- demo relay and browser key handling, within their stated demo limits.

Out of scope:

- losing all authorized keys (no recovery by design);
- relay collusion or withholding without a checkpoint (documented limitation);
- localStorage theft of explicitly labelled throwaway demo keys;
- wallet UI deception;
- denial of service, spam or relay availability.

## Disclosure

Please allow reasonable time for a fix before public disclosure. This project does not offer a paid bounty or a formal SLA.
