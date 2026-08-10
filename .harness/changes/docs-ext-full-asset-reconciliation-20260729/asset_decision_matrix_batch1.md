# EXT-A9 Asset Decision Matrix Batch 1

This matrix converts the first high-value asset batch into explicit decisions.
It does not authorize direct code integration. Every `ABSORB` or `REBUILD`
entry still requires a scoped Packet, isolated worktree, tests, QA review, and
Codex acceptance before entering `feature-chaotang-ext`.

## Current Authority Boundary

| Item | State | Decision |
| --- | --- | --- |
| Integration target | `feature-chaotang-ext` | Only target branch. |
| Current active package | `R0-W08` | Asset reconciliation may continue as W08 docs/governance work. |
| `R0-W09` | `STOP / BLOCKED_DEPENDENCY` | Do not activate or implement W09. |
| Production state | Not asserted | No push, deploy, DB migration, or 3050 operation. |

## Batch 1 Decisions

| Asset family | Candidate value | Conflicts / risks found | Decision | Reason | Next Packet |
| --- | --- | --- | --- | --- | --- |
| Department runtime wiring R1 | Runtime path for department capabilities and product orchestration. | Branch diff is broad and stale; direct application would remove current governance records. Existing W07/W08 contract spine has moved forward. | `REBUILD` | Preserve the department wiring idea, but rebuild against current `MissionContract -> EvidencePacket -> RiskItem -> FinalMemorial -> ContractReviewPack -> ArtifactManifest` spine. | `EXT-A9-B1-department-runtime-rebuild-design` |
| Dev EXT test domain switch | Demo switch / capability-gating pattern may help staged product exposure. | Contains sports/viewing domain assumptions that conflict with manufacturing/B2B contract review. Also modifies tooling and deletes current change records. | `CONFLICT_DECISION` | Select the generic capability gate concept only. Archive sports/viewing demo domain as future reference, not R0 product surface. | `EXT-A9-B2-capability-gate-extract` |
| Harness-only worktree | Possible workflow, harness, hooks, and 3050 isolation learnings. | Broad `.claude` / `.codex` / `.agents` rewrite; deletes current governance records. 3050 must not be operated or represented as product runtime. | `REBUILD` | Review missing workflow primitives only. Keep current Codex/Superpowers/gstack workflow as primary. Rebuild any useful checks as narrow harness rules or scripts. | `EXT-A9-D1-harness-tooling-review` |
| Jinyiwei real fetch | Real source acquisition is high value for evidence, due diligence, and audit replay. | Real network fetch creates SSRF, provenance, rate-limit, caching, auth, and source-label risk. Branch is stale relative to current EXT. | `ABSORB_AFTER_SECURITY_REVIEW` | The capability should exist, but only as a security-reviewed adapter with allowed sources, labels, and tests. No raw general fetch in product workflow. | `EXT-A9-E1-jinyiwei-source-adapter` |
| Temporal decision intelligence | Time-aware decision context for review deadlines, changed facts, expiry, and audit replay. | Historical design branch would delete current W07/W08 records if applied directly. It may create parallel decision semantics if imported as-is. | `REBUILD` | Rebuild as typed projections on the current backend fact model; do not introduce a second task/status system. | `EXT-A9-A1-temporal-decision-projection` |
| Deep module projection | Conceptual map for departments/modules and traceability. | Same stale branch pattern; risk of parallel module taxonomy competing with current architecture. | `REBUILD` | Keep the vocabulary and traceability idea, but bind it to current single data chain and department registry. | `EXT-A9-A2-module-projection-rebuild` |
| Menxia veto assets | Veto and fail-closed governance semantics. | Current EXT already appears to include Menxia gates. Need verify whether historical branches contain stronger negative cases. | `SUPERSEDED_VERIFY` | Do not absorb unless a missing fail-closed case is proven by diff/test review. | `EXT-A9-D2-menxia-veto-coverage-audit` |
| Gongbu safety assets | Safety/component-scope guards and fail-closed behavior. | Multiple P17/P18 branches; likely superseded but may contain isolated safety tests. | `SUPERSEDED_VERIFY` | Compare tests/hunks only; import missing safety tests if they strengthen current EXT without changing architecture. | `EXT-A9-D3-gongbu-safety-coverage-audit` |
| Guoli/Hanlin remnants | Hanlin writing/review value; Guoli historical governance/content value. | Hanlin exists in current EXT; Guoli may be outside current R0 contract-review spine or duplicated by Shiguan audit. | `ABSORB_OR_ARCHIVE` | Verify whether any unique user-visible department behavior remains. Archive title-only or duplicate residues. | `EXT-A9-B3-hanlin-guoli-residual-audit` |
| R0-W08 branch family | Golden matrix, browser flows, user acceptance gates, data-source audit, closeout preflights. | Many branches are likely already integrated. Direct branch application would delete current newer records in stale branches. | `SUPERSEDED_VERIFY` | Close by evidence mapping, not code merge. Any missing W08 verification becomes a small focused Packet. | `EXT-A9-F1-w08-family-coverage-closeout` |

