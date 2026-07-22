# 任务：docs-r0-w02-closeout-reconcile-20260722-20260722

## 任务 1：溯源工作区异常改动

- 目标：确认 `execution-authority.v2.json` 未提交改动的确切来源，排除随机损坏/恶意篡改
- 前置条件：会话恢复后发现文件被改成 W02 未激活状态，跟已提交历史/远端 ext 均不一致
- 输入：`git hash-object` 对工作区文件计算 blob，`git log --all` 遍历该路径全部历史版本
- 输出：精确定位到 commit `38fe3068`（分支 `docs/r0-w01-closeout-20260721`）
- 涉及文件：只读排查，无修改
- 状态 / 数据变化：无
- 验证命令与证据：blob 哈希逐一比对，`704840f7...` 精确命中
- 回滚边界：不适用（只读）
- 完成定义：来源 100% 确认，非猜测

## 任务 2：核实该分支主张是否仍反映现实

- 目标：判断是否该按这条未合并分支的主张恢复"W02未激活"，还是现实已经超越它
- 前置条件：任务 1 完成
- 输入：`git merge-base --is-ancestor` 检查 W02 commit 是否是 ext 祖先
- 输出：确认 W02 已 merge 进 `feature-chaotang-ext`（且远端还有 4 个后续相关提交）
- 涉及文件：只读排查
- 状态 / 数据变化：无
- 验证命令与证据：`git merge-base --is-ancestor 3caa0a51 origin/feature-chaotang-ext` → 0
- 回滚边界：不适用
- 完成定义：确认该分支的具体主张已被现实推翻，但其治理原则仍值得采纳

## 任务 3：丢弃异常改动，重建反映真实状态的 ledger

- 目标：让本地 manifest 既不撒谎（不装作W02没合并），也不违反"包完成≠下一包获批"原则
- 前置条件：任务 1、2 完成
- 输入：`git checkout HEAD --` 恢复到已提交基线（W02 ACTIVE），再手动推进到
  W02 MERGED_AND_VERIFIED + activeWorkPackage=null
- 输出：`.harness/manifest/execution-authority.v2.json` 新状态
- 涉及文件：`.harness/manifest/execution-authority.v2.json`
- 状态 / 数据变化：`activeWorkPackage: "R0-W02"→null`；ledger `R0-W02: ACTIVE→MERGED_AND_VERIFIED`
- 验证命令与证据：见 `ci_result/ci_summary.md`
- 回滚边界：`git revert` 即可
- 完成定义：W02/W03 请求均 `NO_ACTIVE_WORK_PACKAGE`

## 任务 4：通用化 doctor/nodetest/wiki（吸收 Codex 分支的治理原则，但不抄硬编码代码）

- 目标：让"静默收口态"成为一等公民状态，且不像 Codex 分支那样把断言写死成 W01/W02 字面量
  （那样下次 W03 收口又要重写一遍）
- 前置条件：任务 3 完成
- 输入：Codex 分支的测试意图（收口后不激活下一包）+ 本会话已有的动态化风格（读
  `activeWorkPackage`+`EXPECTED_R0_WORK_PACKAGE_SEQUENCE`，不硬编码包名）
- 输出：`harness-doctor.mjs` 静默收口分支断言、`execution-authority-v2.nodetest.mjs` 通用化
  real-repo 测试 + 新增 fixture 回归、`execution-authority-v2.md` 新增原则段落
- 涉及文件：`scripts/harness-doctor.mjs`、`scripts/execution-authority-v2.nodetest.mjs`、
  `.harness/wiki/execution-authority-v2.md`
- 状态 / 数据变化：纯逻辑泛化，不改变任何 fail-closed 判定结论
- 验证命令与证据：27/27 nodetest（新增2项）、doctor 输出确认动态消息
- 回滚边界：`git revert`，不影响 resolver 核心逻辑（未改 `execution-authority-v2.mjs` 本体）
- 完成定义：doctor/test 在"有活跃包"和"静默收口"两种状态下都能正确断言，未来 W03 收口不用
  再重写这部分代码
