# Capability candidates

This directory contains offline, content-addressed capability capsules. Files here are inert evaluation assets, not runtime registration or production authority.

- A candidate may request permissions, but only the root-owned `authority-manifest.json` can project grants. Candidate directories never contain or own trusted authority.
- `candidate` status is intentionally zero-authority: no tools, no data domains, and no external writes, even if a future projection were broader.
- Production validation accepts lifecycle states only through `candidate`; `shadow`, `canary`, and `stable` are rejected.
- Prompt, contract, policy, and evaluation content have independent digests.
- A lockfile pins the entire capsule and every referenced local object.
- Kill switches, taint restrictions, context rent, and direct fallback fail closed.
