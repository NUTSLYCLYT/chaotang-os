# 变更摘要：incident-s10-control-db-v9-pollution-20260713

| 字段 | 值 |
| --- | --- |
| Change ID | incident-s10-control-db-v9-pollution-20260713 |
| 类型 | incident |
| 状态 | RECOVERED |
| Owner | Project Agent |
| 创建日期 | 20260713 |

## 事件

S10 初版错误地把 rollout schema 加入真实共享 control-plane DB。一次组合测试打开真实库，将 `user_version` 从 8 升到 9；六张 S10 rollout 表均为空。该设计已撤回，rollout 改用 git-common-dir 下独立 `rollout.sqlite3`，主库继续保持 S9 schema v8。

## 恢复

- 先创建 mode `0600` 快照：`/home/ubuntu/Projects/chaotang-os/.git/chaotang-harness/recovery-snapshots/pre-s10-separate-db-recovery-1783943161256.sqlite3`。
- 恢复前确认 `rollout_state`、`rollout_events`、`rollout_task_metrics`、`rollout_release_metrics`、`rollout_acceptance`、`rollout_snapshots` 全部为 0 行。
- 单一事务只删除上述六张空 S10 表及其 S10 triggers，并设置 `PRAGMA user_version=8`；未删除、更新或重建 task/lease/lock/release/audit 表。
- 恢复后 `PRAGMA integrity_check=ok`。

## 不变量核对

快照与恢复后按 `rowid` 排序的完整行 SHA-256 完全一致：

| 表 | 行数 | SHA-256 |
| --- | ---: | --- |
| tasks | 3448 | `88c95a24781b2796916afd9723bd731cb9f344d674cc129df83aaf24ca751aab` |
| leases | 1476 | `d8125bc14fa26aaa8c6d460958d3b0c86beea445fb4649ca997ee24a5e9614bc` |
| resource_locks | 253 | `39d910d5a46306d2eb29eece0a48ed4832266de246981f4728fed936d706e16e` |
| audit_events | 7231 | `2a106ee9269d88cac057b7e166d9ce404aeeab8fe15fff3d67db622cc0b3d273` |
| control_meta | 1 | `799b9244cd152963641e8c1337be8b4a9cfe00e943ce42ad031bf25e2847` |
| release_runs | 0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| break_glass_uses | 0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |

结论：业务控制数据在恢复前后字节级逻辑内容一致；仅移除了本轮错误创建的空 S10 对象并恢复 schema version。
