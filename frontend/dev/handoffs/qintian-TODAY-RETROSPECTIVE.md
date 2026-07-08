# 钦天监 today 复盘与交接（2026-07-04）

> 诚实记录:今天做了什么、哪些重复了主线、哪些有独立价值、该修正什么。
> **纯记录文件,不含任何 git 操作建议之外的动作。已有分支/worktree/commit 一律不动。**

## 一句话
今天在错分支(`autoresearch/build-speed-jul4`)上,重做了当天其他并发会话已完成的钦天监自我进化功能,全程不知它们存在。仓库结构未损坏;主要损失是重复劳动。

## 核对铁证:我 today 的活 vs 已有主线

| 我 today 做的 | 主线已有(更好) | 判定 |
|---|---|---|
| 证伪 `citedSourcesContradict` + 过期 `effectiveVerdict`(休眠函数) | `feat/flywheel-connect` e538fcfd:court_archives 加 forecast_json/review_by_date + 到期兑现调度器 settle/listDueUnsettled,**过铁律4会审+4回归断言+tsc/build绿** | ❌ 重复,主线更完整 |
| go-live.sh / qintian-producer-proto.ts(情报采集/入库) | `master` 601ac843:`scripts/intel-collectors/submit-intel.mjs`,vet_intel核查+入库,**真跑验证**(比亚迪波兰储能大单入库/单源拒绝),且**引用了本目录的 THAW-CARD** | ❌ 重复,主线更成熟 |
| qintian-citation-audit.ts(锦衣卫引用体检) | `feat/jinyiwei-real-intel` d972705c:锦衣卫合一接真 /intel | ⚠️ 可能重复,需核对 |

## 有独立价值、该留的
- **`qintian-self-evolution-THAW-CARD.md`** —— 已被 master 采集器 commit 明确引用当依据。真产生了下游影响,保留。
- **`qintian-frozen-probes/probe4/probe5`** —— 验证"LLM判方向胜正则"的可复用工具+结论。保留。
- **方法论/元教训**(见下)。

## 该修正的"乱"(建议,零破坏,待人决定)
1. **2026-07-18 cloud 提醒(trig_015JUcjYL4QJTPHpUfgJy37e)** → 内容已过时(功能已在主线),**建议取消或改写**,否则会误导未来去做已完成的事。
2. **build-speed 分支上的钦天监代码 commit**(6d04224d 部分 / c27976ab / de56926a / 未提交的脚本) → **不 push、不 merge 进主线**(重复会冲突)。留支线待丢弃,不删不 reset。
3. **蓝图 BLUEPRINT** → 若保留,应加一句"证伪/过期/采集器已由 flywheel-connect + master 实现",避免误导。

## 最贵的一课
本仓 = 4 worktree + 30 分支 + 多并发会话。**动手前必须先 `git branch -vv` / 看现场**,确认没人在做同一件事。今天跳过这一步 → 重复劳动一整天。这是"验证前置"原则在协作仓的具体形态:先验证"是不是已经有人在做",再动手。

## 给未来会话的一句话
想碰钦天监/情报/飞轮之前,先读:`feat/flywheel-connect`(证伪预测+到期兑现)、`master:scripts/intel-collectors/`(采集器)、`feat/jinyiwei-real-intel`(锦衣卫真情报)。功能大概率已经在那里了。

## 前后端对齐(2026-07-04 只读核查发现 + 明确待办)
**后端 jiqun**(`/home/ubuntu/fe/fengQun/jiqun_ai_fresh`,master 6h前有活动)有配套钦天监实现:
- `src/tianjian_verdict.py` + `src/prompts_tianjian.py`(钦天监裁决 + prompt)
- `src/truth_ledger.py`(真值台账,含 `forecast_check`/`forecast_backtest`/`intel_check`/`jinyiwei_vet` checker,回归门读它)
- 注:后端"钦天监"语义更宽——还兼指"重大问题前置参谋协议"(见后端 AGENTS.md),≠ 前端纯预测部门。

**前端主线**:`feat/flywheel-connect`(court_archives 可证伪预测+到期兑现)+ `master:scripts/intel-collectors/`(采集器)。

**定性(诚实)**:前后端各有配套实现,方向一致(后端产判定+台账 ←→ 前端展示+采集),但**契约字段级对齐未验证**。
**⏳ 明确待办(今天未做)**:前后端字段级对齐核查——读后端 `truth_ledger/tianjian_verdict` 数据结构,逐字段比对前端 `court_archives.forecast_json` 契约。**别在疲惫/终端不稳时做**(易错,今天正是反例)。
**元问题(最该解决)**:同一"钦天监飞轮"至少三处并行(前端主线 / 后端 jiqun / 我 today 的重复品),**无人统管对齐**——这比任何单功能都该先治。开工先跑 `~/bin/whos-working.sh`。

---
_2026-07-04 · 诚实复盘,仓库未损坏,重复品留支线不上主线。_
