# 朝堂 AI 盒子 · 打包蓝图（2026-06-25）

> 把朝堂 OS 打成"单机私有可交付盒子"（on-prem appliance）。客户数据不出门 = 军工/涉密刚需。
> 跨仓:前端 `chaotang-web-lyt`(本仓) + 后端 `jiqun_ai_fresh`(蜂群/执行) + LiteLLM(模型网关)。

## 0. 必须先定:模型在哪跑（Karpathy · 决定 Dockerfile 形态）
| 选项 | 适用 | 代价 |
|---|---|---|
| **盒内本地模型** | 军工/涉密(数据主权·不出门) | 盒子要 GPU + 量化模型,能力/成本受限 |
| 盒子 + 云 API | 普通企业 | 便宜能力强,但数据出门(军工不接受) |

**先答这个**——它决定盒子带不带 GPU、LiteLLM 接本地推理还是云。**没定之前不要采购硬件。**

## 1. 栈（盒内四服务）
- `web`(本仓·Next standalone·:3000) — Dockerfile 已就绪(standalone + CJK 字体 + real 模式)。
- `jiqun`(jiqun_ai_fresh·:8081) — 蜂群/执行臂。**独立仓,需自带 Dockerfile**。
- `litellm`(:4444) — 模型网关(接本地模型 or 云,见 §0)。
- `turso/sqlite` — 决策/史馆库(盒内持久卷)。

## 2. 容器化现状
- ✅ web `Dockerfile`(本仓·standalone) 已就绪。
- ⬜ `docker-compose.yml`(编排四服务) — 本次起草(见本仓 compose),jiqun/litellm 服务待各自镜像。
- ⬜ jiqun 仓 Dockerfile(跨仓,后端团队出)。
- ⬜ 真数据快照(promo/intel/finance.local.json)运行时挂载,**绝不打进镜像**(真数据不入交付物)。

## 3. ⚠️ 安全红线（盒子交国防客户的底线）
**env 红线（compose 必设）:**
- `FENGQUN_AUTH=true` ——**单点命脉**。=false 则 court/* 全裸奔(伪造 token 穿墙)。`chaotang-censor.sh` 已监控。
- `NEXT_PUBLIC_API_MODE=real`、密钥经 env/密钥管理器(不入镜像)。

**代码层(已锁·自守):** 5 道 CI 守门——`guard:realdata`(strict 0漂移)/`guard:honesty`(阻断)/`guard:auth`(strict 0裸奔本地写)/`guard:upstreams`/`guard:freeze`。court/* 本地写已纵深防御(FENGQUN_AUTH + requireSession 双门)。

**数据隔离(军工铁墙):** 盒子绝不碰 H 盘军用/合同/保密区;importer 双层过滤(文件名级,**升内容级**前不接生产数据源)。

**⭐ 交付前必做(天才建议·别让"5道CI绿"=虚假安全感):**
> **每台盒子交付前过一次真渗透**（security-reviewer/外部）。自动门防"已知模式回潮",真渗透找"未知洞"(注入/越权读/依赖CVE/逻辑漏)——两者不可互替。CI 绿 ≠ 安全过。

## 4. 部署步骤（盒内）
1. 定模型方案(§0) → 配 litellm。
2. `docker compose build && docker compose up -d`(四服务)。
3. nginx → web:3000(基路径按客户;军工建议**纯内网,不接公网**)。
4. 验:`pnpm censor`(御史巡查全绿) + `gate:daily`(5守门绿) + 一次真渗透。
5. 真数据:挂载客户自己的 gitignored 快照(非交付物自带)。

## 5. 交付清单（装客户前逐项打勾）
- [ ] 模型方案已定（本地/云）
- [ ] 四服务 compose 起得来、互通
- [ ] `FENGQUN_AUTH=true` 已设、censor 验证验签开
- [ ] 5 道 CI 守门全绿
- [ ] 军用/合同/PII 数据隔离验证（importer 内容级过滤）
- [ ] **一次真渗透通过**（⭐ 不可省）
- [ ] 内网部署（军工不接公网）/ 公网则过等保·保密审查
- [ ] 客户 onboarding 文档（怎么下旨/看奏折/裁决）

## 6. 商业化（盒子验证后才走）
先把第一台装自己用(波1·跑20条真决策·量帮到率),过判据再卖第二台。宣传站/定价在盒子验证后建。
