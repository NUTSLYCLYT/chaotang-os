---
name: grow-courtos-knowledge
description: Grow and maintain the CourtOS-Brain Obsidian vault by ingesting new material, distilling sourced concepts, connecting related knowledge, producing decision-ready outputs, and reviewing stale or duplicate notes. Use for requests such as 整理知识库, 摄取资料, 提炼概念, 建立双链, 生成复盘, 形成方法论, 知识库巡检, or turning CourtOS research and swarm notes into reusable knowledge.
---

# Grow CourtOS Knowledge

Build a small number of trustworthy, reusable knowledge nodes from evidence. Optimize for retrieval, decisions, and feedback—not note volume.

## Select one mode

- **Ingest**: Convert a new raw note into a source record without altering the raw note.
- **Distill**: Enrich up to 5 high-value concepts from one or more source records.
- **Connect**: Repair duplicates, synonyms, weak links, and orphaned notes.
- **Apply**: Produce a decision memo, project brief, content draft, or method in `03-Outputs/`.
- **Review**: Audit a time window for stale claims, contradictions, empty stubs, missing feedback, and unfinished actions.

Read [references/vault-map.md](references/vault-map.md) before the first run in this vault.

## Workflow

1. **Define the run contract**
   - State mode, input scope, desired output, time window, and maximum files to change.
   - Default to one smallest useful vertical slice.

2. **Read evidence first**
   - Read the raw note and existing `_wiki/sources/` record when present.
   - Search existing concept/entity titles and aliases before creating anything.
   - Separate confirmed facts, interpretation, unknowns, and user decisions.

3. **Pass the value gate**
   - Retain a concept only if it is likely to be reused in a decision, project, explanation, or repeated workflow.
   - Merge synonyms into the strongest existing page.
   - Do not create a page that would contain only a definition and one source link.

4. **Write the smallest durable update**
   - Preserve raw evidence.
   - Link each synthesized claim to a source note.
   - Add relationships only when the evidence supports them.
   - Put deliverables in `03-Outputs/`; put repeatable procedures in `.agents/skills/`.

5. **Close the loop**
   - Add a decision, next action, owner, or explicit `仅供参考` outcome.
   - When an output later receives feedback or results, link that feedback back to the concepts/method used.

6. **Validate**
   - Search for duplicate titles and aliases.
   - Check changed wikilinks resolve or are intentionally marked `待创建`.
   - Check frontmatter parses consistently with neighboring notes.
   - Inspect `git diff` and do not overwrite unrelated user changes.

## Quality gates

A run is incomplete if any answer is yes:

- Did it invent a source or silently fill an unknown?
- Did it create a synonym instead of enriching an existing concept?
- Did it create an empty or low-value stub?
- Did it summarize without producing a decision, action, reusable method, or explicit no-action conclusion?
- Did it change more than the agreed scope?
- Did it skip validation?

## Report

Return a compact ledger:

- Inputs read
- Files changed
- Concepts added/enriched/merged
- Decisions and next actions
- Validation evidence
- Unknowns requiring human judgment
