# 事故立案：P5.1 NO_GO 缺陷被合入 P6 分支（Claude reviewer，2026-07-17 07:4x）

## 严重度：HIGH（流程 + 已知红缺陷传播）

## 事实（审查者实测）

1. P5.1（`task/p5-1-alembic-review-hardening` @ 64a2369）持有 Claude
   `PACKET_REVIEW_NO_GO`（见 p5-1-check-normalization-blocker.md）——
   `_normalize_check_sql` 与 `_normalize_default` 字面量大小写误判等价，
   HIGH，实证可复现，**未修**。
2. `bbb1000 merge: integrate P5.1 schema review hardening` 把 64a2369
   合入 `task/p6-orphan-retirement`；`git branch --contains 64a2369` 确认。
3. P6 分支上 schema_adoption.py:174 仍为裸 `.lower()`——**已知红缺陷随合入
   传播**，且 P6 已在此基础开工。
4. 这比历次"未审先合"严重：那些内容事后验证为绿，本次是**已被 Claude
   判 NO_GO 的 HIGH 缺陷被绕过**。

## 遏制现状（后续核对更正）

- 立案当时的本地 `git branch --contains 64a2369` 不含本地
  `feature-chaotang-ext`，只能证明当时本地引用关系，不能证明远端未污染。
- 2026-07-17 后续以 `git ls-remote origin refs/heads/feature-chaotang-ext`
  复核，远端精确为 `bbb100004845331b314e5196e645125f25199a5f`；因此“未污染上传线”
  结论作废，已知红缺陷已经进入远端 ext。
- D6 机器闸允许了带旧 GO 信封的 `bbb1000`，但没有识别随后形成的悬挂 NO_GO；
  **闸的时间顺序与覆盖面缺口均已暴露**。

## 处置要求（Codex 执行）

1. **不得**继续将 P6 内容合入 ext，直到 P5.1 缺陷修复且 Claude 复审 GO；
2. 优先在 P5.1 分支修 CHECK/default 规范化（保护字面量+大小写负例），
   复审 GO 后，P6 分支 rebase 到修复后的 P5.1；
   或 P6 分支内直接带上修复+回归，作为整体重新受审；
3. 远端已经是 bbb1000，不改写共享历史；以 bbb1000 为前序生成独立、可复审、
   可 fast-forward 的 P5.1 修复包，修复入 ext 后再迁移 P6 工作。

## 流程改进（提请用户裁决）

D6 机器闸只验证候选几何与绑定的 GO，不检查候选链路是否存在晚于该 GO 的悬挂
NO_GO。采纳流程加固：另立 gate 变更，在 ext 入口终检“每个被合 Packet 的最新
有效裁决为 GO，且不存在更新的 NO_GO”；本地 merge 无法拦截，由 ext 入口兜底。

## 裁决

P5.1 修复头 `8ae79eb027c6e87c12c34f5d2b20a0c390175ff3` 已获 Claude
review-v2 `PACKET_REVIEW_GO`；原 NO_GO 对该精确修复头解除。远端 ext 修复包和
P6 内容仍需分别走精确 SHA 复审，未完成前不得继续发布 P6。
