# Rule: Product Boundaries

## Project Identity

The product is **朝堂OS**. `chaotang-web-lyt` is the frontend experience line. `jiqun_ai` is the backend swarm execution line. CourtOS is an internal decision protocol/kernel inside the product, not a third product line.

## Ownership

| Line | Owns |
| --- | --- |
| `chaotang-web-lyt` | Next.js UI, browser flows, frontend contracts, release gates, visual evidence |
| `jiqun_ai` | Real swarm execution, agent flow, prompts, providers, backend databases, production execution |

## Capability Labels

Every user-facing claim that depends on runtime truth must be classifiable as:

- `LIVE`: real model / real orchestration / real record.
- `MIXED`: real source exists but fallback or partial path remains.
- `DEMO`: static sample, mock, fixture, or illustrative flow.

Never present DEMO as LIVE. Never use frontend mock scores as proof that backend agents work.

## Main Loop Priority

The north star is one real boss completing one real operating decision through Chaotang OS and saying it helped.

Default product loop:

```text
Shangshufang sees real operating signal
  -> decree to Junjichu
  -> ministries review with real model or explicit fallback
  -> readable memorial
  -> boss accepts / rejects / asks follow-up
  -> Shiguan archives evidence
```

New surfaces must answer:

1. Which existing loop station does this strengthen?
2. Where does the first real datum come from?
3. How is the LIVE / MIXED / DEMO boundary visible?

If those cannot be answered, freeze the surface instead of adding another page.

## Route Semantics

- `/manors` is the manor and swarm execution center.
- `/departments/*` and ministry pages are domain logic pages, not the swarm home.
- `src/core/courtos/**` is the internal CourtOS protocol surface inside Chaotang OS. Frontend-owned `/api/**` BFF routes are retired.

## Ports

| Use | Port | Command |
| --- | ---: | --- |
| Dev HMR | 3002 | `pnpm dev` |
| Production | 3050 | `pnpm start` |
| Forbidden | 3001 | Do not bind |

Do not change these scripts unless the deployment runbook is updated in the same change.
