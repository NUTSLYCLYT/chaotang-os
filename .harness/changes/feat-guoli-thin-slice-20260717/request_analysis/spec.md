# 规格说明：feat-guoli-thin-slice-20260717

## 背景

全朝廷吸收战役 P8 要把后端已有的御史封驳率读模型投影到既有六部总览，补齐用户可见的系统自检信号，同时继续遵守“不建新页面王国”和事实诚实标纪律。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | `/api/guoli/overview` 已从租户 truth_ledger 计算御史封驳率 | `backend/web/routers/guoli.py`、`backend/tests/test_guoli_overview.py`，2026-07-17 阅读 | 后端 / pytest | 否 |
| 已确认事实 | 现有契约缺少 P8 卡片必需的时间窗口、截止时间和 DEMO 纳入标记 | `backend/web/routers/guoli.py` 返回形状，2026-07-17 阅读 | 前后端契约审计 | 是，须先最小补契约 |
| 已确认事实 | 六部总览是可落点的既有权威页面，大典无需改动 | `frontend/src/app/(dashboard)/liubu/page.tsx` | 前端 / 浏览器 | 否 |
| 未知问题 | 本机真实账本是否有足够御史样本 | 运行 `/api/guoli/overview` 后确认 | 部署验证 | 否；无样本应诚实显示 NO_DATA |

## 数据流与调用链

`truth_ledger` → 后端 `/api/guoli/overview`（计算、事实元数据）→ 前端类型化 adapter（只选择 `yushi_rejection_rate`）→ 六部总览顶部指标卡。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `GET /api/guoli/overview` | 后端 `truth_ledger` | 前端国力 adapter | pytest + node 契约测试 + Playwright API/UI 对照 |

## 范围

- 后端只补齐御史指标所需的 source/window/as_of/includes_demo 元数据，不改变比率算法。
- 前端新增类型化 adapter、回滚开关和一张六部总览顶部指标卡。
- 增加 LIVE、NO_DATA、开关关闭和浏览器冒烟证据。
- 更新根级与前端 change 审计记录。

## 非目标

- 不建立 `/guoli` 独立页面。
- 不展示另外三个 NO_DATA 指标。
- 不修改冻结的大典页面。
- 不新增 BFF、mock fallback、本地静态指标或前端计算封驳率。
- 不处理 P9 或其他 Wave 任务。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 样本为 0 | 状态显示 NO_DATA，不显示 `0%` 或伪精确百分比 | node 测试 + Playwright |
| 有真实样本 | 比率仅格式化后端 value，同时展示样本数和事实元数据 | pytest + API/UI 对照 |
| 响应含其他三项 | adapter/UI 只投影御史项 | node 测试 + DOM 断言 |
| feature flag 关闭 | 卡片完全不渲染 | node 测试 + Playwright |
| 契约缺字段/非法 | 进入明确不可用态，不以本地数据补齐 | node 测试 |

## 风险与回滚边界

主要风险是把账本范围、时间或 DEMO 状态在前端写死后误导用户。处置是让后端返回事实元数据，前端只校验和投影。回滚通过 `NEXT_PUBLIC_GUOLI_THIN_SLICE=false` 隐藏卡片；不恢复任何 mock。

## 计划确认记录

- 批准人：用户（连续指令“继续任务”并要求按 P0–P9 顺序执行）
- 批准日期：2026-07-17
- 批准范围：吸收计划 P8 国力薄纵切
- 明确未批准：独立国力页面、大典改动、其他三项指标、P9

## 验收标准

1. 六部总览存在一张御史封驳率卡，字段含值、样本数、时间窗口、来源、截止时间、是否含 DEMO、状态。
2. 数据只来自 `/api/guoli/overview`；无 mock、本地合成或静态数据。
3. NO_DATA 不显示百分比；其他三项不出现在 UI。
4. feature flag 可关闭卡片。
5. 后端 API 响应与浏览器截图/DOM 值一致，聚焦冒烟旅程通过。

## 验证计划

- `python -m pytest -q tests/test_guoli_overview.py`
- `pnpm test:node -- guoli-overview`
- `pnpm exec tsc --noEmit`
- `pnpm build`
- `pnpm harness:doctor` 与根级 `node scripts/harness-doctor.mjs`
- 聚焦 Playwright 国力卡测试；保存 API 响应与截图对照证据
