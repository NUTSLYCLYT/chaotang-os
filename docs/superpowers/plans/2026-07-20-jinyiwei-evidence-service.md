# Central Jinyiwei Evidence Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a central, auditable evidence service that lets bureau-level agents request missing public facts, searches Shiguan before approved public sources, and resumes the requesting bureau at most once with a frozen evidence pack.

**Architecture:** Add a standalone `jinyiwei` backend domain with strict contracts, separate SQLite persistence, synchronous pluggable sources, a bounded evidence extractor, deterministic verification, and a pinned-IP HTTPS boundary. Integrate only bureau-opinion nodes through a shared two-pass adapter, propagate bureau-selected evidence references to REPLY archives with recoverable cross-database adoption, and expose read-only backend and Next.js views.

**Tech Stack:** Python 3.12, FastAPI, stdlib SQLite/network primitives unless an approved existing dependency is safer, LangGraph/OpenAI structured outputs, Next.js 16, React 19, Node test runner, pytest.

## Global Constraints

- Codex-only: never invoke Claude CLI, Claude runners, or `gstack-claude`.
- Preserve all existing dirty work and current Shiguan two-type behavior.
- Use test-driven development: observe each focused test fail before implementation.
- No commit, push, deployment, paid service, authenticated source, or real decree run is authorized.
- Treat all external content as untrusted data. Network access stays feature-flagged off by default.
- The architecture checkpoint may refine exact filenames, but not product scope or safety invariants.
- The default no-login web discovery provider is Wikimedia-only and must be labeled `WIKIMEDIA_ONLY`; it must never be described as general web search.
- The decree-wide cap is three investigations/resumes, 30 seconds of external work, and six extractor calls; only bureau nodes may investigate, and an individual bureau resumes at most once.

---

## Task 1: Freeze contracts and domain errors

**Files:**
- Create: `backend/app/jinyiwei/__init__.py`
- Create: `backend/app/jinyiwei/models.py`
- Create: `backend/app/jinyiwei/errors.py`
- Test: `backend/tests/test_jinyiwei_models.py`

- [ ] Write failing tests for 1–5 fact slots, stable enums, required provenance, timeout bounds, immutable packs, and invalid payloads.
- [ ] Implement `DataGapRequest`, `RequiredFact`, `EvidenceItem`, `EvidencePack`, `SourceAttempt`, and typed domain errors using the repository's established model style.
- [ ] Add stable request fingerprinting that excludes generated IDs but includes agent, fact slots, freshness, and source scope.
- [ ] Run `pytest backend/tests/test_jinyiwei_models.py -q` and record the result.

## Task 2: Add isolated investigation persistence and cache

**Files:**
- Create: `backend/app/jinyiwei/db.py`
- Create: `backend/app/jinyiwei/storage.py`
- Test: `backend/tests/test_jinyiwei_storage.py`
- Modify: `backend/.gitignore` or root `.gitignore` only if required for the runtime database.

- [ ] Write failing migration/storage tests for investigations, fact slots, evidence, source attempts, cache hits, adopted evidence links, ordering, and idempotency.
- [ ] Implement a versioned schema in an independent configurable SQLite database; default runtime data must not enter Git.
- [ ] Store only minimal excerpts and hashes, never complete fetched pages.
- [ ] Run the focused storage tests twice to prove idempotent initialization.

## Task 3: Define source ports and implement Shiguan-first recall

**Files:**
- Create: `backend/app/jinyiwei/sources/__init__.py`
- Create: `backend/app/jinyiwei/sources/base.py`
- Create: `backend/app/jinyiwei/sources/shiguan.py`
- Test: `backend/tests/test_jinyiwei_shiguan_source.py`

- [ ] Write failing tests mapping Shiguan recall results to evidence without treating historical conclusions as current live facts.
- [ ] Define synchronous source/search/fetch/extractor ports with explicit budgets and structured failures.
- [ ] Reuse the existing Shiguan recall API behind an adapter; do not couple the coordinator to Shiguan tables.
- [ ] Verify a complete and fresh Shiguan result can satisfy a slot without a network source call.

