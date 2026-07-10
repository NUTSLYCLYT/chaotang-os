# Frontend API Access Convergence Audit

| Field | Value |
| --- | --- |
| Generated at | 2026-07-10T01:40:16.547Z |
| Status | needs_migration |
| Files scanned | 1006 |
| API call sites | 63 |
| Allowed transport/client calls | 25 |
| Review required call sites | 30 |
| Inaccessible paths | 8 |

## Calls By Layer

| Layer | Calls |
| --- | --- |
| api-client | 18 |
| app | 5 |
| feature-component | 17 |
| hook | 4 |
| lib | 17 |
| other | 1 |
| shared-component | 1 |

## Review Required

| File | Line | Layer | Callee | Path | Reason |
| --- | --- | --- | --- | --- | --- |
| frontend/src/app/(dashboard)/layout.tsx | 35 | app | backendFetch | /api/auth/logout | API call is outside the transport/client allowlist. |
| frontend/src/app/invite/InviteLanding.tsx | 32 | app | backendFetch | /api/auth/verify-invite | API call is outside the transport/client allowlist. |
| frontend/src/app/invite/page.tsx | 41 | app | backendFetch | /api/auth/verify-invite | API call is outside the transport/client allowlist. |
| frontend/src/app/login/page.tsx | 38 | app | backendFetch | /api/auth/login | API call is outside the transport/client allowlist. |
| frontend/src/app/register/page.tsx | 61 | app | backendFetch | /api/auth/register | API call is outside the transport/client allowlist. |
| frontend/src/components/PromptSuggester.tsx | 26 | shared-component | backendFetch | /api/prompt/suggest | API call is outside the transport/client allowlist. |
| frontend/src/features/bureaus/hooks/useBureauPageView.ts | 22 | hook | backendFetch | /api/chaotang/dept/${encodeURIComponent(overviewCode)}/overview | API call is outside the transport/client allowlist. |
| frontend/src/features/court-console/components/system-vitals.tsx | 51 | feature-component | backendFetch | /api/health | API call is outside the transport/client allowlist. |
| frontend/src/features/departments/components/HubuBudgetCaseBody.tsx | 93 | feature-component | backendFetch | /api/court/shangshufang/briefs/${encodeURIComponent(data.decisionBrief.id)}/decision/advance | API call is outside the transport/client allowlist. |
| frontend/src/features/departments/components/HubuBudgetCaseBody.tsx | 223 | feature-component | backendFetch | /api/court/shangshufang/research-budget-loop | API call is outside the transport/client allowlist. |
| frontend/src/features/departments/hooks/useDepartmentPageView.ts | 22 | hook | backendFetch | /api/chaotang/dept/${encodeURIComponent(overviewCode)}/overview | API call is outside the transport/client allowlist. |
| frontend/src/features/governance/components/bills-board.tsx | 103 | feature-component | backendFetch | /api/governance/bills | API call is outside the transport/client allowlist. |
| frontend/src/features/governance/components/bills-board.tsx | 116 | feature-component | backendFetch | /api/governance/whoami | API call is outside the transport/client allowlist. |
| frontend/src/features/governance/components/bills-board.tsx | 127 | feature-component | backendFetch | /api/governance/whoami | API call is outside the transport/client allowlist. |
| frontend/src/features/governance/components/bills-board.tsx | 142 | feature-component | backendFetch | /api/governance/audit/summary | API call is outside the transport/client allowlist. |
| frontend/src/features/governance/components/bills-board.tsx | 170 | feature-component | backendFetch | /api/governance/bills | API call is outside the transport/client allowlist. |
| frontend/src/features/governance/components/bills-board.tsx | 195 | feature-component | backendFetch | /api/governance/bills/${billId}/transition | API call is outside the transport/client allowlist. |
| frontend/src/features/governance/components/bills-board.tsx | 226 | feature-component | backendFetch | /api/governance/bills/${billId}/audit | API call is outside the transport/client allowlist. |
| frontend/src/features/governance/components/deliberation-console.tsx | 94 | feature-component | backendFetch | /api/governance/deliberate | API call is outside the transport/client allowlist. |
| frontend/src/features/governance/lib/three-chamber-engine.ts | 368 | lib | fetch | ${baseUrl}/api/shangshufang/draft-edict | API call is outside the transport/client allowlist. |
| frontend/src/features/governance/lib/three-chamber-engine.ts | 389 | lib | fetch | ${baseUrl}/api/shangshufang/confirm-edict | API call is outside the transport/client allowlist. |
| frontend/src/features/hanlin/components/hanlin-bottom-dock.tsx | 69 | feature-component | backendFetch | /api/orchestration/run | API call is outside the transport/client allowlist. |
| frontend/src/features/health/components/medical-info-query.tsx | 49 | feature-component | backendFetch | /api/chat | API call is outside the transport/client allowlist. |
| frontend/src/features/intel/components/route-to-task-dialog.tsx | 92 | feature-component | fetchLocalCourtApi | /api/court/intel/signals/${encodeURIComponent(signal.id)}/dispatch | API call is outside the transport/client allowlist. |
| frontend/src/features/scribe/components/annals-reader.tsx | 85 | feature-component | backendFetch | /api/scribe/annals | API call is outside the transport/client allowlist. |
| frontend/src/features/shangshufang/ShangshufangPage.tsx | 4879 | other | fetchLocalCourtApi | /api/court/shangshufang/edict-return | API call is outside the transport/client allowlist. |
| frontend/src/features/shiguan/lib/use-orchestration-chat.ts | 42 | lib | backendFetch | /api/orchestration/run | API call is outside the transport/client allowlist. |
| frontend/src/features/shiguan/lib/use-shiguan.ts | 82 | lib | backendFetch | /api/court/shiguan/analyze | API call is outside the transport/client allowlist. |
| frontend/src/features/xingbu/components/xingbu-legal-swarm-panel.tsx | 76 | feature-component | backendFetch | /api/legal/verdict/from-text | API call is outside the transport/client allowlist. |
| frontend/src/features/zhuangyuan/components/BottomBar.tsx | 50 | feature-component | fetch | /api/orchestration/run | API call is outside the transport/client allowlist. |

## Inaccessible Paths

| Path | Error |
| --- | --- |
| frontend/src/features/bingbu/components | EPERM |
| frontend/src/features/bingbu/hooks | EPERM |
| frontend/src/features/gongbu/components | EPERM |
| frontend/src/features/gongbu/hooks | EPERM |
| frontend/src/features/hubu/components | EPERM |
| frontend/src/features/hubu/hooks | EPERM |
| frontend/src/features/libu/components | EPERM |
| frontend/src/features/lifu/components | EPERM |

## Policy

- UI files must not gain new direct API calls during this implementation line.
- Existing direct calls listed here need migration to business clients/adapters after the UI workspace issue is resolved.
- This audit does not authorize editing UI layer files and does not add a frontend BFF.
