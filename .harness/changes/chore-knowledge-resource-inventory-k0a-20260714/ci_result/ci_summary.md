# CI 摘要：chore-knowledge-resource-inventory-k0a-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q tests/test_knowledge_resource_inventory.py`（实现前） | 2 | RED：模块不存在，collection 中止 | inventory 能力缺失 | 2026-07-14 terminal |
| optional ABSENT / producer identity 两轮 RED | 1 | 分别因 `allow_absent` 与 `producer` 契约缺失失败 | 缺席状态与不可变构建身份 | 2026-07-14 terminal |
| `python3 -m pytest -q tests/test_knowledge_resource_inventory.py` | 0 | 15 passed | 脱敏、确定性、竞态、symlink、SQLite RO、Qdrant read/copy/helper、ABSENT、CLI、producer identity、法条范围 | 2026-07-14 terminal |
| inventory coverage | 0 | 83%（296 statements / 51 missing） | K0A 单元行覆盖；另有真实外部副本集成 | 2026-07-14 terminal |
| 聚焦 + 相邻回归（inventory/local_ai_bridge/resource_consolidation） | 0 | 25 passed | K0A 与既有 Vault/resource 工具相容 | 2026-07-14 terminal |
| `python3 -m py_compile ...` | 0 | PASS | Python 语法/导入 | 2026-07-14 terminal |
| ruff / mypy / pyright availability | N/A | 当前解释器均未安装 | 静态 lint/type 未执行 | 2026-07-14 terminal |
| 真实 inventory 连续两次 | 0 | manifest 与 snapshot_set hash 均相等；6 STABLE + 1 ABSENT | 可复跑真实资源清单 | artifact + terminal，2026-07-14 |
| `strace -f ... knowledge_resource_inventory.py` | 0 | 1,167 次源路径操作，0 次写操作 | Vault/Qdrant/brain.db 只读边界 | `/tmp/chaotang-k0a-final.strace`，2026-07-14 |
| artifact 递归字符串脱敏扫描 | 0 | forbidden value hits=0 | 正文、绝对路径、secret/payload value 不外泄 | 2026-07-14 terminal |
| `python3 -m pytest -q` | 1 | 2489 passed / 13 failed / 27 skipped / 9 xfailed | 全后端回归 | 188.12s，2026-07-14 terminal |
| `python3 scripts/harness_doctor.py`（backend cwd） | 0 | 0 errors / 0 warnings | 后端 harness | 2026-07-14 terminal |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 根/前/后 harness 与 change | 2026-07-14 terminal |
| capability governance node test | 0 | 2 passed | 旧入口仍不可删除 | 2026-07-14 terminal |

## 结果

K0A 最小闭环通过。最终 artifact：`knowledge-resource-inventory.v1`，manifest hash `sha256:8175856ef3e7daa465bce414d0c81ad03ed37d4ff83810739342f3bce1b6967c`；0 accepted / 16,234 quarantined。法条 inventory 精确命中 6 个 statutes 文件。全量后端仍有 13 个既有失败，与 `.harness/changes/test-sqlalchemy-production-db-tripwire-20260714/ci_result/ci_summary.md` 记录的 sqlite-vec、法条路径、FakeApiOrchestrator、taxonomy/文档和环境 LIVE/FALLBACK 基线一致，本轮文件不在这些失败调用链内。全量测试生成的临时 `doc-b28cba7ce688.md` 已删除，最终 artifact 在清理后重新生成并复跑一致。

## 未验证项

- live Vault 在独立墙钟前后 hash 检查中被外部 writer 改动；strace 已证明不是 inventory 写入。真实单写者归因与封禁属于未批准 K0C。
- 历史资料 owner/license/tenant 仍未知，16,234 项全部 quarantine。
- 当前 sqlite-vec DB 为 `ABSENT`，K0A 可冻结“缺席事实”，但不能证明知识检索 READY。
- ruff/mypy/pyright 未安装；以 py_compile 与测试替代，静态类型/风格证据缺失。
- 本轮没有浏览器/UI 变更，因此未运行浏览器验证。

## Diff 与回滚复核

- changed files：inventory CLI/test、K0A root change/artifact、知识飞轮蓝图状态。
- diff review：只读 source adapters；嵌入式 Qdrant 只打开临时复制；artifact 不含正文、源路径、point id 或 payload value；未触碰用户既有脏文件。
- 回滚是否演练：代码/文档删除即可；外部资产没有本轮写入，无运行回滚动作。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| TDD RED→GREEN | 4 次可观察 RED；最终 15/15 | PASS |
| 7 个来源均可冻结 | 6 STABLE + current RAG ABSENT | PASS |
| 可复跑 | 两次 manifest/snapshot hash 相等 | PASS |
| 不写外部源 | strace 1,167 ops / 0 writes | PASS |
| 不泄露 | forbidden value hits=0；privacy flags 全 false | PASS |
| 不自动晋升 | accepted=0 / quarantined=16,234 | PASS |
| 项目回归 | K0A/相邻 18 passed；全套 13 个既有失败 | PASS_K0A / BASELINE_RED |

## 声明状态

- `VERIFIED_COMPLETE_K0A / PROJECT_BASELINE_RED`：K0A 证据闭环完成；不代表 K0B/K0C/K1、知识检索、史馆、翰林或生产 READY。
