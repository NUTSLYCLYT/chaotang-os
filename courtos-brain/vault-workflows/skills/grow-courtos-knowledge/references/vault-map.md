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
