# Request Analysis：Scene Pack V1 下一轮

## 背景

Scene Pack V1 第一批已完成入口、统一运行记录、军机处看板和四个真实场景；`proposal-quotation-tender` 仍为 `stubbed`，SceneRun 结果尚未接入史馆正式归档。

## 候选目标

1. SceneRun → 史馆 `REPLY` best-effort 归档。
2. `proposal-quotation-tender` → `real_v1`。

## 成功标准

- SceneRun 成功后可以在史馆找到对应 owner-scoped `REPLY`。
- 归档失败不导致场景 API 500，也不在前端显示“已归档成功”。
- 投标场景缺成本或客户需求时返回 `blocked`。
- 投标场景 demo 可输出结构化 Bid/No-Bid 作战卡并进入军机处。

## 非目标

- 不真实提交投标文件。
- 不自动发报价或澄清函。
- 不进行未授权公网抓取。
- 不新增第二套归档或投标引擎。
