# Codex Independent QA Pass 2: Rejected Candidate

| Field | Value |
| --- | --- |
| Canonical platform session | `019f9cf4-7bb2-79a3-ba7e-277a0eec60c8` |
| Candidate | `08555c3b25e610909b270861abe25782c1e46aa3` |
| Tree | `3cae62bd5724622964a09c214d7798880b371977` |
| Package SHA-256 | `8e6cdb79e160039655802378fdcacbc9cbdcd65002a30317b86d1f8e393dc7cc` |
| Verdict | `NO_GO` |
| HIGH | `1` |
| MEDIUM | `0` |
| Write access | `DENIED` |
| Candidate mutated | `NO` |

## Blocking Finding

An earlier terminal W07 ledger entry could be removed before overlay
registration, allowing the later activation to appear new.

The platform notification is the session identity trust root. A different
self-reported UUID in reviewer prose is not used as governance identity.
