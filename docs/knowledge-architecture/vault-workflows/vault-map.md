---
source_id: repo_archive
source_path: courtos-brain/vault-workflows/grow-courtos-knowledge-notes/references/vault-map.md
content_hash: sha256:d692e2e2a7fafc36829ce4d3ddefc0943d74b6026bd42f23b95c8b3e56423f0f
trust_tier: methodology
k0a_snapshot_token: sha256:8e944de6c327cb9868e588abe3ae34c2478ce0cc92f48e8dc0030e6011665d71
absorbed_at: 2026-07-14
---
# CourtOS-Brain vault map

## Layers

| Layer | Location | Contract |
|---|---|---|
| Raw evidence | `00-Inbox/`, `01-Daily-Briefings/`, `02-Chancellor-Reports/`, `04-Offices/`, `05-Swarms/`, `06-Chaotang-Xianhu/`, `06-Hermes-Research/` | Preserve original evidence and provenance. |
| Source records | `_wiki/sources/` | One evidence-backed summary per raw note; include `raw_path` and ingestion date. |
| Knowledge | `_wiki/concepts/`, `_wiki/entities/` | Reusable, sourced concepts and entities; avoid synonyms and stubs. |
| Audit | `_wiki/audit/` | Quality findings, drift, contradictions, broken links, and maintenance backlog. |
| Outputs | `03-Outputs/` | Decision memos, briefs, reports, drafts, and other deliverables. |
| Methods | `.agents/skills/` | Repeated workflows with explicit quality gates. |

## Existing risk pattern

The vault already has strong automated intake but historically generated many placeholder concepts and entity stubs. Treat `status: stub`, `待 audit cron 合成`, generic placeholder text, and duplicate transliterations as backlog—not as knowledge.

## Retrieval order

1. Start from the user question or current decision.
2. Search concepts/entities for existing knowledge.
3. Follow their source links to evidence.
4. Read raw notes only where the claim or context needs verification.
5. Produce an output and link it back to the concepts and evidence used.

## Promotion rule

Promote raw material into a concept only when it has:

- a sourced one-sentence definition;
- at least one non-trivial relationship, implication, or decision use;
- a clear reason it will be retrieved again.

Promote a repeated procedure into a skill after it has been used or requested at least 3 times, or earlier when mistakes would be costly.
