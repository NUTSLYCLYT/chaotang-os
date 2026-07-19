# 回滚：fix-canon-idempotency-authority-p25-20260719

P25 只改 Markdown。技术上可由后续 change 反向恢复 P21 的 archive-only 文案并删除本 P25 change；但该操作会重新引入已证伪的历史叙述，因此必须有新的事实证据和 packet review，不能直接回退。

P25 没有 runtime/schema/data 变化，无数据库回滚。未来实现产生 production claim 后，仍只能 fail closed、保留 replay history 并 forward-fix，禁止 destructive downgrade 或恢复 raw-key authority。
