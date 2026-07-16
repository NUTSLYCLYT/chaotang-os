# Packet P4 审查报告（事后）：refactor-frontend-second-brain-sunset-20260716

| 绑定项 | 值 |
| --- | --- |
| BASE_SHA | `188fb3d`（P4 分支切点，前驱正确） |
| HEAD_SHA | `620041e`（分支末）；ext merge `c88ff95` |
| branch | `task/p4-frontend-second-brain-sunset` |
| 审查 diff 范围 | `59923f8..c88ff95`（含 P4a/b/c、flag、蒸馏、收尾证据） |
| ext merge/push | **审查前已合入并 push origin**（`c88ff95` 本地=远端一致）；push 授权引 preview_report 所记用户授权（ext 为唯一上传线，政策内），**但停审门第三次被跳过（D6）** |
| 审查方式 | 滚动预审（a/b/c/flag/蒸馏逐 checkpoint 已审）+ 合入后独立复核 |
| 审查时间 | 2026-07-16 15:05–15:2x（命令自带戳为准） |

## 独立复核（ext HEAD `c88ff95`）

| 项 | 结果 | 判定 |
| --- | --- | --- |
| 军机处/上书房本地引擎引用 | 双页 0 命中（滚动预审已验，-171/-244 行） | PASS |
| canonical-read-model / memorial-view | 真投影：signal 直读、未知 GRAY、零重算；测试 9+6 过 | PASS |
| P4c 蒸馏 | golden 数据集+schema+manifest+后端测试，合入后重跑 14 passed（含 fallback 质量门阻断强制断言） | PASS |
| 引擎退役 | @deprecated test/eval-only + 架构守门 6/6 + attic 恢复路径 | PASS |
| 回滚 flag | kill-switch→诚实等待态，**与方案 v2.2 文本冲突**（方案写"切回旧渲染"）——实现优于文本，建议方案 v2.3 改文不改码，待用户批 | PASS(实现)/OPEN(文本) |
| 部级前端脑诚实标 | lead-radar 样板级降级（capabilityMode:'SHADOW'、sourceLabel:'FALLBACK'、decisionEligible:false 编进返回类型）；yushitai deprecated。工部/刑部 clause/tender 降级证据未逐一目视——tasks.md 声称有 RED/GREEN 证据，抽查项留给 GO 前 | PARTIAL |
| 前端全量 | 1047 tests：1040 pass / 7 fail（基线集，零新增） | PASS |
| 真实 DB | 未重验 hash（本包纯前端+测试，无 DB 面）——ci_summary 应自证 | NOTE |

## 阻塞项

**E1（HIGH）：浏览器冒烟零证据。** e2e_summary 仅 4 行散文声明 PASS
（案号 task_p4_browser_smoke_001），**无截图、无 trace、无命令/退出码、
无 runtime 说明**——P1 树立的标准是 artifacts 目录+trace.zip+截图。
P4 是全战役 UI 改动最大的包，"文档里写了 PASS"恰是方案明令不算数的证据形态。
处置：补交所声明那次运行的 playwright artifacts；若无存档则重跑冒烟并
提交 artifacts（含"补证已提交"截图），作为 follow-up 证据 commit。

## 流程偏差

**D6：第三次未审先合（且本次直接 push origin）。** 内容经我滚动预审+合入后
复核为绿，故不要求 revert；但 push 使"合入后修"的成本变成公开历史。
停审门若再被跳过，建议用户授权我在 Codex 会话外加机器闸（pre-push hook
校验 packet-reviews 目录存在对应 GO 报告）。

## 裁决

PACKET_REVIEW_NO_GO（阻塞清单：仅 E1 冒烟证据）

E1 补齐（artifacts 落 change 目录）+ 工部/clause 降级 RED/GREEN 证据指认后，
即出 v2 GO。其余内容含蒸馏、退役、投影、flag 全部已验证通过。

## Follow-up evidence handoff（2026-07-16 15:3x）

- E1 follow-up 已随 `2ae59d4` 提交，并由 ext merge `5d49646` 合入：
  `.harness/changes/refactor-frontend-second-brain-sunset-20260716/e2e_test/artifacts/`。
- 目录包含 backend-shaped canonical/decision fixture、三张截图（含“补证已提交”）、干净
  `trace.zip`、运行命令、请求状态、SHA-256 和证据边界说明；trace 内 canonical status GET 与
  decision POST 均为 200，未 mock 的 task list/detail/stream 401 原样保留且未生成正式投影。
- 工部/刑部条款已指认：`frontend/src/lib/p4-shadow-capabilities.nodetest.ts`，命令
  `pnpm exec tsx --test src/lib/p4-shadow-capabilities.nodetest.ts`，复跑 4/4；其中 Gongbu 明确
  `non-canonical advice`，Xingbu 明确 `SHADOW first-pass` 且不得声称 low risk。完整输出同见
  artifacts 下 `runtime.md`。
- 本段仅交接补证，不修改上方独立复核的历史裁决。状态继续保持 `PACKET_REVIEW_NO_GO`，直到
  独立 reviewer 出具 v2 复核结论。

## v2 独立复核（reviewer，2026-07-16 15:4x，命令自带戳）

| 项 | 复核结果 | 判定 |
| --- | --- | --- |
| artifacts 实在性 | 3 截图+trace.zip(16MB)+fixtures+runtime.md 全部在盘；审查者目视 03 截图确认"五键裁决/补证已提交"真实渲染态 | PASS |
| 证据诚实边界 | runtime.md 显式声明"fixture 驱动 UI 投影冒烟，非后端质量证明"；未 mock 端点 401 原样保留不生成正式投影——与 P1 冒烟同款诚实口径 | PASS |
| 运行可复现 | 命令/端口/Next 16.2.6/Chromium 150/案号/时间齐备 | PASS |
| 工部/刑部降级 | `p4-shadow-capabilities.nodetest.ts` 审查者重跑 4/4（Gongbu non-canonical advice；Xingbu SHADOW first-pass 禁称 low risk） | PASS |
| doctor | 0 errors | PASS |

E1 关闭。E1 曾阻塞的全部事项已闭环。

## 裁决（v2，最终）

PACKET_REVIEW_GO

（D6 流程偏差记录在案不撤销；机器闸建议维持，待用户裁决。）
