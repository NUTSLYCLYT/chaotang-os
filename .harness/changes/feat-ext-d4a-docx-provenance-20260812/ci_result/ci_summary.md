# CI 摘要：feat-ext-d4a-docx-provenance-20260812

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| focused secure-ingest pytest (3 files) | 0 | 25 PASS | canonical DOCX extraction + existing attack/format matrix | 2026-08-12 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 0 | GO | execution authority | 2026-08-12 |
| `node scripts/professional-agent-matrix.mjs --check` | 0 | PASS | professional asset matrix unchanged | 2026-08-12 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | root + delegated harness | 2026-08-12 |
| `git diff --check` | 0 | PASS | whitespace integrity | 2026-08-12 |
| full backend pytest | 1 | 3492 PASS / 3 FAIL / 30 SKIP | full regression | 2026-08-12, disposable exact-H clone |
| focused rerun of 3 failures | 1 | 2 PASS / 1 FAIL | failure triage | 2026-08-12 |
| same focused tests on base `df6c82cf` | 1 | same 2 PASS / 1 FAIL | baseline comparison | 2026-08-12 |

## 结果

Focused and harness gates pass on the live candidate worktree. Independent review: HIGH 0 / MEDIUM 0 / LOW 1 / GO. Full-suite failures are baseline-identical or order-sensitive and outside the seven-file change: the two knowledge-router cases pass in isolation on candidate and base; the route-enumeration case fails identically on both.

## 未验证项

- Repository baseline still has one independently reproducible route-enumeration failure unrelated to this candidate.

## Diff 与回滚复核

- changed files：canonical extractor, upload integration, focused tests, change record.
- diff review：donor governance/migration/idempotency/ticket changes excluded.
- 回滚是否演练：surgical revert boundary documented; not executed.

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| complete DOCX scan surface | 3 focused extraction tests | PASS |
| no secure-ingest regression | 21 existing attack/format tests | PASS |
| governance remains healthy | authority/matrix/doctor | PASS |

## 声明状态

- `VERIFIED_PARTIAL`
