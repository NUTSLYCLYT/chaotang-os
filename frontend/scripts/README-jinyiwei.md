# 锦衣卫情报机关 · 操作手册

朝堂情报域:每日自动采集 → vet 把关 → 异动雷达 → /intel 呈现 + telegram 心跳。
可信度/雷达逻辑复用 skill `~/.claude/skills/锦衣卫/scripts/intel.py`(SSOT,不另造)。

## 闭环
```
cron 7:50 → 采集(RSS·可选主题) → 聚类交叉印证 → vet 门神(入库/待核/拒)
  → 异动雷达(新增/突变) → 写 intel_signals → /intel 驾驶舱
  → 心跳推 telegram(死则 🔴 告警)
```

## 文件
| 文件 | 作用 |
|---|---|
| `jinyiwei_intel_pipeline.py` | 主管线(采集→vet→雷达→入库) |
| `jinyiwei_topics.json` | **主题配置(用户改这个就行)** |
| `jinyiwei_heartbeat_notify.sh` | 心跳推送(telegram 日报 / 🔴告警) |
| `jinyiwei_intel_pipeline.test.py` | 回归断言(`python3` 直接跑) |
| `../public/intel-funnel.json` | 运行时漏斗+心跳(gitignored,自动生成) |

## 怎么"选"监看主题
改 `jinyiwei_topics.json`,把某主题 `enabled` 改 `true`/`false`,或加一条 `{name,query,enabled}`:
```json
{ "name": "半导体", "query": "半导体 芯片 制程 突破", "enabled": true }
```
默认开:国际形势 / 科技前沿 / AI进展。改完下次采集即生效,无需重启。

## 定时(已装 · 验证期)
```bash
crontab -l | grep jinyiwei     # 看
crontab -e                     # 改/删那行即撤销
tail -f /tmp/jinyiwei-cron.log # 看每日输出
```
每早 ~7:50 你 telegram 会收到:`🗡️ 锦衣卫日报 · 采X·入库Y·待核Z·拦W·🆕异动N`。
**连续没收到日报本身就是告警**(整条心跳通道死了)。

## 上生产
管线 DB 默认 dev 库;生产指向 prod 库即可(一套代码 dev/prod 通吃):
```bash
INTEL_DB_PATH=/path/prod.db python3 scripts/jinyiwei_intel_pipeline.py
```
生产环境有干净外网时,fetch 多出口会自动走直连(无需代理)。

## 排障
| 症状 | 原因 / 处置 |
|---|---|
| /intel 显「⚠️空转N」或 telegram 🔴 | 代理挂/被限频 → 查 `/tmp/jinyiwei-cron.log`;**数据不丢**(fail-secure 不清表) |
| 采集 0 条 | 多出口都不通(代理+直连均失败)→ 查网络;管线保留旧数据 |
| /intel 退回 mock | intel_signals 空 → 手动跑一次管线回填 |
| 入库总是 0 | 全是单源媒体(vet 正确拒)→ 加一手源主题(gov/cnesa/招标)或交叉印证 |

## 边界(勿越)
- 情报=资讯呈现,**不出买卖/高风险结论**(领域准入,见后端 `15_INVESTMENT_ADVICE_BOUNDARY.md`)。
- 常驻定时已登记钦天监待裁台账(A3)。改自动化范围前先过台账。
- 入决策(情报→上书房议题)属高危(写决策/共享表),铁律4 双门,未接——需会审。
