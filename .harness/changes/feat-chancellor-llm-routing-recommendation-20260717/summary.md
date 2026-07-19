# 变更摘要：feat-chancellor-llm-routing-recommendation-20260717

| 字段 | 值 |
| --- | --- |
| Change ID | feat-chancellor-llm-routing-recommendation-20260717 |
| 类型 | feat |
| 状态 | VERIFIED_PARTIAL |
| Owner | Project Agent |
| 创建日期 | 20260717 |

## 范围

- 主线：PKT-5 丞相结构化 LLM 路由推荐层。
- 文件：`backend/src/chancellor_llm_recommendation.py`、`backend/src/chancellor_router.py`、对应测试。
- 验证：推荐层与丞相路由测试 17 passed；全量后端回归待收口。
- 边界：推荐层只提供候选部门/D 级建议，确定性风险硬门拥有最终裁决权。

## 追加修复（2026-07-18，Claude 会话）

- `merge_decision_level` 边界缺陷：`LEVELS.get(level, 0)` 曾把不认识的等级
  （含空字符串）静默当 D0 处理，违反"硬门永远拥有最终裁决权"。改为遇到不认识
  的等级直接 raise ValueError。提交 `20d50e6`、`630421e`。
- `decision["decision_level"]`/`decision["route_recommendation"]`（`chancellor_router.py`）
  算出来后没有任何下游消费者读取——纯死数据，未修，需要产品侧先定义这两个
  字段该驱动什么行为，不是单纯 bug fix 的范围。
- **提交披露**：`20d50e6` 提交信息只写了本次修复内容，未披露实际带入的另一条
  工作。未重写历史，此处补充披露，区分"客观可查证据"与"自陈"：

  客观可查证据（`git log`/`git reflog`，任何人可独立重跑核对）：
  - `20d50e6` 的 parent 有两个：`8f7aef2` 与 `0d2feb9`。
  - `8f7aef2..0d2feb9` 是 5 个与本次修复无关的 commit，跨至少两个不同主题
    （逐条列出，不做主题概括，避免以偏概全）：
    `613553d fix: restore legal corpus and roster baseline`、
    `853b9dd test: isolate forecast endpoint from shared rag state`、
    `60653c7 docs: reconcile backend baseline verification`、
    `e70fd91 feat: instrument legacy forecast router calls`、
    `0d2feb9 docs: record legacy router telemetry gate`。
  - `git reflog` 记录 `20d50e6` 的动作类型为 `commit (merge)`，说明执行该次
    `git commit` 时 `MERGE_HEAD` 已经存在。reflog 不记录 `MERGE_HEAD` 由谁/
    哪个进程创建，无法从 git 本身确认源头。
  - `b87113e`（reflog 时间戳 00:30:36）动作类型同样是 `commit (merge)`、parent
    也是两个。这只证明"该时间点附近同一工作目录里又发生过一次同类现象"，样本
    仅两次且时间相邻，不足以断定是这条分支上的常态模式，也不能排除两次是同一
    个外部操作的连带影响。

  自陈（非独立证据，仅供参考，不可外部验证）：本会话的工具调用记录中没有主动
  执行过 `git merge`；`b87113e` 也不是本会话的提交动作产生的。
