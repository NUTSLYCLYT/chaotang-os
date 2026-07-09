# 朝堂真实闭环 Harness

本 harness 的目标是让第一条接近生产的朝堂闭环保持小、可审计、可回放。

它不调用模型或外部 provider，只验证一次 live run 在被运行记录或发布说明称为“真实闭环”前必须满足的契约。

## 必需证据

- 真实任务输入。
- 后端 API 或 runner 记录。
- 归档或回放 artifact owner。
- case id、run id、状态、owner、证据和下一步。

## 失败条件

- 没有发出 `launch_loop_case_created`。
- 缺少归档记录。
- 缺少 owner 或下一步。
- 把 demo/fallback 结果标成真实闭环。

## 归属边界

本 harness 只验证后端闭环证据：蜂群调用、运行记录、归档契约、状态流转和复盘记录。

## 入口

```bash
cd backend
python harness/chaotang-true-loop/scripts/run_true_loop_contract.py
```
