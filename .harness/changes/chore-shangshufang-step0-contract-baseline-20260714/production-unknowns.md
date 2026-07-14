# Step 0 生产拓扑与容量 Unknown Closeout

状态：`DOC_COMPLETE_WITH_BLOCKERS`。本文件区分本机运行事实、仓库静态设计与生产事实；本机或模板证据不得替代生产 owner 的带时间戳证明。

## 1. 取证范围

| 字段 | 值 |
| --- | --- |
| 取证时间 | 2026-07-14T23:47–23:51+08:00 |
| 分支/快照 | `feature-chaotang-ext` / `a07381165c2ca191013b4eda1b92794a604eb222` |
| 本机命令 | `ss -ltnp`；`ps -eo pid,ppid,lstart,args`；`pnpm prod:doctor -- --json`；`ps -fp 2207,962,3917,7920`；`readlink /proc/<pid>/cwd` |
| 仓库来源 | deploy/service/compose、gunicorn、outbox、health、KPI、monitor、restore 与 S1 change 记录 |
| 明确未做 | 未读取 secret、客户正文或业务行；未重启/接管服务；未安装 service/cron；未调用收费 provider；未把本机 SQLite 当生产库 |

状态词：`CONFIRMED_LOCAL` 只证明本机瞬时事实；`CONFIRMED_STATIC` 只证明仓库设计；`CONFLICTING_STATIC_CONFIG` 表示仓库候选部署形状互相冲突；`NO_DATA/ABSENT` 表示没有实现或样本；`BLOCKED_EXTERNAL_EVIDENCE_REQUIRED` 必须由生产 owner 补证。

## 2. 本机运行基线

| 项 | 状态 | Owner | 证据时间与命令 | 结论 | blocks_steps |
| --- | --- | --- | --- | --- | --- |
| 前端 3050 | `CONFIRMED_LOCAL_FOREIGN` | Release Commander | 23:50；`prod:doctor`、`ps -fp 2207`、`readlink /proc/2207/cwd` | PID 2207，cwd=`/home/ubuntu/workspace/frontend/chaotang-master-wt`，不是当前 monorepo；不得接管或作为本仓发布证据 | Step 12；Launch S3/S10 |
| 后端 8081 | `CONFIRMED_LOCAL` | Backend Runtime Owner | 23:50；`ss`、`ps -fp 962`、`readlink /proc/962/cwd` | PID 962，命令 `python3 -m web.main`，cwd 为当前 `backend/`；这不是 gunicorn/service 安装证明 | Step 3B/12 |
| LiteLLM 4444 | `CONFIRMED_LOCAL_EXTERNAL_ASSET` | Provider Runtime Owner | 23:50；`ss`、`ps -fp 3917`、`readlink /proc/3917/cwd` | PID 3917，cwd=`/home/ubuntu/.openclaw`；另有 host-gw forwarder PID 7920，均属仓库外运行资产 | Step 5/12 |
| immutable build | `ABSENT_LOCAL` | Release Commander | 23:51；`test -d frontend/builds` 返回 1；`prod:doctor` | 当前 monorepo 没有 `frontend/builds`，不能绑定 immutable build identity | Step 12；Launch S3/S10 |
| release doctor | `STOP` | Release Commander | 23:50；沙箱外 `pnpm prod:doctor -- --json` exit 2 | 5 项中 2 PASS；失败为 foreign 3050、missing builds、JWT key id 缺失。HTTP health 和 true-chain ready 不能覆盖 STOP | Step 12；Launch S3/S5/S10 |

沙箱内首次 `prod:doctor` 因网络/git 权限出现 EPERM，只作为“沙箱结果不可采信”的证据；上表使用获授权的沙箱外只读复跑结果。

## 3. 仓库静态拓扑事实

| 项 | 状态 | Owner | 证据时间与来源 | 结论 | blocks_steps |
| --- | --- | --- | --- | --- | --- |
| canonical 路径 | `CONFIRMED_STATIC` | Release/Operations Owner | 2026-07-14；`scripts/canonical-deploy-paths.nodetest.mjs`、S1 operational change | deploy/service/cron/monitor 文本已指向 monorepo；不证明模板已安装或运行 | Step 12 |
| user-systemd 目标栈 | `CONFIRMED_STATIC` | Infra Owner | 2026-07-14；`frontend/deploy/README.md`、`frontend/deploy/services/*.template` | 目标端口 web 3050、backend 8081、LiteLLM 4444、legal-agent 18003 | Step 3B/12 |
| backend unit 唯一性 | `CONFLICTING_STATIC_CONFIG` | Infra Owner | 2026-07-14；`frontend/deploy/services/jiqun.service.template`、`backend/scripts/jiqun_ai.service` | user unit 与 system unit 都绑定 8081，restart/资源/停止语义不同；未裁决生产使用哪一个 | Step 3B/12 |
| compose 端口 | `CONFLICTING_STATIC_CONFIG` | Infra Owner | 2026-07-14；`frontend/docker-compose.yml`、`backend/Dockerfile` | box compose 期待 backend 8081，Dockerfile 固定 8080；没有生产覆盖证据 | Step 3B/8/12 |
| backend 数据卷 | `CONFLICTING_STATIC_CONFIG` | Database/Infra Owner | 2026-07-14；两份 compose 与 `FENGQUN_RUNTIME_ROOT` | box compose 未为 `/app/var` 提供持久卷，另一份 backend compose 是不同部署形状 | Step 1A–1C/3B/11/12 |
| outbox 组件 | `CONFIRMED_STATIC_PARTIAL` | Backend Runtime Owner | 2026-07-14；`backend/src/execution/outbox_worker.py` | 有 claim/retry/dead-letter/stale 组件逻辑，但只在被调用时生效 | Step 3B |
| 独立 outbox worker | `ABSENT` | Backend Runtime Owner | 2026-07-14；全仓调用/部署入口扫描 | `process_pending_events()` 没有常驻 supervisor/service/cron 调用；现路径仍依赖 web 进程内 daemon thread | Step 3B，继而 Step 4–12 |
| 监控/readiness | `CONFIRMED_STATIC_PARTIAL` | Observability Owner | 2026-07-14；health/readiness、monitor 脚本 | `/api/ready` 存在，但 health monitor/restore 主要看 2xx `/api/health`，可能把 degraded 当健康 | Step 8/12 |
| 数据恢复 | `ABSENT` | Database/SRE Owner | 2026-07-14；`frontend/scripts/system-restore.sh`、仓库扫描 | `system-restore.sh` 只重启与探活，不是业务备份/空机恢复 | Step 12 |

