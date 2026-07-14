# 任务：fix-chaotang-dispatch-durable-fact-20260714

## 任务 1：先落账后执行

- 抽出 caller-owned transaction 的兼容任务适配函数。
- 在一个事务中写正式任务、旧执行索引和派单事件。
- commit 后才创建队列与后台线程。

## 任务 2：失败封驳

- 数据库异常回滚整个事务。
- 返回失败信封，证明 registry 为空、后台未启动、正式任务为零。

## 任务 3：验证与交付

- 运行 dispatch、朝堂闭环、权限、事件账本、唯一写入、能力治理和 Harness Doctor。
- 显式排除并发生成的知识归档文件；提交并同步候选分支与 ext。
