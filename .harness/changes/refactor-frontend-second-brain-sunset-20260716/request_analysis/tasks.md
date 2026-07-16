# 任务：refactor-frontend-second-brain-sunset-20260716

## 任务 1 — P4a 军机处纯投影

- 目标：用 swarm-runs + CourtReview/FinalMemorial 读模型替换军机处四引擎本地重算。
- 前置条件：P3 GO/merge 已核验；P4 spec approved；先取得 RED。
- 输入：`ShangshufangTaskStatusResponse`、既有 execution/swarm-run 事实。
- 输出：中立 canonical court projector；军机处等待/正式/阻断展示。
- 涉及文件：projector + tests、`junjichu/page.tsx`、architecture/import guards。
- 状态 / 数据变化：只读；无 schema、writer、API 路径或平台路由变化。
- 验证命令与证据：projector/empty/source/production import RED→GREEN，Junjichu 相邻、tsc。
- 回滚边界：P4a 原子提交；rollout flag off 仅降级为安全等待视图。
- 完成定义：军机处生产 import/call 清零；无后端事实时不合成结论。
- 状态：VERIFIED；RED/GREEN、相邻、tsc、doctor 与 diff-check 已通过，待 P4a 原子提交。

## 任务 2 — P4b 上书房纯投影

- 目标：删除上书房四引擎调用，正确选择 formal/candidate/direct canonical memorial。
- 前置条件：P4a GREEN 并提交；P4b 单独 RED。
- 输入：同一 status read model。
- 输出：正式奏折优先、候选诚实标记、瞬时空读有限重试、无 trace 诚实空态。
- 涉及文件：Shangshufang projector/page、polling tests、import guard、旧反向断言。
- 状态 / 数据变化：只读；无后端状态变化。
- 验证命令与证据：formal precedence/candidate/direct/retry/empty/trace RED→GREEN。
- 回滚边界：P4b 原子提交；flag off 安全等待，不恢复本地圣裁。
- 完成定义：上书房生产 import/call 清零，正式内容仅来自正式快照。
- 状态：VERIFIED；RED/GREEN、相邻 30、MVP 4、tsc 与 diff-check 已通过。

## 任务 3 — P4c 蒸馏与退役

- 目标：先保存四引擎规则知识，再清零其生产可达性；侧脑诚实降级。
- 前置条件：P4b GREEN 并提交；完成生产调用图和规则清单。
- 输入：四引擎关键词/分诊/风险规则与现有 frontend eval cases。
- 输出：backend golden dataset/test；deprecated/test-only 引擎边界；`EXPERIMENTAL/SHADOW` 标签。
- 涉及文件：backend golden cases/tests、engine deprecation/import guards、侧脑展示标签。
- 状态 / 数据变化：golden 测试资产；不新增生产状态机或 writer。
- 验证命令与证据：golden 先 RED/xfail 后可执行；生产 import graph 0；frontend/backend 相邻。
- 回滚边界：P4c 原子提交；test-only 壳保留一个周期，不物理丢规则。
- 完成定义：蒸馏证据早于退役；四引擎只在 test/eval 可达；侧脑不进入正式结论区。
- 状态：VERIFIED；蒸馏、backend quality gate、生产 import 清零、attic 恢复说明与四类
  SHADOW/FALLBACK 诚实标签均有 RED/GREEN 证据。

## 任务 4 — P4 收官与停审

- 目标：证明 Packet 对生产、浏览器、护栏和真实数据库安全。
- 前置条件：P4a/b/c 全部完成。
- 输出：coding/test/code review、E2E/CI 证据与 review-ready marker。
- 验证命令与证据：前后端全量、tsc、三层 doctor、browser journey、DB fingerprint、diff check。
- 回滚边界：三步原子 commit 可独立回滚；不得 push/deploy。
- 完成定义：证据落盘，输出 `PACKET_P4_READY_FOR_CLAUDE_REVIEW`，立即停工待 Claude 审查。
- 状态：IN_PROGRESS；进入全量、三层 doctor、browser journey、DB 指纹和最终差异审计。
