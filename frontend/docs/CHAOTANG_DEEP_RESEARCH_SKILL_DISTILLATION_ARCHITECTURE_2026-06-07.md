# Chaotang Deep Research And Skill Distillation Architecture

Date: 2026-06-07

Goal: build a source-grounded learning and skill-distillation loop for Chaotang
OS. NotebookLM is an optional external workbench. The self-hosted path is the
default system capability.

This system is for research, learning, and agent-skill generation. Financial
outputs must not become personalized investment advice.

## North Star

```text
Jinyiwei collects sources
  -> Qintianjian turns them into scenario-aware learning
  -> Hanlin distills doctrine and skill files
  -> Hubu/Gongbu swarms run gated workflows
  -> Shiguan tracks outcomes and regressions
```

The product promise:

- A user sees a new idea, person, method, company, or event.
- Chaotang builds a trusted source pack.
- The system teaches it at multiple depths.
- It distills the method into reusable skills.
- Swarms can execute the new skill only after eval gates pass.

## Design Principle

Do not optimize for "which research tool is most impressive."

Optimize for:

- source custody;
- timestamped claims;
- uncertainty labels;
- learning clarity;
- skill reuse;
- eval gates;
- audit trail.

## Advisor Roundtable

- Zhang Xiaolong: hide complexity; user should ask one question and receive a
  clear learning path.
- Andrew Ng: convert tacit expert process into data, examples, and evals.
- Karpathy: keep the pipeline simple and inspectable before adding orchestration.
- Deming: improve through PDSA; every skill needs before/after quality evidence.
- Bruce Schneier: source packs can be poisoned; every connector is a trust
  boundary.
- Charity Majors: every research run needs wide events so failures are
  debuggable.
- Howard Marks: investment learning must start with downside, uncertainty, and
  what is already priced in.

## Two-Track Strategy

### Track A: NotebookLM-Assisted Workbench

Use when:

- Google Workspace / NotebookLM access is available;
- the user wants a familiar human research workspace;
- source material is already in Drive, PDF, Docs, websites, or YouTube;
- human review is acceptable before skill generation.

Flow:

```text
Jinyiwei source pack
  -> Google Drive folder
  -> NotebookLM notebook
  -> briefing / study guide / FAQ / timeline
  -> export back to Chaotang
  -> Hanlin distills skill
```

Constraints:

- Use official Google/Workspace surfaces only.
- Do not use unofficial reverse-engineered clients that require Google cookies.
- NotebookLM output is a draft, not evidence. Evidence remains the original
  source pack.
- If NotebookLM has no official automation API, keep this track semi-manual.

### Track B: Self-Hosted Chaotang Deep Research

Use by default.

Flow:

```text
query
  -> source discovery
  -> source fetching / upload
  -> extraction
  -> citation chunking
  -> claim ledger
  -> contradiction and uncertainty pass
  -> learning content generator
  -> skill distiller
  -> golden-case generator
  -> eval harness
  -> swarm release gate
```

This is the strategic path because it can be audited, tested, deployed, and
customized for Chaotang departments.

## Department Responsibilities

### Jinyiwei: Source Intelligence

Inputs:

- user query;
- target domain;
- allowed source types;
- risk level;
- connector permissions.

Outputs:

- `source_pack.json`;
- raw source artifacts;
- extracted text;
- source reliability grades;
- open questions;
- poisoning/manipulation warnings.

Required fields:

- `source_id`
- `url_or_file`
- `title`
- `publisher`
- `published_at`
- `accessed_at`
- `source_type`
- `license_or_terms_note`
- `reliability`
- `department_impact`
- `claims_extracted`
- `red_flags`

### Qintianjian: Learning And Scenario Formation

Inputs:

- source pack;
- extracted claims;
- target audience level;
- scenario horizon.

Outputs:

- `5-minute beginner explanation`;
- `30-minute practitioner guide`;
- `expert research memo`;
- scenario table;
- trigger list;
- "what would change our mind" section.

The learning content must separate:

- facts from sources;
- interpretation;
- forecast;
- uncertainty;
- missing evidence.

### Hanlin: Skill Distillation

Inputs:

- Qintianjian learning pack;
- source pack;
- desired swarm role;
- failure cases.

Outputs:

- `SKILL.md`;
- prompt contract;
- data contract;
- output schema;
- golden cases;
- evaluator rules;
- README for humans.

Skill anatomy:

```text
name
description
when_to_use
inputs
source_requirements
workflow_steps
hard_gates
output_contract
examples
anti_examples
evals
archive_rules
```

### Hubu: Investment Research Application

Hubu only receives a skill after:

- source and timestamp gates pass;
- non-advice disclaimer is present;
- downside and invalidation are present;
- liquidity and manipulation risk are present;
- golden cases pass.

Hubu output status options:

- `observe`
- `needs_evidence`
- `defer`
- `reject`

No buy/sell/position-size instructions.

### Shiguan: Archive And Feedback

Stores:

- source pack;
- learning pack;
- generated skill;
- eval result;
- swarm run;
- human signoff;
- outcome review.

Outcome review is required for finance, safety, legal, medical, and public
content.

## Self-Hosted Components

### 1. Source Discovery

Preferred sources by risk:

- official/company/regulatory documents;
- paid/licensed databases when available;
- reputable news;
- academic papers;
- social posts only as weak signals;
- reposts only as secondary context.

Connectors:

- Web search for public sources.
- Google Drive / Docs for user-uploaded corpora.
- Future licensed financial/news connectors when credentials exist.
- Manual upload for PDFs.

