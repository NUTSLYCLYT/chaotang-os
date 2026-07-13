# S10 evidence

Status: `IMPLEMENTED_LOCAL_OBSERVE_PENDING`. This is not `ROLLOUT`, production `READY`, or `ENFORCED`.

The implementation uses a separate git-common-dir SQLite v1 rollout ledger, pins policy bytes to the starting Git commit, records immutable/hash-linked task, release, acceptance and transition evidence, and fails promotion closed when the external required check or monotonic authorities are absent. The main control-plane database remains schema v8 for S9 rollback compatibility.

Authoritative producers are task finalization audits, terminal `release_runs` plus independently verified `release_evidence`, and fixed A1–A12 verifier plans. Production CLI inputs cannot supply clocks, external booleans, metric values, acceptance pass flags, or fabricated release streaks.

During development, an early design mistakenly migrated the real shared control DB from v8 to v9. All six rollout tables were empty; the DB was restored to v8 after an owner-only snapshot and exact row/hash comparison of every pre-existing core table. The full incident evidence is in `.harness/changes/incident-s10-control-db-v9-pollution-20260713/summary.md`.

See `.harness/changes/feat-multi-agent-rollout-20260713/ci_result/ci_summary.md` for exact verification commands. Real Observe may start only after the implementation and policy are committed, and its start time/status must be recorded in a second commit.
