# G5 Mingshuo Solution Hub Vertical Target · 2026-09-04

## Status

Review

## Baseline

- Repository: `gitee.com/msxn/chaotang-os`
- Branch: `origin/ext-dev`
- Baseline HEAD: `e9597ec2a01c93636bdea208d6919681d48df21b`
- Baseline tree: `8e89b47a0f54e0ff75362713fd1c1527339af2c3`
- Observation mode: product convergence design only
- Production deployment: not authorized and not performed

This document registers the Mingshuo solution-hub work as a vertical slice over
the current `ext-dev` mainline. It does not authorize product runtime changes,
third-party publication, IMA writes, LangGraph promotion, equipment operation,
recipe release, customer-data ingestion, candidate commits, or deployment.

## Product-management target

The vertical exists to make one customer-facing loop coherent:

`需求 → 事实母表 → 证据包 → 方案/图纸/报价/风险 → 客户版交付 → 项目版交付 → 客户沟通教练 → 史馆结果 → 知识候选回写`

The first usable version should support a small number of manually supplied,
evidence-labeled product/project facts. It must not claim real product
performance, certification, price, MOQ, lead time, or availability unless the
corresponding evidence is present and approved.

## Canonical source policy

Mingshuo must reuse the existing CourtOS source hierarchy:

| Layer | Role | Boundary |
| --- | --- | --- |
| IMA raw layer | read-only source evidence | No direct truth promotion and no write-back. |
| Structured truth layer | server-owned normalized facts | Must bind tenant, source, evidence, version, and digest. |
| Project private layer | customer/project-specific context | Tenant-scoped; never becomes public product truth without review. |
| Shiguan outcome layer | immutable result/outcome record | Receives verified outcomes and receipts; not a second editor. |
| Candidate knowledge layer | proposed reusable knowledge | Requires human and governance review before promotion. |

No large model, swarm, LangGraph graph, MCP adapter, spreadsheet, or IMA record
is allowed to become the final authority. They can propose, extract, classify,
or summarize only after the server binds evidence and owner identity.

## Reuse-first module map

| Capability | Reuse target | New concept allowed |
| --- | --- | --- |
| Customer requirements | current decree/draft and scene-pack intake | `MingshuoProjectFactPackV1` as a bounded project packet. |
| Cell selection | existing battery/cell engineering skill knowledge | Evidence-bounded candidate scoring, not autonomous release. |
| PACK and power solution | existing PACK and quotation capability families | Consumes released cell facts; must not rewrite cell parameters. |
| Quotation and risk | Hubu/accounting, quotation, risk actions | Draft-only unless evidence, price authority, and approval exist. |
| Stage gate | battery stage-gate and quality/review patterns | Gate status `PASS/HOLD/BLOCK` with owner and missing data. |
| Customer success | customer communication and Honglusi surfaces | Coach wording and next steps, not external publication. |
| Yushi / review | existing review and security gates | Independent review of claims, safety, and authority boundaries. |
| Shiguan | current archive/recall | Verified results, feedback, and reusable lessons only. |

## Proposed data contracts

`MingshuoProjectFactPackV1` should eventually contain:

- tenant and project identity;
- customer request and intended market;
- product-line family: cell, PACK/power, PV-storage-charging, or design
  solution;
- evidence packet references;
- source classification: public candidate, supplier asserted, internal
  measured, third-party verified, or frozen released;
- key parameters with units and conditions;
- missing fields and `HOLD` reasons;
- claim eligibility and forbidden claims;
- owner, reviewer, version, raw source digests, and packet digest.

`Evidence Packet` should eventually contain:

- source ID, origin, owner, collection time, and allowed use;
- hash/digest of raw and normalized evidence;
- scope: model/SKU/batch/project/market/language;
- expiry or review date;
- adoption status and reviewer;
- revocation or supersession pointer.

The contracts must be introduced only through a product successor with machine
authority. This document only defines the target shape.

## Market and project deliverables

The first vertical should target two output groups:

1. Market-facing package:
   - product truth card;
   - evidence-bounded listing copy;
   - risk and forbidden-claim sheet.
2. Project-facing package:
   - requirement clarification;
   - solution architecture;
   - cell/PACK candidate rationale;
   - drawing or BOM placeholder list;
   - quotation assumptions;
   - delivery/risk plan;
   - customer communication script.

Every claim must pass claim-evidence binding. If evidence is absent, the output
must say what is missing and ask for owner input instead of inventing facts.

## Safety and efficiency rules

- Third-party skills or external tools start as `DISCOVERED` or `CANDIDATE`;
  they cannot become `ACTIVE` without tenant-scoped activation and kill switch.
- Cell chemistry, process, EHS, equipment, and quality release details require
  evidence and human sign-off; do not generate operational recipes or equipment
  control instructions.
- Product listings, Alibaba/website/miniprogram publishing, emails, and RFQ
  replies remain draft/manual-approval only for M1.
- Knowledge write-back goes to a candidate area first; no automatic promotion
  from customer project output into public product truth.
- Token economy comes from one fact packet and one evidence packet per project,
  not from many agents restating the same background.

## Suggested successor

Recommended task:

`MINGSHUO-SOLUTION-HUB-V1-FACT-PACK-BLUEPRINT-SUCCESSOR-20260904`

Recommended approval commit paths:

- `.harness/approvals/MINGSHUO-SOLUTION-HUB-V1-FACT-PACK-BLUEPRINT-SUCCESSOR-20260904.json`
- `docs/product/tasks/2026-09-04-mingshuo-solution-hub-v1-fact-pack-blueprint-successor.md`
- `docs/superpowers/plans/2026-09-04-mingshuo-solution-hub-v1-fact-pack-blueprint-successor.md`

Suggested first candidate should be docs/contracts and tests only unless a fresh
scan proves the minimal runtime insertion point:

- define `MingshuoProjectFactPackV1` and `Evidence Packet` schemas;
- add fail-closed tests for missing evidence, stale certification, unsupported
  market, missing price authority, unsafe technical instructions, and
  unauthorized knowledge promotion;
- map the vertical to existing decree, Scene Pack, Shiguan, Honglusi, and
  Claim-Evidence surfaces without creating a second runtime.

Runtime paths, frontend workbench paths, and IMA adapter paths must be frozen by
that successor after machine approval, not guessed here.

## Open questions for Owner

- Which 3-5 SKU/project candidates have real source materials ready for a
  non-production pilot?
- Which materials are internal, supplier asserted, third-party verified, or
  public-only?
- Which output is required first for the roadshow follow-up: product truth card,
  solution proposal, RFQ quote draft, or customer communication coach?
- Which channels are allowed for manual preview only, and which are forbidden
  until production credentials and approvals exist?

## Decision

`G5_MINGSHUO_VERTICAL_REGISTERED / FOURTH_MAINLINE_FORBIDDEN / FACT_PACK_SUCCESSOR_REQUIRED`

Mingshuo should become the first serious industry vertical for CourtOS, not a
parallel platform. The winning shape is one canonical fact packet, one evidence
packet, controlled deliverables, human-approved external use, and Shiguan-based
learning after results are real.
