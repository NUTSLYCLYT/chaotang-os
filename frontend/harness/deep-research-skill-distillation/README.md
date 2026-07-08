# Deep Research Skill Distillation Harness

Purpose: make Chaotang OS capable of turning a new research topic into reusable
agent skills through a source-grounded, testable pipeline.

This harness implements the five "genius designs":

1. One-click `Learn This Into A Skill`.
2. Evidence notebook with red/yellow/green/black claim cards.
3. Hanlin Skill Forge with candidate `SKILL.md`.
4. Qintianjian Scenario Ladder.
5. Shiguan Outcome Ledger.

NotebookLM can be used as an optional human research workbench, but this harness
is the self-hosted fallback and long-term default.

## Directory Layout

```text
harness/deep-research-skill-distillation/
  README.md
  schemas/
    source-pack.schema.json
    learning-pack.schema.json
    skill-distillation.schema.json
    outcome-ledger.schema.json
  source_packs/
    serenity-bottleneck-investing.source-pack.json
  learning_packs/
    serenity-bottleneck-investing.learning-pack.json
  candidate_skills/
    hubu-bottleneck-investing/SKILL.md
  golden_cases/
    serenity-bottleneck-investing.cases.json
  evaluators/
    run-deep-research-harness.mjs
```

## Run

```bash
node harness/deep-research-skill-distillation/evaluators/run-deep-research-harness.mjs
```

## Gate

The harness fails if any candidate lacks:

- source URLs and timestamps;
- claim evidence levels;
- uncertainty labels;
- beginner/practitioner/expert learning levels;
- scenario ladder triggers;
- investment non-advice guardrails;
- downside, invalidation, liquidity, and manipulation-risk checks;
- golden cases;
- candidate skill output contract;
- outcome ledger review plan.

## Safety

Financial research produced by this system is educational and analytical only.
It must never output personal buy/sell/position-size advice.
