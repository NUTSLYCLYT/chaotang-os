# 规格说明：docs-r0-w08-activation-design-20260728-20260728

## 背景

R0-W07 has been quiescently closed on local EXT
`28f8e0c6d566dc866a7de2e4da9d32a8361820a7`. All R0-W00 through R0-W07 entries
are `MERGED_AND_VERIFIED`, and `activeWorkPackage` is `null`.

The next product need is not another page or another agent. The next need is to
prove that the existing contract-review product loop works for real users, real
backend state, downloadable artifacts, and audit replay.

## W08 Definition

R0-W08 is `Product Acceptance Hardening`.

It converts the current runnable product into an acceptance-ready product by
standardizing:

- golden contract coverage;
- real-backend browser flow evidence;
- non-developer user acceptance;
- ContractReviewPack download evidence;
- Shiguan audit replay evidence;
- QA rejection rules for mock-only or partial proof.

## Current Facts

| 分类 | 结论 | 证据 / 命令 | 阻塞 |
| --- | --- | --- | --- |
| Authority | W07 closed; no active work package | `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` returns `STOP / NO_ACTIVE_WORK_PACKAGE` | 否 |
| Integration target | local EXT base is `28f8e0c6...` | `git rev-parse HEAD` in isolated worktree | 否 |
| W08 scope | design/evidence only in this Packet | Product Owner approval text | 否 |
| Production | not deployed, no 3050 takeover, no DB migration | explicit boundary | 否 |
| Product code | no product-code edits in this Packet | path scope | 否 |

## Product Flow Under Test

The complete product loop for W08 acceptance is:

```text
1. Upload a Chinese manufacturing / B2B contract
2. Parse contract into MissionContract
3. Produce EvidencePacket
4. Create RiskItem set
5. Perform evidence supplementation / rework where required
6. Produce FinalMemorial / risk decision
7. Generate ContractReviewPack
8. Generate ArtifactManifest with PDF, DOCX, and JSON entries
9. Store artifacts and authorize download
10. Download and inspect artifacts
11. Reopen in Shiguan audit replay with same lineage
```

## Acceptance Gates

| Gate | Required Evidence | Pass Rule |
| --- | --- | --- |
| Golden dataset | 36 golden contracts with category, expected risks, expected artifact state, and replay expectation | 36/36 cases are versioned and runnable |
| Real backend browser flow | Browser evidence against real backend endpoints, not frontend mocks | 10/10 complete runs pass |
| Non-developer users | Five observed users run the canonical flow with no developer accompaniment | At least 4/5 complete the flow |
| ContractReviewPack | Downloaded packet contains manifest, PDF, DOCX, JSON, lineage, and audit identifiers | 10/10 sampled flow downloads pass |
| Shiguan replay | Reopened audit shows the same MissionContract, EvidencePacket, RiskItem, FinalMemorial, ContractReviewPack, and ArtifactManifest lineage | 10/10 sampled flow replays pass |
| QA audit | Independent QA checks evidence, mocks, tenant/user boundaries, partial delivery, and replay consistency | HIGH 0 / MEDIUM 0 |

## Architecture Boundary

W08 uses the existing architecture:

```text
frontend /shangshufang
-> typed read model
-> backend contract/review/artifact services
-> ContractReviewPack + ArtifactManifest
-> authorized download
-> frontend /shiguan audit replay
```

No new page, agent, BFF, product task status system, or competing authority
system is allowed in W08. Any future implementation must reuse existing
`/shangshufang` and `/shiguan` surfaces unless a later exact amendment says
otherwise.

## Evidence Model

Each accepted W08 run must record:

- exact Git HEAD and tree;
- backend server command and port;
- frontend server command and port;
- database mode and seed identity;
- golden contract id and category;
- browser trace/screenshot/video location;
- API request/response evidence for upload, parse, review, artifact, download,
  and replay;
- downloaded artifact hashes;
- user tester id or anonymized participant id;
- PASS/FAIL reason and reviewer.

## Phase Plan

### Phase 0 Governance / Authority

- Produce this non-authorizing design Packet.
- Run authority checks proving W08 is still inactive.
- Prepare later exact-H activation candidate only after review approval.

### Phase 1 Golden Dataset Contract

- Define the 36-contract matrix and expected outcomes.
- Classify by manufacturing/B2B risk family: payment, delivery, acceptance,
  warranty, liability, IP/confidentiality, termination, dispute, compliance.
- Define redaction rule: no real customer secret enters Git.

### Phase 2 Real Backend Browser Flow

- Define the canonical 10-run test path through `/shangshufang`.
- Require real backend endpoints and server-side read model.
- Reject mock-only screenshots, dry-run-only backend logs, and manually edited
  artifact outputs.

### Phase 3 Human Acceptance

- Prepare a short task script for five non-developer users.
- Measure completion without developer accompaniment.
- Record blockers as product defects, not as tester failure.

### Phase 4 Artifact And Audit Evidence

- Verify ContractReviewPack download and ArtifactManifest entries.
- Verify Shiguan replay reads the same lineage.
- Verify partial delivery states, incomplete reason, and resume semantics where
  a case intentionally fails or pauses.

### Phase 5 Closeout / W09 Readiness

- Close W08 only after evidence passes.
- Hand W09 the frozen acceptance evidence for final candidate / release identity
  readiness.
- W09 remains separate from deployment, DB migration, and 3050 takeover unless a
  future approved package explicitly changes that.

## Window Allocation

| Window | Owner | Scope | Files In Future Implementation | Out Of Scope | Verify |
| --- | --- | --- | --- | --- | --- |
| 0 Governance | EXT Master Governance | authority, task contract, evidence index, closeout | `.harness/**`, docs | product code | authority CLI, root doctor |
| 1 Golden Dataset | Product Acceptance | 36 contract matrix and expected decisions | `backend/harness/**`, docs | runtime feature changes | dataset validator |
| 2 Browser QA | Browser QA | 10/10 real backend browser runs | `frontend/e2e/**`, evidence artifacts | mock-only proof | Playwright/browser traces |
| 3 Artifact Evidence | Backend Evidence | ContractReviewPack and ArtifactManifest evidence | backend tests/harness only after W08 activation | new artifact architecture | API contract tests |
| 4 Frontend Acceptance | Frontend UX | `/shangshufang` and `/shiguan` acceptance defects | existing approved surfaces only | new pages/agents | focused frontend/browser tests |
| 5 QA Auditor | QA Auditor | read-only rejection review | review reports only | implementation | HIGH 0 / MEDIUM 0 |

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Treating runnable minimum as product acceptance | false completion claim | W08 requires human + browser + artifact + replay evidence |
| Golden contracts are too synthetic | weak product proof | include real-world manufacturing/B2B clauses, redacted and versioned |
| Browser proof uses mocks | invalid acceptance | require server logs/API evidence tied to browser run ids |
| Users are over-guided | false usability signal | no developer accompaniment; record only allowed prompt script |
| W08 grows into feature expansion | schedule drift | defects triaged; only blocker fixes after exact authority |
| W09 starts before W08 evidence | release identity has weak product basis | W09 waits for W08 closeout evidence |

## Non-Goals

- No W08 activation in this Packet.
- No product code change in this Packet.
- No new agent, new page, BFF, or state machine.
- No push, deployment, DB migration, or listener 3050 operation.
- No production release claim.

## Verification Plan For This Packet

- `git status --short --branch`
- `node scripts/execution-authority.mjs --check`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- `node scripts/harness-doctor.mjs`
- `git diff --check`
