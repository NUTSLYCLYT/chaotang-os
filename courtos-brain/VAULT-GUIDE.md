# CourtOS-Brain vault guide

> Archived reference only. This is not a live agent entrypoint — see `.harness/rules/project-boundaries.md`
> at the repo root. The `$grow-courtos-knowledge` procedure referenced below is no longer a registered
> skill or command; its write-up now lives at
> `vault-workflows/grow-courtos-knowledge-notes/workflow-reference.md` (renamed from `.agents/skills/grow-courtos-knowledge/SKILL.md`,
> with the `skills/`, `agents/`, and `SKILL.md` path segments removed so nothing here matches any
> known agent/skill auto-discovery convention). Treat every mention of it below as documentation of a
> past manual workflow, not an instruction to invoke anything.

## Mission

Turn evidence into decisions and reusable methods. Do not optimize for note count.

## Read order

1. Read `知识库控制台.md` for the current operating model.
2. Read only the newest relevant raw notes and their linked `_wiki/sources/` records.
3. Read existing concepts before creating a new concept.
4. Use `$grow-courtos-knowledge` for ingestion, distillation, synthesis, or review work.

## Source of truth

- Raw evidence: `00-Inbox/`, `01-Daily-Briefings/`, `02-Chancellor-Reports/`, `04-Offices/`, `05-Swarms/`, `06-Chaotang-Xianhu/`, `06-Hermes-Research/`.
- Evidence summaries: `_wiki/sources/`.
- Reusable knowledge: `_wiki/concepts/` and `_wiki/entities/`.
- Deliverables: `03-Outputs/`.
- Reusable workflows: `vault-workflows/grow-courtos-knowledge-notes/`.

## Non-negotiable rules

- Never rewrite raw evidence unless the user explicitly asks.
- Never invent a source, date, quote, metric, decision, or relationship.
- Label unsupported interpretation as `待验证`.
- Prefer enriching an existing concept over creating a synonym or duplicate.
- Do not create empty concept/entity stubs. Create a page only when it has a sourced definition and at least one useful relationship or implication.
- Every synthesized claim must link to at least one source note.
- Keep facts, interpretation, decision, and next action visibly separate.
- Process at most 5 new concepts per run; prioritize high-reuse ideas.
- Before finishing, check links, frontmatter, duplicates, and `git diff`. Report evidence and unresolved uncertainty.

## Output contract

Each completed run reports: inputs read, files changed, concepts added or enriched, decisions/actions produced, validation performed, and unresolved questions.
