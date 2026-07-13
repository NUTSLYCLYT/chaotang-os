# Spec review v1

结论：`APPROVED`。

身份事实源固定为监听 3050 的 socket inode、真实 PID 和实际 build cwd。runtime record 只用于把已记录的 PID/start ticks/cwd 与 OS 事实对齐，其中的 commit/build ID/digest 不作为权威输入。
