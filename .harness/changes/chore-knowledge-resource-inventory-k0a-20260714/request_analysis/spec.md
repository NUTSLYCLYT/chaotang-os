# 规格说明：chore-knowledge-resource-inventory-k0a-20260714

## 背景

知识飞轮蓝图要求下一步只实施 K0A：先把历史 Obsidian、旧 Super Brain/Qdrant、法条、IMA 和当前 RAG 的存在性与元数据完整度固化为可复跑证据，再讨论指标、写面封禁、schema 或迁移。旧资源均默认不可信，inventory 不产生 ACTIVE 知识。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 旧 Qdrant 有 2 collections / 13,970 points；payload 只有 source/title/content/metadata/tags/chunk_index，未观察到 owner/version/license key | artifact；真实只读 copied-snapshot inspection | Project Agent | 是，全部 quarantine |
| 已确认事实 | 当前 sqlite-vec RAG DB 不存在 | artifact `current_rag_db=ABSENT` | Project Agent | 不阻塞 K0A，阻塞索引 READY |
| 已确认事实 | live Vault 在独立墙钟 hash 验证中被外部 writer 修改；inventory strace 对源写操作为 0 | hash tripwire + strace，2026-07-14 | Project Agent | 不阻塞捕获的 snapshot；阻塞 K0C 单写者证明 |
| 推测 | live Vault 的外部变化来自既有 watcher | watcher 进程存在，但本轮未做写事件归因 | K0C | 是，不能自行定责 |
| 未知问题 | 13,970 point 对应哪些 owner/license/tenant | K0A 只统计 key presence，不读取/输出 payload value | K4 owner 裁决 | 是，禁止晋升 |

## 数据流与调用链

`只读 source -> 每文件/DB/Qdrant copied snapshot 边界 -> 聚合计数与 key presence -> canonical JSON -> snapshot_set_hash + manifest_hash -> 脱敏 artifact`。文件名只参与内存 hash；SQLite 使用 `mode=ro&immutable=1`；嵌入式 Qdrant 先复制稳定文件快照到临时目录，再由旧环境解释副本，绝不打开源 store。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `knowledge-resource-inventory.v1` | `backend/scripts/knowledge_resource_inventory.py` | K0B/K0C/K4 与人工审计 | schema/version/hash 由聚焦测试和复跑对账验证 |
| source snapshot | 文件 stat/read/stat、SQLite RO、Qdrant copied snapshot | manifest builder | 扫描边界变化返回 `UNSTABLE_SOURCE`，缺少可选 RAG 返回 `ABSENT` |
| disposition | inventory policy | 后续 migration | K0A 固定历史来源 0 accepted；未知 owner/version/license 全 quarantine |

## 范围

只读 inventory、脱敏 artifact、测试、真实只读验证和蓝图状态更新。

## 非目标

不摄取正文；不创建知识业务表；不切索引；不改 API/UI；不停止 watcher/8099；不封禁 legacy 写面；不进入 K0B/K0C/K1；不判定历史内容可用。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 文件扫描期间改变 | `UNSTABLE_SOURCE`、无 snapshot token、不能冻结 | mutation RED test |
| symlink | 不跟随，计入 rejected | symlink RED test |
| SQLite 不存在且明确 optional | `ABSENT` 可冻结；其他读取失败仍 `UNAVAILABLE` | optional DB RED test |
| Qdrant 活跃/锁定 | 复制稳定源文件到临时目录，解释副本 | 真实 13,970 point inventory |
| 路径、正文、payload value | 不进入 artifact | 递归字符串脱敏扫描 |
| 外部 writer 并发修改 Vault | 捕获当次稳定 snapshot，但不能据此声明单写者 | hash tripwire 失败证据；留 K0C |

## 风险与回滚边界

最大风险是 inventory 自己触碰旧嵌入式 Qdrant 或把客户路径/正文写进报告。实现只打开临时副本，SQLite 使用 immutable RO，文件只读；strace 证明源路径 1,167 次文件操作中写操作为 0。回滚只删除仓内代码/测试/artifact，不需要恢复外部资产。

## 计划确认记录

- 批准人：用户（“下一步”）
- 批准日期：2026-07-14
- 批准范围：蓝图第一最小闭环 K0A
- 明确未批准：K0B 指标冻结、K0C legacy 写面封禁、K1 schema/迁移、正文摄取、旧服务停机

## 验收标准

7 个来源均有可核状态与 snapshot token；连续两次同源 manifest/snapshot set hash 一致；0 accepted；真实源写 syscall=0；脱敏、compile、测试和 doctors 通过。外部 writer 竞态必须如实保留为 K0C 证据。

## 验证计划

先 RED→GREEN；再真实运行两次；做独立内容 hash 与 strace 归因；扫描 artifact；运行 py_compile/pytest、可用的 type/lint、后端 doctor、根 doctor和 diff check。