## Product Conflict Decisions

| Conflict | Selected source of truth | Rejected / archived option | Reason |
| --- | --- | --- | --- |
| Product spine | Manufacturing/B2B contract review closure. | Sports, viewing, and generic demo domains. | R0 value is upload, parse, review, evidence, risk decision, ContractReviewPack, download, and Shiguan replay. Demos can be future capability references. |
| State ownership | Backend fact source plus typed frontend read model. | Frontend-only state or demo state machines. | Browser evidence must reflect real backend state; UI cannot be the authority for legal/review facts. |
| Task/status system | Existing harness authority and work package manifest. | Parallel task lists, branch-local completion states, or screenshot-only claims. | The project already suffered authority drift; one machine-readable authority must remain dominant. |
| Department model | Minimal activated department set with registry for future departments. | "All departments speak" as runtime requirement. | R0 needs reliable closure first. Department ideas are preserved as capability assets until tested. |
| External data | Security-reviewed adapters with source labels and audit lineage. | Raw free-form web fetch inside product flow. | Evidence value requires provenance, tenant/user binding, and failure semantics. |
| Tooling | Current Codex/Superpowers/gstack plus harness checks. | Wholesale `.claude`/`.codex`/`.agents` rewrites from stale worktrees. | Tooling can improve, but must not create a fourth product state surface or delete current records. |

## Recommended Execution Sequence

1. `EXT-A9-F1-w08-family-coverage-closeout`: fastest way to reduce duplicate W08 branches and confirm current acceptance inventory.
2. `EXT-A9-E1-jinyiwei-source-adapter`: highest product value that is not already fully represented, but must start with a security/test contract.
3. `EXT-A9-A1-temporal-decision-projection`: strengthens review quality and audit replay without changing pages.
4. `EXT-A9-B1-department-runtime-rebuild-design`: converts department ideas into current architecture rather than importing stale orchestration.
5. `EXT-A9-D1-harness-tooling-review`: capture only missing durable checks, no 3050 action.
6. `EXT-A9-B3-hanlin-guoli-residual-audit`: decide whether remnants add user-visible value or should be archived.

## Acceptance Rules For Future Absorption

- `ABSORB`: requires exact source refs, selected hunks/files, baseline test, implementation test, harness check, and independent QA review.
- `REBUILD`: requires current-EXT design spec, explicit old-asset mapping, TDD plan, and proof that no second product state surface is introduced.
- `SUPERSEDED_VERIFY`: requires evidence that current EXT already has equal or stronger behavior.
- `ARCHIVE`: requires rationale and pointer to preserved branch/worktree/change record.
- `CONFLICT_DECISION`: requires selected SSOT, rejected option, and reason visible in this matrix or a successor matrix.
