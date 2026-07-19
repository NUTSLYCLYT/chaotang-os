# 吸收台账 v1 — 骨架外创意大盘（2026-07-18）

来源：四路挖掘汇总（业主提供）+ 本机独立核实。本台账是**登记入库**，不是合入承诺；
任何实际合入必须走 packet 流程（固定 B/H SHA + 独立复审 + GO 单向门）。

## 决策档位定义

| 档 | 含义 | 动作 |
| --- | --- | --- |
| ① PULL-NOW | 主线 A（上书房金融闭环）直接部件 | 立即排 packet |
| ② PULL-NEXT | 有分量但横切面大 | 上线收反馈后第一吸收循环 |
| ③ DOC-ONLY | 创意值钱、代码不急 | 本包文档级吸收完毕 |
| ④ QUEUE | 既有 P 系列半成品 | 按既有 packet 队列消化 |
| ⑤ DEFER/KILL | 与主线正交或已死 | 登记即止，不接线 |
| ⑥ FEDERATE | 独立跑着的产品 | 不合入，联邦接口 |

裁决规则（Bezos 列）：「如果永远不吸收，主线损失什么」填不出来 → 自动降 ⑤。

## 台账

| # | 项 | 来源 | 核实 | 档 | 永不吸收主线损失什么 | 验证/入口 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 户部四契约：投资建议红线「拒绝-重构」+ 会计审计闸（先行两件） | Gitee jiqun-port 分支 | UNVERIFIED-REMOTE | ① | 上线给活人用缺合规红线，信任事故一次清零 | 合入前 checkout 核 SHA |
| 2 | 户部四契约：支付决策 API + 预算闸（后两件） | 同上 | UNVERIFIED-REMOTE | ② | 内测期无支付场景，暂无损失；商用前必补 | 同上 |
| 3 | 事故日回测夹具（-2.85% 纳指日 / 创业板 7% 恐慌日重放） | CourtOS-Brain 日报 | 本机存在 `/home/ubuntu/CourtOS-Brain` | ① | 金融链路无极端行情回归样例，闭环质量不可证 | 抽成 backend 黄金样例 |
| 4 | pack_rd 无 LLM 确定性算料反作弊锚 | Gitee jiqun-port 分支 | UNVERIFIED-REMOTE | ① | 「证据可查」缺确定性锚，LLM 编数不可防 | 审计包定接入点 |
| 5 | 朝会 loop harness（真相库/教训回避/矛盾检测/可信度评分/皇帝单屏朝报） | Gitee jiqun-port 分支 | UNVERIFIED-REMOTE | ② | 长期缺灵魂机制；但上线前合入=改变被验证系统本身 | 上线后第一循环，独立 packet |
| 6 | perf-outcomes 异构 LLM 裁判 | Gitee jiqun-port 分支 | UNVERIFIED-REMOTE | ② | 吸收门禁缺自动评质，人工审批带宽是瓶颈 | 与 #5 同批 |
| 7 | eval-moat 免费搜索+embedding 工具箱 | Gitee jiqun-port 分支 | UNVERIFIED-REMOTE | ② | 视审计结果；ddg/Jina 已通则损失≈0 | 闭环审计包后裁决 |
| 8 | 部门 Agent 架构 PKT-1~5 + 反幻觉条款 | 本仓 candidate/task 分支 | 本机分支存在 | ④ | 部门扩编无架构基线 | 既有 packet 队列 |
| 9 | 翰林院诚实读模型残段 | 本仓 task/p9-hanlin-* | 本机分支存在 | ④ | P9 尾部未收口（P12 VERIFIED_PARTIAL） | P 系列续包 |
| 10 | 资源普查「冻结宇宙」法 | 本仓 task/resource-census-p0 等 | 本机分支存在 | ④ | 资产盘点无一致性快照法 | P 系列续包 |
| 11 | Alembic 单一 schema 权威 | 本仓 task/p5-* | 本机分支存在（P5 系列进行中） | ④ | DB 迁移双权威冲突风险 | P5 队列 |
| 12 | 大神顾问团 council 日运营（9 大神短评卡+分域议会推飞书） | openclaw 侧 | UNVERIFIED-REMOTE | ⑥ | 不合入无损失——它自己在跑；合入反而有停摆风险 | 联邦：朝堂出奏折，council 出短评，互链即可 |
| 13 | closing-100 三十天评测 harness（prompt 注册表+diff-watcher） | openclaw / legal-agent 仓 | 本机 `legal-agent` 最新 commit 含 closing-100 | ⑤ | 填不出主线损失 → 自动降档 | 登记即止 |
| 14 | 190 个 agency 角色 persona 库 | openclaw 侧 | UNVERIFIED-REMOTE | ⑤ | 素材库放着不腐坏，接线零收益 | 需要扩编时按名取用 |
| 15 | 明朔指挥部 workspace-commander（orchestrator/critic/expert + Telegram） | openclaw 侧 | UNVERIFIED-REMOTE | ⑤ | 填不出主线损失 → 自动降档 | 登记即止 |
| 16 | 坟场 8 想法（content-factory/value-miner/tech-radar…） | openclaw 停用区 | UNVERIFIED-REMOTE | ⑤ RECYCLE | 已死项目，概念可回收，代码不复活 | 登记即止 |
| 17 | 钦天监签字台账（不可逆动作登记）+ 舰队静默窗 | 家目录 `CHAOTANG_钦天监_待裁台账.md` | 本机文件存在 | ③ | 不可逆动作无裁决协议，靠人肉记忆 | 本包 `protocol-qintianjian-signoff.md` 已吸收 |
| 18 | legal-agent 红蓝对抗 7 角色收敛模式 | 家目录 `legal-agent` 仓 | 本机 git 仓存在 | ③ | 部门 Agent 架构缺「对抗收敛」模板 | 本包 `template-red-blue-adversarial.md` 已吸收 |
| 19 | 奏折制设计宪法（0.618/0.382 版式、四裁判词、一底盘六部色） | 家目录 `chaotang-landing` 仓 | 本机 git 仓存在 | ③ | 视觉决策无成文依据；注意 ext 视觉资产冻结中，合并须另立决策 | 本包归档指针，不动前端 |
| 20 | battery-rd-os 阶段闸研发管理竖版 | 家目录 `battery-rd-os` 仓 | 本机 git 仓存在 | ③ | 无直接损失；是「朝堂模式可复制」战略证据 | 一行登记，无待办 |
| 21 | evolve 24h 未评分自动 5/10 反死锁 | CourtOS-Brain 日报 | 本机存在 | ⑤ | 内测期无自愈规模需求 | 规模化后重评 |
| 22 | self-diagnose 反熵三改进循环（1 bug+1 cron+1 删除项） | CourtOS-Brain 日报 | 本机存在 | ⑤ | 同上 | 规模化后重评 |

## 档位汇总

- ① PULL-NOW：#1 #3 #4（三件，各开独立 packet，挂 B/H/R 复审门禁）
- ② PULL-NEXT：#2 #5 #6 #7（上线后第一吸收循环）
- ③ DOC-ONLY：#17 #18 #19 #20（本包吸收完毕）
- ④ QUEUE：#8 #9 #10 #11（既有 P 系列队列）
- ⑤ DEFER/KILL：#13 #14 #15 #16 #21 #22
- ⑥ FEDERATE：#12（council 保持并行产品，互链不吞并）

## 核实状态说明

- 「UNVERIFIED-REMOTE」：Gitee jiqun-port 与 openclaw 侧内容本机不可达，
  描述来自业主四路挖掘报告。任何 ①/② 档合入前，第一步是 checkout 对应
  分支并固定 SHA；核不到源码的项自动冻结在台账，不进 packet。
- 本机已核实：chaotang-os 分支（#8–#11）、`CourtOS-Brain`、`legal-agent`、
  `chaotang-landing`、`battery-rd-os`、钦天监待裁台账文件。
