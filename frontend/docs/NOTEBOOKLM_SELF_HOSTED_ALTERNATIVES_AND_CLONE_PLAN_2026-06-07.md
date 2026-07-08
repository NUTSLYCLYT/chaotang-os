# NotebookLM Self-Hosted Alternatives And Chaotang Clone Plan

Date: 2026-06-07

Goal: give Chaotang OS a NotebookLM-like research and learning capability
without depending on unofficial Google-cookie automation.

We will not copy Google's code, branding, UI, prompts, voices, or private
implementation. We will copy the product capability pattern:

- source-grounded notebooks;
- cited answers;
- study guides;
- FAQ / timeline / briefing docs;
- audio-style learning scripts;
- exportable research artifacts;
- skill distillation into agent workflows.

## Current Tool Read

NotebookLM is useful as a human research workbench, but public information still
does not make it a dependable official automation backend for Chaotang.

Open/self-hosted alternatives and references reviewed:

- NotebookLlama: open-source NotebookLM-style project backed by LlamaIndex /
  LlamaCloud patterns. Source: `https://github.com/run-llama/notebookllama`
- Open Notebook: open-source NotebookLM-like notebook with multi-format
  ingestion, AI summaries, and podcast-style generation. Source:
  `https://github.com/lfnovo/open-notebook`
- AnythingLLM: strong open-source document chat / workspace RAG candidate.
- SurfSense: open-source team research workspace often positioned as a
  NotebookLM alternative, with connectors and podcast generation.
- SoyLM / local RAG references: local-first RAG with web/file ingestion,
  Playwright fallback, SQLite FTS/BM25, SSE streaming, and deduplication.
- Podcastfy: open-source Python library for NotebookLM-style multi-speaker audio
  from URLs, PDFs, YouTube, images, or text.

Research caution:

- Many "best alternatives" lists are affiliate/content marketing.
- GitHub projects vary widely in maturity.
- Podcast generation is less important than source custody and claim checking.
- The next value jump is not "chat with docs"; it is "turn docs into tested
  Chaotang skills."

## Capability Clone Matrix

| NotebookLM-like capability | Chaotang implementation | First choice | Fallback |
| --- | --- | --- | --- |
| Upload PDFs/docs/web pages | Jinyiwei source pack ingestion | local file + URL registry | Google Drive manual export |
| Source-grounded answers | citation chunk retrieval + claim ledger | self-hosted RAG | NotebookLM manual review |
| Study guide | Qintianjian learning pack | deterministic template + LLM | manual Hanlin memo |
| FAQ / briefing | Hanlin synthesis | template generator | Docs export |
| Audio overview | learning script first, TTS later | Podcastfy / local TTS later | text-only script |
| Timeline | claim ledger sorted by source date | self-hosted | manual |
| Mind map / concept map | source claim graph | later UI | markdown outline |
| Export | JSON + Markdown + SKILL.md | repo artifacts | Drive Docs |
| Skill distillation | candidate `SKILL.md` + golden cases | self-hosted harness | human-written skill |
| Regression checks | evaluator | Node harness | manual checklist |

## Architecture

```text
Source Intake
  -> Extractor
  -> Chunk Store
  -> Claim Ledger
  -> Evidence Cards
  -> Learning Pack
  -> Skill Forge
  -> Golden Cases
  -> Evaluator
  -> Swarm Gate
  -> Shiguan Outcome Ledger
```

## Recommended Stack

Phase 1: no new dependency

- JSON source packs.
- Markdown learning packs.
- Node evaluator.
- Candidate `SKILL.md`.
- Golden cases.

Phase 2: light local RAG

- SQLite FTS5 / BM25 for text search.
- optional vector search later.
- PDF/text extraction scripts.
- Playwright for rendered public pages.
- conservative Crawl4AI/Scrapling-style extraction where compliant.

Phase 3: NotebookLM-style learning media

- script generator for two-host "audio overview";
- Podcastfy or equivalent TTS backend only after content safety gate;
- generated audio stays artifact, not source.

Phase 4: UI

- Jinyiwei source notebook;
- red/yellow/green/black evidence cards;
- Qintianjian learning ladder;
- Hanlin Skill Forge;
- Shiguan outcome timeline.

## What To Avoid

- Unofficial NotebookLM clients requiring Google login cookies.
- Any paywall, robots, or ToS bypass.
- Treating generated summaries as sources.
- Storing OAuth tokens without approved connector flow.
- Auto-publishing financial, legal, medical, or public-facing conclusions.

## Genius Product Design

### 1. Research Notebook As Evidence Court

Every source becomes a witness. Every claim becomes testimony. Jinyiwei assigns
credibility and red flags.

### 2. Learning Ladder

Qintianjian turns sources into:

- 5-minute beginner lesson;
- 30-minute practitioner guide;
- expert memo;
- scenario ladder;
- quiz and teach-back task.

### 3. Skill Forge

Hanlin turns the lesson into:

- candidate `SKILL.md`;
- output contract;
- hard gates;
- anti-examples;
- golden cases.

### 4. Swarm Gate

The skill cannot enter Hubu/Gongbu/Jinyiwei production until deterministic
evaluator passes.

### 5. Outcome Ledger

Shiguan rechecks whether the skill improved outputs after 30/60/90 days.

## First Build Decision

We already implemented the Phase 1 self-hosted fallback:

- `harness/deep-research-skill-distillation/source_packs/`
- `harness/deep-research-skill-distillation/learning_packs/`
- `harness/deep-research-skill-distillation/candidate_skills/`
- `harness/deep-research-skill-distillation/golden_cases/`
- `harness/deep-research-skill-distillation/outcome_ledgers/`
- `harness/deep-research-skill-distillation/evaluators/`

Next build:

- add Hubu investment swarm gate;
- add NotebookLM-style generated learning script output;
- add source ingestion UI later.

## Decision

Use NotebookLM when it helps humans think.

Build Chaotang Deep Research when the system must remember, test, audit, and
reuse knowledge.
