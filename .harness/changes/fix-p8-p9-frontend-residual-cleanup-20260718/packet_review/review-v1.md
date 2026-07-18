# Packet P14 独立复审报告 v1

- Change ID: `fix-p8-p9-frontend-residual-cleanup-20260718`
- Packet ID: P14
- 复审人: Claude Code（独立只读优先复审，独立 detached worktree）
- 复审日期: 2026-07-18
- Verdict: **PACKET_REVIEW_GO**

## 固定 SHA

| 角色 | SHA |
| --- | --- |
| B（predecessor，P13 已发布远端） | `6ee6d8d542127174f4d899f940d4937b6fa2b70f` |
| H（本包实现候选） | `5f3491b3a55c50dc71e43f00dc1dcee85430ac81` |

结构核对：

- `git rev-parse H^` = `6ee6d8d542127174f4d899f940d4937b6fa2b70f` = B。PASS。
- H 单亲（`%P` 仅含 B），非 merge commit。PASS。
- 复审全部基于 `git diff B..H` 固定 SHA，未使用浮动 HEAD。
- 复审在独立 detached worktree `/home/ubuntu/Projects/chaotang-os/.worktrees/review-p14`（checkout H）执行；未切换、未清理、未暂存、未修改主工作树或其他 worktree。

## Diff 范围核对

`git diff --name-status B..H`（恰好 6 路径，与包声明一致）：

```
A  .harness/changes/fix-p8-p9-frontend-residual-cleanup-20260718/ci_result/ci_summary.md
A  .harness/changes/fix-p8-p9-frontend-residual-cleanup-20260718/request_analysis/spec.md
A  .harness/changes/fix-p8-p9-frontend-residual-cleanup-20260718/request_analysis/tasks.md
A  .harness/changes/fix-p8-p9-frontend-residual-cleanup-20260718/summary.md
D  frontend/src/features/hanlin/lib/hanlin-home-mock.ts
A  frontend/src/features/shangshufang/finance-intel-loop-path.nodetest.ts
```

- 无 lockfile、页面实现、API 实现变化。PASS。
- 无旧 P8/P9 change 目录恢复，无其他本地提交夹带。PASS。
- `git diff --check B..H` 无输出（无空白/冲突标记问题）。PASS。

## 实跑命令与结果（独立 worktree @ H）

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `git diff --check B..H` | 0 | 无输出 |
| `rg -n "hanlin-home-mock" frontend/src` | 1 | 零命中 |
| `rg -n "hanlin-home-mock" .`（全仓，排除 node_modules） | 0 | 仅 docs/harness 历史记录命中，无任何源码/配置引用 |
| `pnpm install --frozen-lockfile` | 0 | Done in 1.1s，lockfile 未变 |
| `pnpm exec tsx --test src/features/hanlin/lib/api.nodetest.ts src/features/hanlin/lib/read-model.nodetest.ts src/features/shangshufang/finance-intel-loop-path.nodetest.ts` | 0 | `# tests 8 / # pass 8 / # fail 0` |
| `pnpm exec tsc --noEmit` | 0 | 无输出 |
| `NEXT_PUBLIC_API_MODE=real pnpm build` | 0 | `✓ Compiled successfully in 4.9s`，Next.js production build 完成 |
| `pnpm harness:doctor`（frontend） | 0 | `harness-doctor: 0 errors, 0 warning(s)` |
| `node scripts/harness-doctor.mjs`（root） | 0 | `project-harness-doctor: 0 errors, 0 warning(s)` |

## 重点审查结论

### 1. `hanlin-home-mock.ts` 删除是否安全

- B 时点该文件 355 行（与 tasks.md 声明一致）。
- B 时点 `git grep "hanlin-home-mock" B -- frontend/src`（排除文件自身）零命中，即删除前就已零引用。
- H 时点全仓 `rg "hanlin-home-mock"` 仅命中 docs 归档与 harness change 记录（历史文档，非代码引用）。
- `frontend/src/features/hanlin/` 内无字符串模板动态 import（仅测试文件对 `./api.ts` 的显式 dynamic import）。
- 别名引用（`@/features/hanlin/...`）已被全文关键词扫描覆盖：路径别名仍包含 `hanlin-home-mock` 字面量，零命中即无别名引用。
- 删除后 `tsc --noEmit` 与 REAL 模式 production build 均通过。结论：确实零引用、不可达，删除安全。

### 2. 新测试有效性（是否可被字符匹配绕过）

- `finance-intel-loop-path.nodetest.ts` 读取真实生产文件 `ShangshufangPage.tsx`（`readFileSync` 相对 URL，指向生产源码，非副本）。
- 正向断言匹配 `backendFetch('/api/shangshufang/finance-intel-loop/complete'` —— 这是实际调用语法而非裸字符串；且经核实 `ShangshufangPage.tsx:3256` 是 frontend/src 中唯一 `/complete` 调用点，位于 `runFinanceIntelLoopFromDecree` useCallback 内的 try 块，可达生产代码，非注释、非死码、非伪调用。
- 反向断言拒绝带引号的旧路径 `'/api/court/shangshufang/finance-intel-loop/complete'`，能阻止旧路径以调用字面量形式回流。
- 局限（LOW，不阻断）：字符级测试理论上可被"注释里写 canonical 调用+真实调用换路径"绕过，但当前正向断言绑定唯一调用语法，且该文件唯一 `/complete` 出现处即真实调用；契约类型 `backend-openapi-2026-07-09.d.ts:1427` 亦声明 canonical POST 路径。综合判定测试有效。

### 3. change 文档诚实性

- spec/tasks/summary/ci_summary 的范围、数字（355 行、8 tests、6 路径）、状态声明与实际候选 diff 与实跑结果一致。
- ci_summary 声明的所有命令均由本复审独立重跑并得到一致结果（含首次无 API mode build fail-closed 的设计行为说明——本复审直接以 REAL 模式验证通过）。
- 状态 `IMPLEMENTED_CANDIDATE / EXTERNAL_REVIEW_PENDING` 如实；明确声明"本包不宣称 P8/P9 总体验收完成"，P12 `VERIFIED_PARTIAL` 边界保持，无越权宣称。PASS。

### 4. 范围污染 / 悬挂项

- 无旧 packet 目录、无悬挂 NO_GO、无未终态证据混入 diff。PASS。

## Findings

| # | 级别 | 内容 | 处置 |
| --- | --- | --- | --- |
| F1 | LOW（范围外观察） | `frontend/src/features/departments/components/HubuBudgetCaseBody.tsx:69` 等处仍使用旧前缀 `/api/court/shangshufang/...`（`/cases/`、`/briefs/`、`/research-budget-loop` 端点，非本包守护的 `/complete`）。这些调用在 B 时点已存在，非本 packet 引入或修改。 | 不阻断本包。建议后续独立 packet 评估旧前缀端点收敛，勿在本包顺手修复。 |

无 HIGH，无 MEDIUM。

## 复审纪律声明

- 未修改 H 中任何实现、测试、summary、spec、tasks、ci 文件。
- 除本 review-only commit R 外未创建任何提交。
- 未执行 merge、push、rebase，未删除文件，未清理其他 worktree。
- R 为 H 的单亲子提交，仅新增 `packet_review/review-v1.md` 与 `packet_review/approval-v1.json` 两个文件。

## Verdict

PACKET_REVIEW_GO
