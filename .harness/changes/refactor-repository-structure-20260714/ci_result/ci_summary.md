# CI 摘要：refactor-repository-structure-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `node --test scripts/repository-structure.nodetest.mjs` | 0 | 3 passed | 根白名单、退休路径、运行态禁追踪 | 2026-07-14 隔离 worktree |
| 后端路径/迁移/DB tripwire/知识清单/拓扑针对测试 | 0 | 35 passed | 本轮二次复核的危险路径 | 2026-07-14 隔离 worktree |
| 后端运行态扩大针对集合 | 0 | 338 passed | 运行路径消费者与修正后的 topology | 2026-07-14 子任务证据 |
| 两套 Node evaluator | 0 | deep research 6/6；Hubu safe 2/2 且 unsafe 正确阻断 | 迁移后的评测资产 | 2026-07-14 隔离 worktree |
| `python3 backend/scripts/harness_doctor.py` | 0 | 0 errors, 0 warnings | 后端 manifest/资产完整性 | 2026-07-14 隔离 worktree |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors, 0 warnings | 根结构、三层委托与 CourtOS-Brain 边界 | 2026-07-14 隔离 worktree |
| `python3 -m compileall -q backend/src backend/web backend/scripts` | 0 | passed | Python 语法/导入编译 | 2026-07-14 隔离 worktree |
| `python3 -m pytest -q backend` | 1 | 2548 passed, 27 skipped, initially 10 failed | 后端全量基线 | 2026-07-14 隔离 worktree |
| `python3 -m pytest -q --lf` | 1 | 8 failed | 修正 2 个 topology 后的剩余基线失败 | 2026-07-14 隔离 worktree |
| `git diff --check` | 0 | passed | whitespace/diff 完整性 | 2026-07-14 隔离 worktree |

## 结果

结构策略、迁移后的评测、两层 doctor、编译与针对性回归全部通过。全量 pytest 中本轮路径变化触发的 2 个 topology 假实现已修正并重跑通过；剩余 8 项为既有环境/基线问题，未在本结构变更中顺带修复，因此本记录保持 `VERIFIED_PARTIAL`。

## 未验证项

- `test_case_archive_rag` 2 项：环境缺少 `sqlite_vec`，旧 mock 未覆盖当前导入路径。
- `test_commit_closeout_check` 1 项：真实文档基线缺少测试假设的 `docs/qintianjian.md`。
- `test_lawyer_rag` 4 项：当前法条库基线无命中。
- `test_persona_registry` 1 项：当前 roster 与测试对 `munger` 席位的假设不一致。
- 独立 CourtOS-Brain 远端、克隆恢复与树对账尚未建立，因此 subtree 删除明确未执行。
- 外部 lease attestation 公钥/required check 未配置；候选提交与推送不能声明完成。

## Diff 与回滚复核

- changed files：根结构/文档、后端运行路径与部署、后端 harness/manifest、测试和变更记录；未触碰 `backend/web/routers/dadian.py`。
- diff review：已检查退休路径、默认 DB 三入口、旧数据迁移冲突、ignored artifacts、manifest 注册和 historical change records 不被重写。
- 回滚是否演练：未执行破坏性回滚；Git rename 可逆，运行迁移默认 dry-run 且不合并目标，代码回滚不会删除新旧数据。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 根级退休路径不再 tracked | 结构测试与 `git ls-files` 空结果 | PASS |
| 可变后端状态统一解析 | runtime path/migration tests + 338 针对测试 | PASS |
| 非 UI 评测归后端且被登记 | evaluators + 两层 doctor | PASS |
| 不静默创建空库 | runtime guard tests；tenant/SQLAlchemy/Alembic 接线复核 | PASS |
| CourtOS-Brain 安全独立化 | 配置解耦与删除门禁完成；独立远端未完成 | PARTIAL |
| 全量基线全绿 | 剩余 8 个既有失败 | PARTIAL |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：`VERIFIED_PARTIAL`
