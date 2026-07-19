# 任务：fix-gongbu-component-scope-p18-20260719

## 任务 1：四路径 RED

- 目标：分别复现 direct、L4 route、fallback、canonical route 旁路。
- 前置条件：B18=`05582e520300e32a5d84e2b38b3822903f75c954`。
- 输入：Claude OUT-1 与独立调用链审计。
- 输出：4 failed。
- 涉及文件：3 个测试文件。
- 状态 / 数据变化：无生产副作用。
- 验证命令与证据：4 个精确 pytest node ID。
- 回滚边界：只新增行为测试。
- 完成定义：四个失败分别对应四条旁路。

## 任务 2：共享 scope 与 fallback hard-stop

- 目标：组件/危险任务必经工部，真实引擎无结论也必须人签。
- 前置条件：任务 1 RED。
- 输入：canonical YAML、真实引擎、L4 编排。
- 输出：共享 scope 函数、强制参审、fallback hard-stop。
- 涉及文件：3 个生产/配置文件。
- 状态 / 数据变化：无数据库或外部调用变化。
- 验证命令与证据：4 GREEN；v2 合并后 7 GREEN、99 focused、2792 全量。
- 回滚边界：不得恢复无结论自动准奏。
- 完成定义：全量 0 failed。

## 任务 3：Claude v1 HIGH 回修

- 目标：消除领域外失实消防指令与 canonical/L4 不对称。
- 前置条件：Claude v1 报告列出 F1=HIGH、F2=MEDIUM；尽管报告末行写 GO，治理上不放行。
- 输入：8 个业务隐喻负例、合同+控制柜爆燃、合同+烧钱失控。
- 输出：scope 共现约束、canonical 物理硬件词、3 条新回归。
- 涉及文件：同一 3 个生产/配置文件与 3 个测试文件。
- 状态 / 数据变化：无数据库或外部调用变化；v1 审查提交不进入候选。
- 验证命令与证据：3 RED；修复后 7 passed、99 focused、2792 全量。
- 回滚边界：不得恢复单字危险字符独立拉起储能引擎。
- 完成定义：领域外负例不生成储能简报，原四路径仍 fail-safe。

## 任务 4：Claude v2 NO_GO 回修

- 目标：消除歧义组件全文共现假阳性，并统一路由/执行事实文本口径。
- 前置条件：Claude v2 F1=HIGH、F2=MEDIUM，裁决 `PACKET_REVIEW_NO_GO`。
- 输入：软件单体短路/模组膨胀负例，known_facts/unknown_gaps 事故旁路。
- 输出：有限连续物理短语 + `_edict_context_text()` 单一事实投影。
- 涉及文件：真实引擎、蜂群编排、2 个测试文件与 Harness 证据。
- 验证命令与证据：3 RED；回修后 9 passed、101 focused、2794 全量。
- 回滚边界：不得恢复全文任意共现或分裂的 route/run 文本拼接。
- 完成定义：v2 两项 blocker 均有行为回归并关闭。

## 任务 5：Claude v3 NO_GO 回修

- 目标：让外部 review_plan 在 route 与实际部门执行使用同一事实文本。
- 前置条件：Claude v3 F1=HIGH，裁决 `PACKET_REVIEW_NO_GO`。
- 输入：危险事实只存在于 params.review_plan 的生产主循环用例。
- 输出：显式 review_plan 参数及主循环串行/并行/重试透传。
- 涉及文件：蜂群编排、蜂群 API 测试与 Harness 证据。
- 验证命令与证据：1 RED；回修后 10 passed、102 focused、2795 全量。
- 回滚边界：不得恢复 route 独享 review_plan 的分裂口径。
- 完成定义：主循环输出复核+人签，不再准奏。

## 任务 6：重新审查发布

- 目标：固定 H18，经 Claude 与 D6 顺序发布。
- 前置条件：任务 2 与三层 doctor 全绿。
- 输入：10 文件候选范围。
- 输出：H18-v4、review-only R18-v4、no-ff M18。
- 涉及文件：本 change 目录 + 6 个实现/测试路径。
- 状态 / 数据变化：GO 后普通 push 更新 ext。
- 验证命令与证据：Claude 报告、approval digest、D6 verifier。
- 回滚边界：任何 HIGH/MEDIUM 阻断或 verdict/findings 自相矛盾均停止发布并继续回修。
- 完成定义：远端精确指向通过 D6 的 M18。