### 2. Fetch And Extraction

Tools:

- Playwright for browser-rendered pages.
- conservative Scrapling/Crawl4AI-style fetchers for public pages.
- PDF/text extraction.
- YouTube/transcript ingestion only where terms allow.

Guardrails:

- obey robots/terms;
- no paywall bypass;
- no login scraping unless user explicitly provides authorized connector;
- store fetched time and source URL.

### 3. Claim Ledger

Every research run creates a ledger:

```json
{
  "claim_id": "c001",
  "claim": "Serenity's claimed 2026 YTD return is 4502.45%",
  "source_ids": ["s001"],
  "claim_type": "performance_claim",
  "evidence_level": "media_social_unverified",
  "confidence": "low",
  "timestamp": "2026-06-07",
  "contradictions": ["c002"],
  "requires_manual_review": true
}
```

### 4. Learning Generator

Produces:

- beginner lesson;
- practitioner guide;
- expert memo;
- glossary;
- examples and anti-examples;
- quiz;
- "teach-back" exercise.

### 5. Skill Distiller

Generates a candidate `SKILL.md` and tests.

The distiller cannot publish directly. It creates a pull request / work order.

### 6. Eval Harness

Required tests:

- source citation present;
- timestamp present;
- uncertainty labels present;
- no unsupported claims;
- no personalized investment advice;
- anti-example rejected;
- output schema valid;
- skill improves on baseline examples.

## NotebookLM Alternative Matrix

| Option | Role | Pros | Cons | Decision |
| --- | --- | --- | --- | --- |
| NotebookLM | Human research workbench | Strong source-grounded summaries, study guides, familiar UI | limited official automation; Google workspace dependency | Use as optional assisted track |
| Google Drive + Gemini | Enterprise docs research | official ecosystem, docs/sheets integration | still needs permissions and connector design | Good medium-term connector |
| Self-hosted RAG + claim ledger | Core Chaotang capability | auditable, testable, customizable | more engineering | Default path |
| Perplexity / commercial deep research | External research assistant | fast web research | source/cost/vendor lock-in risk | Optional, source-gated |
| Crawl4AI / Scrapling + LLM | Public-source research | controllable, open-source | extraction fragility and compliance burden | Use conservatively |
| Manual upload + Hanlin distiller | Lowest risk MVP | simple, auditable | more human labor | First fallback |

## Genius Designs

### Design 1: One-Click "Learn This Into A Skill"

User action:

```text
Paste article/person/method/topic -> Learn into Skill
```

System output:

- source pack;
- beginner lesson;
- expert memo;
- candidate skill;
- five golden cases;
- release gate result.

Why it is genius:

The user does not manage tools. Chaotang manages the learning supply chain.

### Design 2: Evidence Notebook With Red/Green Claim Cards

Each claim becomes a card:

- green: primary verified;
- yellow: issuer/media;
- red: social/unverified/conflicting;
- black: prohibited claim.

Why it is genius:

It teaches users epistemic hygiene. They learn not just the content, but how to
judge evidence.

### Design 3: Skill Forge

Hanlin displays generated `SKILL.md` beside:

- examples;
- anti-examples;
- failed tests;
- source citations;
- owner;
- release status.

Why it is genius:

It turns knowledge into reusable operational software, not another memo.

### Design 4: Qintianjian Scenario Ladder

Every learning pack includes:

- base case;
- bull case;
- bear case;
- what would change our mind;
- signal watchlist;
- next review date.

Why it is genius:

It prevents the system from treating today’s explanation as permanent truth.

### Design 5: Shiguan Outcome Ledger

Every distilled skill gets a 30/60/90-day review:

- did it improve swarm output?
- which claims aged badly?
- which source type failed?
- should the skill be amended, deprecated, or promoted?

Why it is genius:

The organization learns from outcomes, not vibes.

## MVP Build Plan

### Phase 0: Spec And Gates

Deliverables:

- this architecture document;
- source pack schema;
- learning pack schema;
- skill distillation schema;
- golden-case format.

### Phase 1: Manual Upload MVP

Flow:

```text
docs/source_packs/<topic>.md
  -> script generates claim ledger
  -> script generates learning pack markdown
  -> script creates candidate skill skeleton
```

No external NotebookLM dependency.

### Phase 2: Public Web Research

Add:

- conservative URL fetcher;
- extraction;
- citation chunks;
- source reliability grader.

### Phase 3: NotebookLM Assisted Connector

Add only if official or user-approved workflow exists:

- Drive source-pack exporter;
- NotebookLM manual checklist;
- import of exported NotebookLM study guide;
- diff against original source pack.

### Phase 4: Swarm Integration

Add:

- Hubu investment skill gate;
- Jinyiwei source collector role;
- Qintianjian learning role;
- Hanlin skill distiller role;
- Shiguan outcome tracker.

## Security And Compliance

- Do not store Google cookies.
- Do not bypass paywalls, robots, or platform terms.
- Store secrets only in env/approved connectors.
- Financial content must be clearly non-advice.
- Generated content must label uncertainty.
- Source packs are audit artifacts.
- Users must approve publication-facing outputs.

## Immediate Next Step

Create a small self-hosted harness around the Serenity research file:

1. source pack schema;
2. five golden cases;
3. evaluator checks for sources, uncertainty, non-advice, downside, and
   skill-output structure;
4. candidate `hubu-bottleneck-investing` skill skeleton.

Only after this passes should the Hubu investment swarm prompt be changed.
