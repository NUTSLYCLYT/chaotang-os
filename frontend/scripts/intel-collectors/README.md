# 情报采集器（户部电芯价采集器雏形）

> 呼应 `dev/handoffs/qintian-self-evolution-THAW-CARD.md` 阶段0.5 的缺口：
> "真情报管道已建好，缺的不是基建，是'生产者'"。

## 这个脚本自动化了什么，没自动化什么

**自动化**：核查（vet_intel 可信度分级）+ 入库（POST `/api/court/intel/signals`）这两步确定性逻辑。

**没有自动化、仍需人工/agent介入**：真正的"联网搜索找情报"这一步。原因很实际——
Claude Code 的 `web-access`/`WebSearch` 是 agent 会话内的工具调用，不是一个普通 Node.js
脚本能在无人值守场景下自主调用的东西（背后是真实浏览器/搜索服务，需要 agent 编排）。

如果要做到完全无人值守（cron 定时跑、不需要 agent 在场），下一步需要接一个**真实的网页
抓取源**（比如直接爬 mysteel/SMM 的具体价格页面并解析 HTML），那是一个独立的、更大的
工程决定（价格页面结构会变、可能有反爬），本次不擅自展开，先诚实交付这一半。

## 用法

```bash
node scripts/intel-collectors/submit-intel.mjs \
  --claim "主流314Ah磷酸铁锂电芯价格从2025年底0.26~0.31元/Wh攀升至0.36~0.39元/Wh" \
  --source "上海有色网SMM|https://m.mysteel.com/hot/1486124.html" \
  --source "集邦咨询TrendForce|https://www.trendforce.cn/price/battery-price" \
  --title "314Ah磷酸铁锂电芯涨价" \
  --category risk --level watch \
  --token "$(cat /path/to/access-token.txt)"
```

跑法：agent（或人）先用 web-access 找到真实情报 + 真实来源 URL，再调这个脚本做核查+入库。
`--source` 可以传多个，每个是 `名称|URL` 格式。核查未通过（信源不足/含硬声明未印证）会诚实
打印"待核"并拒绝入库，不会为了"看起来能用"而强行放行。
