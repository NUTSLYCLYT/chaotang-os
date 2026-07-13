---
name: source-agents-skills-grow-courtos-knowledge-references-vault-map
type: source
source_kind: raw
raw_path: /home/ubuntu/CourtOS-Brain/.agents/skills/grow-courtos-knowledge/references/vault-map.md
ingested_at: 2026-07-13
updated_at: 2026-07-13
schema_version: 1
---

# .agents/skills/grow-courtos-knowledge/references/vault-map.md

## TL;DR

CourtOS-Brain vault maps evidence layers to knowledge systems with strict promotion rules for concepts and skills to avoid stubs.

## 关键事实

- Raw evidence layer preserves original evidence and provenance
- Promote raw material to concept only with sourced definition, non-trivial relationships, and reuse potential

## 关联 concepts

- [[concepts/courtos-brain]]
- [[concepts/vault-map]]

## 关联 entities

- [[entities/service/courtos-brain]] · CourtOS-Brain

## 原文摘录

> # CourtOS-Brain vault map
> 
> ## Layers
> 
> | Layer | Location | Contract |
> |---|---|---|
> | Raw evidence | `00-Inbox/`, `01-Daily-Briefings/`, `02-Chancellor-Reports/`, `04-Offices/`, `05-Swarms/`, `06-Chaotang-Xianhu/`, `06-Hermes-Research/` | Preserve original evidence and provenance. |
> | Source records | `_wiki/sources/` | One evidence-backed summary per raw note; include `raw_path` and ingestion date. |
> | Knowledge | `_wiki/concepts/`, `_wiki/entities/` | Reusable, sourced concepts and entities; avoid synonyms and stubs. |
> | Audit | `_wiki/audit/` | Quality findings, drift, contradictions, broken links, and maintenance backlog. |
> | Outputs | `03-Outputs/` | Decision memos, briefs, reports, drafts, and other deliverables. |
> | Methods | `.agents/skills/` | Repeated workflows with explicit qual

---
*compiled by LLM-Wiki ingest · model=ollama-fast*
