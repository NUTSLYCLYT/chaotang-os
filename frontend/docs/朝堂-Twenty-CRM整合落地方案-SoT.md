# 朝堂 OS ↔ Twenty CRM · 整合落地方案 · SoT

> 立于 2026-07-01。原则：**朝堂 = AI 决策大脑；Twenty = 客户系统记录。朝堂不自造 CRM。**
> Twenty(twentyhq/twenty·⭐52k·TypeScript·designed for AI)真取证：标准对象 company/person/opportunity/note/task/connected-account；自托管 `packages/twenty-docker/`。
> 大神镜片：Bezos(顺风单向门·买记录层)·Karpathy(选为AI而生的·别掉ERP泥潭)·张小龙(护城河=跨部合成不是CRM功能)。

---

## 0. 诚实边界
本文件是**可直接落地的配置+接线图**；真起服务器(`docker compose up` + 域名 + API key)是**你运维侧一步**，AI 沙箱起不了服务器，不假装已起。

## 1. 架构（三层，别混）
```
朝堂（AI 决策大脑）  ← 唯一护城河：跨户/兵/刑/钦天监一次御前裁决
   │ 读写 GraphQL API / Twenty MCP server
Twenty（客户系统记录）← company/person/opportunity 管道成交，B2B+B2C
   │
Mautic（B2C 获客自动化·偏SaaS后接）+ 你已有6真引擎（制造/成本/合规）
```

## 2. 部署（真配置·取证 twenty-docker）
- 服务：`server` + `worker` + `db(postgres:16)` + `redis`（`packages/twenty-docker/docker-compose.yml`）。
- 必配 `.env`：`SERVER_URL`(你的域名) · `APP_SECRET`(openssl rand) · `STORAGE_TYPE` · `TAG=latest`。
- 步骤：`git clone twentyhq/twenty` → 进 `packages/twenty-docker` → 填 `.env` → `docker compose up -d` → 建 workspace + 拿 API key。
- MCP：装 `twenty-crm-mcp-server`，把 API key 配进朝堂/Claude 的 MCP，agent 直接驱动 Twenty。

## 3. 数据模型映射（Twenty ↔ 朝堂，铁律2 单一真相）
| Twenty 对象 | 朝堂概念 | 谁用 |
|---|---|---|
| **company** | B2B客户/大客户 | 兵部 大客户司 · 礼部 关系 |
| **person** | 个人客户(B2C) + 联系人 | 兵部 获客/管道 · 礼部 |
| **opportunity** | 商机/deal（报价→成交，含 stage 漏斗） | 兵部 pipeline/deal desk |
| **note / task** | 跟进记录 / humanActions | 兵部 SDR |
| **connected-account**（邮件/日历同步） | 自动抓通信，不手录 | RevOps |
| opportunity **自定义字段** ← 朝堂写回 | 朝堂裁决：成本/报价档/御史风险/合规/料价时机 | **朝堂→Twenty** |

**记录归 Twenty，裁决归朝堂。** 客户/管道不在朝堂建平行表（铁律6/2）。

## 4. 兵部设置（Twenty 之上·B2B+B2C+获客）
兵部 8 司**不删**（用户确认获客要、偏SaaS）——但从"自己存客户"转为"**Twenty 数据上的决策镜片**"：
- `opportunity_pipeline`(SDR)：读 Twenty opportunity → 漏斗健康、卡住 deal 标红。
- `key_account_attack`(大客户)：读 company → 决策链、多线程；B2B。
- `pricing_deal_desk`(定价)：`marginToDocument`(户部真成本×毛利红线) → 写报价档回 opportunity。
- `customer_success_growth`(CSM)：**存量深耕 RFM×未渗透**（上轮摆正：归兵部不归礼部）→ 读 company/person 成交历史排序。
- `gtm_strategy`+`channel_partner`+`sales_revops`+`cro_chief`：策略/渠道/预测复盘/总裁决。
- **获客**：Twenty opportunity 漏斗 = B2B 获客；Mautic = B2C 个人客户获客自动化（后接）。

## 5. 面板改法（兵部 panel · 守朝堂统一UI 深色宫廷+帝金+卷轴两翼）
现面板是「派司队列」→ 改成「**Twenty 记录 + 朝堂裁决**」双层：
```
┌ 顶：身份条 + 获客漏斗健康(Twenty管道 stage 分布 + Mautic B2C) ┐
├ 左翼：Pipeline(Twenty opportunities 按 stage·卡住deal标红·金额排序) ┤
│ 中卷轴(核心·护城河)：选中 deal → 朝堂跨部御前裁决合成——            │
│   户部真成本 ¥X · 兵部三档报价 · 刑部合规(账期风险) · 钦天监料价时机 │
│   → 一句裁决：报X档、先锁价、缩账期。这是 CRM 永远没有的。          │
├ 右翼：存量深耕榜(CSM·RFM×未渗透 前20) + 下一步动作(写回Twenty)    ┤
└ 底：命令区(出报价呈奏 / 写回opportunity stage / 派humanAction)     ┘
```
- 数据源：pipeline/客户 ← Twenty GraphQL；成本/合规/料价 ← 朝堂6引擎；裁决 → 写回 opportunity 字段。
- **中卷轴是唯一别人抄不走的**：Twenty 给记录，朝堂给"这单该怎么打"的跨部合成。

## 6. 落地顺序（先通一条端到端，铁律5/马斯克）
1. 起 Twenty(docker) + 建 workspace + API key（你运维）。
2. 朝堂建 `twenty-client`(GraphQL 读 opportunity/company) — 一个薄适配。
3. **兵部一条端到端**：读一个真 opportunity → 合成裁决(成本+报价+合规) → 写回 stage/字段。跑通=AI-on-CRM 成立。
4. 面板中卷轴接上 → 你在浏览器点一个 deal 看到跨部裁决。
5. B2C 偏 SaaS 时接 Mautic；要全 ERP 再上 ERPNext。

## 7. 不可破
- 朝堂不建平行客户表（Twenty 是 SSOT）。
- 裁决写回 Twenty 要幂等 + 标 source(朝堂/御史)。
- 对外报价仍过高风险门(铁律13.2.5·未生效横幅)。
- 先一条真链跑通再铺（不同时接所有司）。
