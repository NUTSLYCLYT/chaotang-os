# 任务：fix-chaotang-task-projection-boundary-20260714

## 任务 1：锁定行为

- 证明孤儿投影、权威文本漂移和跨用户写入。
- 为 POST/PATCH 登记 P0-B 行为探针。

## 任务 2：统一归属边界

- 建立 `get_owned_decision_task` accessor。
- 两条持久化路由只消费 accessor 返回的正式任务。
- 不上调 router 裸查表面积基线。

## 任务 3：验证与交付

- 回归朝堂、权限、账本、奏折、唯一写入和旧契约。
- 运行能力治理、Harness Doctor、编译与 diff 检查。
- 排除并发知识归档，提交并同步候选分支与 ext。
