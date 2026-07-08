# 远端 15 天代码融合计划（2026-06-18）

## 0. 主仓锚点

当前只承认两个主仓，所有 Codex / Claude Code / 后续 agent 都必须遵守：

- 前端主仓：`/home/ubuntu/workspace/frontend/chaotang-web-lyt`
  - remote：`git@gitee.com:msxn/chaotang-web-lyt.git`
  - 当前工作线：`feat/libu-chro-cao-contract`
- 后端 jiqun 主仓：`/home/ubuntu/fe/fengQun/jiqun_ai_fresh`
  - remote：`git@gitee.com:msxn/jiqun_ai.git`
  - 当前工作线：`feat/courtos-loop-harness`

禁止漂移到其它老目录、桌面残留仓、临时 clone。需要参考其它目录时，只能当作资料源，不能当作主仓。

## 1. 今日状态

前端已完成并验证：

- 上书房 MVP 闭环已连通：拟旨 → 确认 → 会审 → 回奏 → 圣裁 → 史馆预归档。
- 新增持久化闭环测试：`src/core/courtos/persistence/courtos-mvp-loop-e2e.nodetest.ts`。
- `npm run test:courtos:mvp-api`：7 passed。
- `npm run test:core`：184 passed。
- `npm run build`：216 routes built successfully。
- 最新提交：`320a9c8 feat(courtos): surface mvp decision loop`。

后端已完成并验证：

- 本地 LiteLLM health 指向本机 gateway，避免误打旧服务。
- `data/fengqun.db` 已标记 `skip-worktree`，避免运行数据污染提交。
- 最新本地提交：`6f011e1 chore(dev): point local litellm health to gateway`。

## 2. 远端差异判断

前端 `origin/master` 当前在 `f280bbe Add CourtOS swarm runtime protocol`。

`HEAD...origin/master` 显示远端主线有 5 个当前工作线没有的提交：

- `097b116 Implement CourtOS core goals through archive`
- `5ea1137 Add registry-driven shallow department reviews`
- `3fb0e17 Add registry-driven deep department offices`
- `fd06f4f Add adaptive review complexity routing`
- `f280bbe Add CourtOS swarm runtime protocol`

但直接把 `origin/master` 合进当前工作线是高风险操作。当前 `git diff --stat HEAD..origin/master` 显示：

- 338 files changed
- 3484 insertions
- 19905 deletions
- 会删除大量本地已经验证过的部门 office、prompts、schemas、evals、docs、上书房 API 和持久化闭环代码。

结论：远端 `origin/master` 是较薄的主线快照；当前工作线是更厚的整合线。融合方式必须是逐提交吸收，而不是直接 merge / reset / replace。

后端 `origin/master` 当前新增关键提交：

- `b973bdb fix: persist chaotang task results`

后端当前工作线仍有未提交/未归类内容：

- `harness/chaotang-true-loop/golden_cases/true_loop_cases.json`
- `_patch_golden.py`

结论：后端也不能直接拉平。必须先把 golden case 变更拆清楚，再吸收 `b973bdb` 的任务持久化修复。

## 3. 安全融合顺序

1. 固定当前已验证前端工作线，不再在脏状态下拉远端。
2. 从当前前端工作线创建专用融合分支或 worktree，例如 `integration/courtos-remote-15d-20260618`。
3. 对远端 5 个前端提交逐个执行 `git show --stat`、`git show --name-status`、必要时 `git range-diff`。
4. 只吸收“新增协议/运行时能力”，拒绝会删除本地厚资产的整包合并。
5. 对可吸收提交优先用 `git cherry-pick -n` 预演；冲突多或删除面大时改为手工搬运核心代码。
6. 每吸收一组就跑前端门禁：`npm run test:courtos:mvp-api`、`npm run test:core`、部门 eval、`npm run build`。
7. 保留一条真实 API 链路验收：draft-edict → confirm-edict → run review → memorial → decision → archive。
8. 后端先处理 golden case 脏改：确认 `_patch_golden.py` 是临时脚本还是要提交的迁移脚本。
9. 后端再单独评估并吸收 `b973bdb fix: persist chaotang task results`，跑 health 和 harness smoke。
10. 最后更新 `docs/DEV_ENV_AUDIT_2026-06-17.md` / 本文档，并在提交信息里写清“吸收了哪个远端提交的哪个能力”。

## 4. 硬规则

- 不直接 `git merge origin/master` 到当前前端工作线。
- 不 `git reset --hard`、不清理未归属文件，除非用户明确要求。
- 不删除本地已验证的 prompts / schemas / evals / office loops / 上书房 API。
- 不碰生产端口 3050；本地热重载只用 3002。
- 所有“王公公”命名都视为旧称，统一改为“钦天监”。
- 圣旨展示保持简洁：圣裁、要证、风险、后令、来源、人工确认；详细材料去军机处或各部门展开。

## 5. 大神判断

真正难点不是代码量，而是版本线身份不同：远端主线像“协议薄核”，本地工作线像“产品厚壳”。正确做法是把远端薄核里更好的运行时协议、复杂度路由、swarm runtime 逐块吸进本地厚壳，而不是让薄核覆盖厚壳。

下一步建议先从 `f280bbe Add CourtOS swarm runtime protocol` 开始拆，因为它最可能补强运行时协议；然后看 `fd06f4f` 的复杂度路由是否能和本地 adaptive eval 合并；最后处理三个 core goals / registry commits，避免重复造部门 registry。