## 4. 生产 Unknown 矩阵

生产证据命令必须由有权限的 owner 在执行前写入对应 release/change；当前仓库无法确定集群/主机平台，故不虚构 `kubectl`、云厂商或数据库命令。

| 项 | 状态 | 待绑定 Owner | 证据时间与命令/来源 | 当前结论 | blocks_steps |
| --- | --- | --- | --- | --- | --- |
| 实际部署模式、release id、实例数 | `BLOCKED_EXTERNAL_EVIDENCE_REQUIRED` | Release Commander + Infra Owner | 2026-07-14；`OWNER_TO_DEFINE_PRODUCTION_COMMAND` | systemd、box compose、backend compose 三种候选并存；本机瞬时进程不等于生产清单 | Step 3B/12 |
| web/worker 拓扑与 supervisor | `BLOCKED_EXTERNAL_EVIDENCE_REQUIRED` | Backend Runtime Owner | 同上 | 未知 web/worker 数、worker identity、heartbeat、lease/fencing；独立 outbox worker 在仓库中缺席 | Step 3B–12 |
| 优雅停机窗口 | `PARTIAL_STATIC/BLOCKED` | Infra Owner | service/Docker/gunicorn 配置 | system unit/Docker 候选为 30 秒，user unit未声明同等语义；没有真实长任务 SIGTERM 演练 | Step 3B/12 |
| P50/P95/P99 与样本窗口 | `NO_DATA` | Observability Owner | KPI/production event 扫描 | canonical 上书房/outbox 未写完整端到端 latency 样本；历史 ops snapshot 不可当当前生产事实 | Step 3A/4/5/12 |
| 稳定并发、吞吐与背压 | `NO_DATA` | Capacity Owner | gunicorn/thread/outbox 静态配置 | 只有局部 worker/thread/batch 值；无全局队列、租户公平、稳定容量与有界负载证据 | Step 3B/4/12 |
| provider quota、429 与重试预算 | `BLOCKED_EXTERNAL_EVIDENCE_REQUIRED` | Provider Runtime Owner | provider 配置；`OWNER_TO_DEFINE_PROVIDER_EVIDENCE` | 未知生产 quota、限流、错误分布和供应商批准值 | Step 3A/5/12 |
| 单任务/日成本 | `NO_CURRENT_DATA` | Provider/FinOps Owner | KPI/ledger 扫描 | 无 canonical task/run/model cost ledger 和统计窗口 | Step 4/5/12 |
| 生产 DB 类型、revision、规模 | `BLOCKED_EXTERNAL_EVIDENCE_REQUIRED` | Database Migration Owner | `OWNER_TO_DEFINE_DB_READONLY_COMMAND` | 本机仅发现 3 个 SQLite 文件元数据，不能判断生产 DB/行数/索引/revision | Step 1A–1C/12 |
| tenant 来源映射与孤儿量 | `BLOCKED_EXTERNAL_EVIDENCE_REQUIRED` | Database Migration Owner + Source Data Owners | migration/代码扫描 | 仍见默认 tenant/匿名 sentinel；生产映射、不可归属数量与 quarantine 规则未实测 | Step 1A–1C |
| cron/timer 安装与最近执行 | `BLOCKED_EXTERNAL_EVIDENCE_REQUIRED` | Operations Owner | 脚本和路径测试 | 有脚本/示例，无版本化安装清单、last-run、missed-run 告警或送达证明 | Step 3B/8/12 |
| 告警与值班 | `BLOCKED_EXTERNAL_EVIDENCE_REQUIRED` | SRE Owner | monitor/runbook 静态扫描 | 无告警送达演练、ack/escalation 与实名 on-call 证据 | Step 3B/5/12 |
| 备份、RPO/RTO、空机恢复 | `ABSENT/NO_DRILL` | Database/SRE Owner | 备份/restore 扫描 | 无加密业务备份、schedule、count/hash/权限对账或恢复后删除重放 | Step 12 |
| staging/canary/外部 attestation | `BLOCKED_EXTERNAL_EVIDENCE_REQUIRED` | Release Commander + External Authority Owner | rollout runbook/trust 配置 | 外部 authority、required check、独立 signer 和 24h/72h 观察未获生产证明 | Step 12 |

## 5. Task 7 生产侧结论

Task 7 的生产拓扑产物已形成，但所有 production-only 项均未关闭。退出条件仍是：有实名 owner、明确只读命令/来源、带时间戳原始证据、生产 release/实例身份、结论和 `blocks_steps`；任何本机健康、模板或静态测试都不能将本文件升级为 `RESOLVED`。
