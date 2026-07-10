# CI Summary: selective origin/dev integration

## Commands

- `git fetch origin dev`
- `git merge-tree --write-tree HEAD origin/dev`
- `git cherry-pick -n 3044ad6 c7999aa`
- `git cherry-pick -n 020ad06`
- `git cherry-pick -n 5d990b0`
- `git cherry-pick -n 8688fd7`
- `git cherry-pick -n 7820dc0`
- `git cherry-pick -n 2b71613`
- `node scripts/api-contract-boundary-audit.mjs`
- `node scripts/api-contract-inventory.mjs`
- `node scripts/api-contract-client-layer-audit.mjs`
- `node scripts/api-contract-response-envelope-audit.mjs`
- `node scripts/api-contract-source-label-audit.mjs`
- `node scripts/api-contract-p0-matrix-audit.mjs`
- `node scripts/api-contract-all-matrix-audit.mjs`
- `node scripts/api-contract-exact-test-audit.mjs`
- `node scripts/api-contract-alias-retirement-audit.mjs`
- `node scripts/api-contract-stability.mjs`
- `node scripts/api-contract-implementation-audit.mjs`
- `cd frontend; npx --yes tsx --test src/lib/backend-api.nodetest.ts`
- `$env:FENGQUN_JWT_SECRET='test-secret-for-selective-dev-integration-20260710'; cd backend; python -m pytest -q tests/test_all_frontend_used_routes_exact_contract.py tests/test_court_session_api_contract.py tests/test_contract_alignment_p0.py tests/test_swarm_runs_api_contract.py tests/test_auth_invite.py tests/test_archive_chronicle.py tests/test_scribe_lessons.py tests/test_ima_knowledge.py tests/test_jinyiwei_agent.py`
- `cd frontend; npx --yes tsc --noEmit --pretty false`
- `node scripts/harness-doctor.mjs`

## Results

- Full `origin/dev` merge was not performed.
- Integrated safe backend/non-UI subsets only.
- Deferred frontend BFF and UI-heavy changes.
- Boundary audit: pass_with_warnings; 0 frontend BFF violations; 0 UI layer violations; 2 known workspace UI issues.
- Inventory: 91 frontend calls; 303 backend routes; 75 MATCHED; 16 PATH_ALIAS; 0 MISSING_BACKEND; 0 SHAPE_DRIFT.
- Client layer audit: pass; 4 / 4 complete client groups; 0 reviewRequired.
- All matrix audit: pass; 74 / 74 complete routes; 0 missingEvidence.
- Exact route test audit: pass; 74 / 74 exact routes; 0 missingExactRoutes.
- Stability audit: pass; 299 method/path routes; diff_checked; no breaking changes; route_added warnings for selected backend routes.
- Implementation audit: in_progress; 11 done / 3 blocked / 0 missing.
- Frontend transport alias test: 4 passed.
- Backend targeted tests: 62 passed, 1 warning.
- Frontend typecheck: failed only on the two known missing UI modules, unchanged by selective integration.
- Root harness doctor: 0 errors, 0 warnings.