## Task 4: Build the public-source safety boundary

**Files:**
- Create: `backend/app/jinyiwei/network.py`
- Create: `backend/app/jinyiwei/sources/public_api.py`
- Create: `backend/app/jinyiwei/sources/public_web.py`
- Create: `backend/app/jinyiwei/source_registry.py`
- Test: `backend/tests/test_jinyiwei_network.py`
- Test: `backend/tests/test_jinyiwei_public_sources.py`

- [ ] Prototype the official MediaWiki Search API as the no-login `WIKIMEDIA_ONLY` provider. If the live prototype or terms check fails, keep the port and return explicit `UNAVAILABLE`; do not silently substitute scraping of a search UI.
- [ ] Write failing tests for HTTPS-only policy, literal and DNS-resolved private addresses, metadata IPs, mixed DNS answers, redirects, size/MIME/time limits, stripped sensitive headers, and feature-flag-off behavior.
- [ ] Implement `PinnedHttpsTransport`: normalize host/IDNA, reject any non-global resolution, connect to a selected validated IP with TLS hostname/certificate verification and the original Host header, verify the peer address, disable proxies/cookies/auth, and repeat the full process after every redirect.
- [ ] Implement allowlisted public API connectors with connector-owned validation and normalization.
- [ ] Implement Wikimedia result discovery and minimal readable-text extraction without executing scripts or following page instructions; add a bounded `EvidenceExtractor` port whose excerpt must be verified as a source-text substring.
- [ ] Run all focused safety tests offline before any live request.

## Task 5: Coordinate, verify, cache, and freeze investigations

**Files:**
- Create: `backend/app/jinyiwei/verification.py`
- Create: `backend/app/jinyiwei/coordinator.py`
- Test: `backend/tests/test_jinyiwei_verification.py`
- Test: `backend/tests/test_jinyiwei_coordinator.py`

- [ ] Write failing tests for source order, unresolved-slot-only expansion, cache reuse, global/source budgets, official-source resolution, two-authoritative-source resolution, conflicts, partial results, and total failure.
- [ ] Implement deterministic source quality, independence, confidence, conflict, coverage, and `do_not_infer` rules.
- [ ] Implement `Shiguan → public API → public web` orchestration; stop before network when all facts are already satisfied.
- [ ] Persist each attempt and freeze the final pack so downstream agents share the same evidence snapshot.

## Task 6: Integrate the one-resume data-gap protocol

**Files:**
- Create: `backend/app/agents/evidence_protocol.py`
- Modify: `backend/app/agents/bureaus/agent.py`
- Modify: `backend/app/agents/ministries/agent.py`
- Modify: `backend/app/agents/junjichu/agent.py` or its actual implementation path selected at architecture checkpoint.
- Modify: `backend/app/agents/chancellor/graph.py`
- Test: focused existing Agent tests plus `backend/tests/test_agent_evidence_protocol.py`

- [ ] Preserve all legacy result shapes while extending only bureau opinion output with `READY | NEEDS_DATA`, server-validated `DataGapDraft`, and `adopted_evidence_ids`; the server alone adds request ID, timeout and source scope.
- [ ] Write failing tests proving no investigation for `READY`, one investigation plus one resume for `NEEDS_DATA`, frozen pack injection, explicit limited result after a second gap, and no graph loop.
- [ ] Centralize retry/budget behavior in one adapter and apply it only to bureau opinion nodes. Ministry synthesis, council verdict, Chancellor finalizer and all routing nodes keep their existing contracts and never call Jinyiwei.
- [ ] Keep model-call growth bounded: READY adds no model calls; an individual bureau resumes once; a decree gets at most three investigations/resumes, 30 external seconds and six extractor calls.

## Task 7: Attach adopted evidence to REPLY without a new archive type

**Files:**
- Modify: `backend/app/shiguan/models.py`
- Modify: `backend/app/shiguan/storage.py`
- Modify: `backend/app/shiguan/archive_decree.py`
- Modify: `backend/app/agents/chancellor/graph.py`
- Test: `backend/tests/test_shiguan_adopted_evidence.py`

