# 生产部署立项建议（提案，Pending owner 拍板）

> 状态：提案。本文不构成施工授权。起草：WorkBuddy，2026-10-07。
> 目标：给"单链路可交付版"（产品 V1）定部署路径，补上"防弹发动机缺车壳"的最后一环。

## 现状约束（部署方案必须全部满足）

1. 单 owner 使用（M0 单人 owner 产品权威），无多租户需求——**不做多用户改造**。
2. 凭据边界：`DEEPSEEK_API_KEY` 仅环境变量/dotenv 私路径；锦衣卫 MCP 凭据
   `env://`（Secret Manager）或本机 DPAPI，生产不得回退读本机文件。
3. 外网开关：`JINYIWEI_EXTERNAL_NETWORK_ENABLED` 默认关闭；部署方案不得打开。
4. 域间隔离：各域独立 SQLite（史馆/锦衣卫/军机处/钦天监），不引入共享数据库。
5. 主机环境：Windows 11 本机（H 盘真源），无 Docker（装 Docker 需开虚拟化，
   与无畏契约 ACE 反作弊冲突，owner 已明确拒绝）。

## 方案对比

| 方案 | 描述 | 优点 | 缺点 |
|---|---|---|---|
| A. 本机裸跑 + NSSM 服务化（推荐） | FastAPI(uvicorn) + Next.js(node) 以 Windows 服务常驻，前端反代后端 | 零新依赖；无虚拟化；SQLite 直用；调试直观 | 本机重启/游戏负载影响可用性；无异地容灾 |
| B. 云 VPS 单机部署 | 国内 VPS + systemd + Caddy/Nginx + 定期 SQLite 快照到对象存储 | 7×24 可用；容灾；与游戏机隔离 | 月成本；密钥上云需 Secret Manager；外网暴露面需收紧（仅 owner IP 白名单） |
| C. Tailscale 内网穿透 + 家里第二台小主机 | 二奶机跑服务，Tailscale 组网，owner 设备访问 | 近似 7×24；不出公网；成本低（复用旧机） | 需第二台机；穿透链路多一层故障面 |

## 推荐：先 A 后 B

- **第一步（V1 交付）**：方案 A。owner 单用户场景下"可用"优先于"常在"；
  NSSM/计划任务拉起 + 开机自启 + 健康检查（复用 `GET /health` 契约）即可交付。
- **第二步（V1.5）**：方案 B 上云，条件是 owner 确认需要 7×24（例如外呼系统联动、
  手机端访问）。上云前必须完成：密钥全部走 Secret Manager、管理端口只绑内网、
  部署脚本进仓并过 check_harness（部署也是产品行为，须 M0 授权）。

## 立项后首批任务（草案）

1. 部署 ADR（记录选型与边界，进 `docs/decisions/`）。
2. Windows 服务封装脚本 + 健康自检 + SQLite 定时快照到 `H:/ChaotangBackups/`。
3. 部署验收 task doc（含回滚：服务停止即回本机开发态，零数据迁移）。
