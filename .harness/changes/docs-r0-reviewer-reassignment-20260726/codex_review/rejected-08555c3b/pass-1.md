# Codex Independent QA Pass 1: Rejected Candidate

| Field | Value |
| --- | --- |
| Canonical platform session | `019f9cf4-7b7d-7840-85b4-953d47fa995d` |
| Candidate | `08555c3b25e610909b270861abe25782c1e46aa3` |
| Tree | `3cae62bd5724622964a09c214d7798880b371977` |
| Package SHA-256 | `8e6cdb79e160039655802378fdcacbc9cbdcd65002a30317b86d1f8e393dc7cc` |
| Verdict | `NO_GO` |
| HIGH | `2` |
| MEDIUM | `2` |
| Write access | `DENIED` |
| Candidate mutated | `NO` |

## Blocking Findings

1. An earlier terminal W07 could be deleted before registration and then
   accepted as a first activation.
2. The v2 loader did not directly hash the canonical amendment path.
3. Activation verification resolved mutable `HEAD` more than once.
4. Governed files did not reject externally aliased hardlink inodes.

The platform notification is the session identity trust root. A different
self-reported UUID in reviewer prose is not used as governance identity.