- [ ] Write failing compatibility tests for optional evidence references on REPLY, legacy rows, stable source/time fields, and investigation adoption links.
- [ ] Add Shiguan schema v3 `archive_evidence_references` with immutable citation snapshots. After the Shiguan transaction returns the REPLY ID, upsert Jinyiwei adoption status idempotently as PENDING/CONFIRMED so cross-database failure is recoverable.
- [ ] Persist only evidence IDs explicitly selected by resumed bureau responses; validate they are injected-pack subsets, propagate their union through the graph without giving upper-level agents investigation capability, and leave all other evidence in the Jinyiwei database.
- [ ] Prove archive types remain exactly MEMORIAL and REPLY.

## Task 8: Expose read-only Jinyiwei APIs

**Files:**
- Create: `backend/app/api/jinyiwei.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_jinyiwei_api.py`

- [ ] Write failing tests for summary, paginated investigation list, detail, evidence provenance, adoption links, validation, and not-found behavior.
- [ ] Implement only safe GET endpoints; expose no arbitrary URL, mutation, deletion, network trigger, secret, or backend address.
- [ ] Mount the router and preserve existing app startup behavior.

## Task 9: Build the read-only investigation desk

**Files:**
- Create: `frontend/src/app/jinyiwei/page.tsx`
- Create: `frontend/src/app/jinyiwei/jinyiwei.css` or colocated styles following repository conventions.
- Create: `frontend/src/app/api/jinyiwei/summary/route.ts`
- Create: `frontend/src/app/api/jinyiwei/investigations/route.ts`
- Create: `frontend/src/app/api/jinyiwei/investigations/[id]/route.ts`
- Modify: `frontend/src/lib/backendClient.ts`
- Test: colocated Node tests for client/BFF/pure view models.

- [ ] Write failing tests for backend URL handling, pagination, status/quality labels, conflict and unresolved states, empty/error views, and absence of mutation controls.
- [ ] Implement the BFF routes without leaking backend configuration to the browser.
- [ ] Implement summary cards, investigation list, selected detail, evidence provenance, conflicts, unresolved facts, and linked replies.
- [ ] Follow the existing product visual language while making evidence confidence and failure states immediately legible.

## Task 10: Record architecture and operating rules

**Files:**
- Create: `docs/decisions/0018-central-jinyiwei-evidence-service.md`
- Modify: `ARCHITECTURE.md`
- Modify: `backend/AGENTS.md`
- Modify: `frontend/AGENTS.md`
- Modify: `scripts/check_harness.mjs` only if stable contract checks are warranted.
- Modify: `docs/product/tasks/2026-07-20-jinyiwei-evidence-service.md`

- [ ] Record the domain boundary, separate database, safe network adapter, evidence-resolution rules, one-resume protocol, and REPLY adoption design in an ADR.
- [ ] Document local feature flags, database path, offline tests, and safe live-smoke command.
- [ ] Update the product task implementation report with exact files and reproducible evidence.

## Task 11: Independent verification and product acceptance

**Files:**
- Modify: `docs/product/tasks/2026-07-20-jinyiwei-evidence-service.md`

- [ ] Run all new focused backend and frontend tests.
- [ ] Run backend lint, typecheck if configured, full tests, and startup/import checks from `backend/AGENTS.md`.
- [ ] Run frontend lint, typecheck, full tests, build, and runtime checks from `frontend/AGENTS.md`.
- [ ] Run `node scripts/check_harness.mjs` and its self-test plus any required hook checks.
- [ ] With the feature flag enabled only for this check, run one harmless no-login public-source smoke; record URL category, outcome, timing, and redacted logs. Never run a real decree.
- [ ] Use browser QA on `/jinyiwei` for loading, empty/populated/error/detail states and console errors.
- [ ] Independently map every acceptance criterion to fresh evidence; mark the task `Accepted` only if all required criteria pass, otherwise `Blocked` with exact gaps.
- [ ] Do not commit or push; those actions require a separate explicit user request.
