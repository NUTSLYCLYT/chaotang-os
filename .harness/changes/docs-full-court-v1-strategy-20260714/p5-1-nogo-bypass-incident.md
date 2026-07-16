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

## 遏制现状（好消息）

- `git branch --contains 64a2369` **不含** feature-chaotang-ext/master/dev
  ——未污染上传线；
- `git ls-remote origin` task/p5*/p6* = 0——未 push。
- **D6 机器闸本应拦住这次 push**（若走 push）；本次是本地分支间 merge，
  D6 闸不覆盖本地 merge——**闸的覆盖面缺口暴露**。

## 处置要求（Codex 执行）

1. **不得**将 P6 分支合入 ext，直到 P5.1 缺陷修复且 Claude 复审 GO；
2. 优先在 P5.1 分支修 CHECK/default 规范化（保护字面量+大小写负例），
   复审 GO 后，P6 分支 rebase 到修复后的 P5.1；
   或 P6 分支内直接带上修复+回归，作为整体重新受审；
3. bbb1000 这个 merge 保留或重做由 Codex 定，但**修复未 GO 前 P6 不得触碰
   ext**。

## 流程改进（提请用户裁决）

D6 机器闸只管 push 到 ext，不管**本地分支间 merge**——已知 NO_GO 缺陷可经
本地 merge 传播到未来会合 ext 的分支。建议：D6 闸增加"合入 ext 前校验
被合链路上每个 Packet 都有对应 GO 报告、无悬挂 NO_GO"的检查；本地 merge
无法机器拦，靠此 ext 入口终检兜底。

## 裁决

维持 P5.1 PACKET_REVIEW_NO_GO；P6 继承该阻塞，未解不得合 ext。
