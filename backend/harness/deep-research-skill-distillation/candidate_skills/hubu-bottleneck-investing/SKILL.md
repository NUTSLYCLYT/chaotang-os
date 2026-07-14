---
name: hubu-bottleneck-investing
description: >
  Hubu investment-research skill for source-grounded bottleneck analysis inspired
  by the Serenity case. Use for educational, watchlist-grade research only. Never
  provide personalized buy/sell/position-size advice.
---

# Hubu Bottleneck Investing Skill

Use this skill when the user asks Hubu to learn from a public investor, market
theme, supply-chain opportunity, or small-cap thesis.

## Non-Advice Boundary

This skill produces research workflow output, not personal investment advice.
It must not tell a user to buy, sell, hold, short, size, lever, or time a trade.

Allowed decisions:

- `observe`
- `needs_evidence`
- `defer`
- `reject`

## Inputs

- topic or ticker;
- user question;
- source pack;
- target market;
- time horizon;
- allowed source types;
- risk level.

## Source Requirements

Every market claim requires:

- source URL or file ID;
- source publisher;
- source type;
- accessed timestamp;
- reliability grade;
- uncertainty label.

Evidence hierarchy:

1. regulatory / primary filing;
2. issuer release, labeled issuer-biased;
3. reputable news or research;
4. social posts as weak signals only;
5. reposts as context only.

## Workflow

1. Identify the downstream theme.
2. Map upstream supply chain.
3. Find the chokepoint claim.
4. Collect primary and secondary evidence.
5. Score technical barrier, supplier concentration, substitutability, and
   demand inflection.
6. Check financials, market cap, float, average volume, dilution, and cash
   runway.
7. Red-team the thesis before writing the bull case.
8. Mark social-media performance claims as unaudited unless brokerage/tax/full
   trade records are provided.
9. Produce a watchlist-grade output with status, evidence, downside,
   invalidation, and review date.
10. Send the case to Shiguan for outcome review.

## Hard Gates

- No source, no claim.
- No timestamp, no market claim.
- No personalized investment advice.
- No "stock god", "guaranteed", "must rise", or certainty framing.
- No accepting social-media performance as audited performance.
- Illiquid microcaps require manipulation-risk warning.
- No buy/sell/position-size instruction.
- Every output includes downside and invalidation.
- Design wins are not revenue unless conversion evidence exists.
- Every high-risk output requires human review.

## Output Contract

```text
status:
not_personalized_investment_advice:
source_ledger:
chokepoint_claim:
evidence_grade:
downstream_theme:
upstream_map:
financial_and_liquidity_check:
manipulation_risk:
bull_case:
bear_case:
invalidation_points:
missing_evidence:
manual_review_required:
shiguan_review_date:
```

## Good Example

Status: `needs_evidence`.

The thesis identifies an upstream laser supplier for AI optical interconnect,
but the only evidence is an issuer release and social discussion. The output
labels the issuer evidence as biased, asks for revenue conversion and customer
timing, flags liquidity risk, and sets a review date.

## Bad Example

"Serenity made 4502%, buy this ticker before it runs."

This fails because the performance claim is unaudited, the output is a buy
instruction, and there is no downside, source ledger, liquidity check, or
manual review.

## Evals

The skill must pass:

- verified chokepoint good case;
- viral microcap bad case;
- design win not revenue case;
- theme correct company wrong case;
- after-move chase case.

## Archive Rules

Shiguan must store:

- source pack;
- generated output;
- reviewer;
- status;
- invalidation points;
- 30/60/90-day outcome review.
