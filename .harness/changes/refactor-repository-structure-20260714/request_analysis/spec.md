# 规格说明：refactor-repository-structure-20260714

## 背景

仓库名义上只有根、前端、后端三条主线，但根级计划和状态快照、误放在 `frontend/harness/` 的后端评测、以及散落在后端源码旁的运行数据让所有权无法由机器证明。第一性原理结论是：先定义单一所有者和可执行门禁，再迁移内容；不能仅靠改目录名称。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | `frontend/harness/` 只有两套研究/蜂群评测，不验证浏览器 UI | 文件盘点与 evaluator 调用链 | 已验证 / Project Agent | 是 |
| 已确认事实 | `backend/data`、`events`、`sessions`、`swarm_sessions` 等是可变运行态；`memory` 和 `traces` 又混入 tracked seed/fixture | `git ls-files`、路径引用搜索 | 已验证 / Project Agent | 是 |
| 已确认事实 | 外部 CourtOS-Brain 无已验证远端且与仓内 subtree 未证明等价 | `git -C /home/ubuntu/CourtOS-Brain status`、remote/树对账 | 已验证 / Project Agent | 是，阻止直接删除 |
| 推测 | 若仅移动目录而不加门禁，后续会再次产生第四入口和路径漂移 | 既有硬编码与未登记 harness 是直接先例 | 由结构测试持续验证 | 否 |
| 未知问题 | 独立 CourtOS-Brain 最终远端与所有者 | 不适用 | 后续独立变更决定 | 是，仅阻止 subtree 删除 |

## 数据流与调用链

版本化输入（seed/fixture）由 Git 管理；运行时通过 `runtime_paths` 写入 `backend/var/`；评测器由 `backend/harness/manifest.json` 登记；根 doctor 从 `git ls-files -z` 验证结构策略。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| 根目录结构策略 | `scripts/lib/repository-structure.mjs` | 根 doctor、CI | 单测覆盖允许与拒绝路径 |
| 后端运行路径 | `backend/src/runtime_paths.py` | store、event、session、trace 等运行模块 | 环境变量覆盖测试，显式 DB 配置优先 |
| 评测资产清单 | `backend/harness/manifest.json` | backend/root doctor | 所有目录必须登记 |

## 范围

迁移根级计划/状态快照；建立根结构白名单；集中后端可变运行态；分离 memory seeds 与 trace fixtures；迁移两套评测到后端 harness；解除知识清单对仓内 CourtOS-Brain 的默认依赖；更新文档和验证。

## 非目标

不改变产品功能/API；不触碰大殿冻结契约；不丢弃旧运行数据；不在没有独立远端、克隆恢复和树对账证据时删除 `courtos-brain/`。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 旧运行目录仍有数据 | 明确拒绝或提供显式迁移，不静默启动空库 | 迁移脚本测试/文档 |
| 显式 `DB_URL` / `FENGQUN_DB_PATH` | 优先于默认 runtime root | `test_runtime_paths.py` |
| 未配置独立知识归档 | 不扫描仓内 subtree | 知识清单测试 |

## 风险与回滚边界

最大风险是路径迁移后静默创建空数据库，或覆盖并发工作。因此实施在隔离 worktree；旧数据检测失败关闭；版本化 seed 使用 copy-if-absent；回滚以单个结构重构提交为边界，不删除用户数据目录。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-14
- 批准范围：按第一性原理建议完整实施仓库结构收敛。
- 明确未批准：无可恢复证据时的破坏性数据/知识库删除。

## 验收标准

根级退休路径不再被追踪；运行态只有一个解析契约；版本化 seed/fixture 与运行输出分离；两套评测归后端且被 manifest/doctor 识别；现有针对测试与 doctor 通过；并发主工作区改动不被覆盖。

## 验证计划

先跑 RED 测试证明缺口，再逐项 GREEN；运行结构单测、后端针对 pytest、评测器、backend doctor、root doctor；最后审查 `git diff --check` 和退休路径残留。
