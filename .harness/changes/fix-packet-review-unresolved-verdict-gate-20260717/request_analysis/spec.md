# 规格说明：fix-packet-review-unresolved-verdict-gate-20260717

## 背景

P5.1 事故证明：一个包可持旧 GO 进入分支，随后出现 NO_GO，但下游候选只验证当前
approval 几何，不检查链路上其他 change 的最新裁决。已知红缺陷因此经本地 merge
传播。D6 需要在 ext 入口增加终态扫描，同时保留现有 SHA/digest/DAG 校验。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 旧 verifier 接受“当前包 GO + 另一个 change 最新 NO_GO”的候选 | 新 nodetest RED：Missing expected exception | Node fixture | 是 |
| 已确认事实 | 当前远端有历史 NO_GO v2/v4/v6/v9/v10/v11，但同 change 最新 v12 GO | 远端 tree 枚举 | Git object scan | 否；应接受 |
| 已确认事实 | 历史 v12 GO 无同版本 approval，不能追溯强制所有历史 GO 信封 | 真实 P5.2 候选回放 | D6 CLI | 否；范围收窄 |
| 未知问题 | 非标准 prose 中的 NO_GO | 无可靠 change/version 映射 | 明确不检测 | 否；流程要求标准路径 |

## 数据流与调用链

`candidate tree -> enumerate standard review-vN paths -> group by change ID -> numeric max version -> parse one final terminal verdict -> require GO -> existing current-packet approval/DAG checks -> allow`

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| latest review status | versioned report path | D6 verifier | greatest numeric version, one final terminal verdict |
| current packet approval | approval JSON + report digest + B/H DAG | D6 verifier | 现有严格校验保持不变 |

## 范围

- 扫描候选最终树中所有标准 versioned review，按 change ID 取最大数字版本。
- 最新终态不是 GO 则拒绝；GO 则通过终态层，当前包仍走原 approval 校验。
- 文档要求未来 NO_GO/INSUFFICIENT 必须写入标准路径。

## 非目标

- 不把本地 hook 升格为安全边界或外部 required check。
- 不解析任意 blocker/incident prose，不猜测 Packet ID。
- 不追溯要求历史 GO 都有同版本 approval；会锁死已有合法 bootstrap 历史。
- 不修改 P6 或产品运行逻辑。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 另一 change 最新 review=NO_GO | 拒绝当前候选 | RED→GREEN fixture |
| 同 change v9 NO_GO、v10 GO | 以数字版本取 v10，允许 | resolved fixture |
| 最新报告终态缺失/重复/不在末行 | 拒绝 | parser contract |
| 当前真实远端历史最新均 GO | 不误报 | P5.2 candidate replay |

## 风险与回滚边界

风险是回溯历史兼容：D6 bootstrap 自身最新 GO 无 matching approval，因此终态扫描只要求
最新报告为 GO，不替代当前候选的严格审批校验。规则依旧可被 `--no-verify` 或 hook 篡改
绕过；回滚为 revert core/wiki/tests 并重装 hook bundle。

## 计划确认记录

- 批准人：用户（事故处置中明确建议采纳）
- 批准日期：2026-07-17
- 批准范围：ext 入口终检无悬挂 NO_GO。
- 明确未批准：外部 required check、安全边界声明、P6 内容修改。

## 验收标准

1. 旧 verifier 的 bypass fixture RED，新实现拒绝。
2. 新er GO 可解除同 change 旧 NO_GO，版本按数字比较。
3. 当前真实 P5.2 候选回放通过，无历史误报。
4. 全部 gate/installer tests、doctor 与独立 review 通过。

## 验证计划

- Node 定向 RED/GREEN与完整 suite。
- 对真实 `86c83a4..6c71ff3` 候选做 D6 回放。
- root doctor、diff check、Claude 精确 B/H review。
