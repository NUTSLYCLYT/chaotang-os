# 回滚：docs-agentic-workflow-kernel-pattern-adoption-20260719

## 当前文档变更

本 change 不含 schema、数据库、运行时、Provider、真实数据、依赖安装或外部服务变更。

回滚范围：

1. 删除 `docs/plans/chaotang-os-agentic-workflow-kernel-pattern-adoption-2026-07-19.md`；
2. 撤销 `docs/README.md` 的导航条目；
3. 删除本 change 目录；
4. 若分支未提交/推送，可移除独立 worktree 与本地 branch。

禁止把回滚解释为：允许外部 runtime、真实数据、源码复制或第二事实源。撤回本 Decision 时，产品宪法、PRD、
canonical 主链和 M0–M10 原计划继续有效，所有新增模式保持未授权。

## 未来运行时最低回滚义务

任何采用项的未来 Packet 必须单独定义：停接、drain、在途查单、幂等重放、compatible read、forward-fix、
凭证撤销、sandbox 清理、删除传播和审计保留。安全 gate 回滚只能保持或加强 fail-closed，不能恢复不安全旧路径。
