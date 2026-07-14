# 任务：refactor-repository-structure-20260714

## 任务 1：固定根级所有权

- 目标：退休根级 `plans/`、`PROJECT_STATUS.md` 和 `frontend/harness/`，并用 tracked-file 策略防止复发。
- 前置条件：在隔离 worktree 实施，不覆盖主工作区并发改动。
- 输入：Git tracked file 清单、三层所有权规则。
- 输出：`docs/plans/`、`docs/status/archive/`、结构策略及测试。
- 涉及文件：`docs/`、`scripts/lib/repository-structure.mjs`、`scripts/harness-doctor.mjs`。
- 状态 / 数据变化：只迁移版本化文件，不移动运行数据。
- 验证命令与证据：`node --test scripts/repository-structure.nodetest.mjs`；`node scripts/harness-doctor.mjs`。
- 回滚边界：单个 Git 重构提交。
- 完成定义：退休路径无 tracked file，未知根目录被拒绝。

## 任务 2：集中后端运行态

- 目标：所有主要可变状态统一解析到 `backend/var/`，版本化输入与测试夹具移出运行目录。
- 前置条件：旧目录数据不得被静默忽略或覆盖。
- 输入：路径引用清单、现有 Docker named volumes、tracked memory/trace 文件。
- 输出：`runtime_paths.py`、保守迁移脚本、memory seed 和 trace fixture 新位置。
- 涉及文件：`backend/src/`、`backend/resources/`、`backend/tests/fixtures/`、部署配置和文档。
- 状态 / 数据变化：代码不自动迁移；operator 停服后显式 `--apply`。
- 验证命令与证据：`python3 -m pytest -q tests/test_runtime_paths.py` 及相关存储测试。
- 回滚边界：代码回滚不删除 `backend/var/` 或旧运行目录。
- 完成定义：环境变量优先级和旧库 fail-fast 有测试证据。

## 任务 3：修正评测所有权

- 目标：把两套非 UI evaluator 从前端迁入后端 harness 并登记。
- 前置条件：浏览器验证继续归 `frontend/e2e/` 与 `frontend/.harness/`。
- 输入：两套 evaluator、golden/candidate/baseline 资产。
- 输出：`backend/harness/deep-research-skill-distillation/` 与 `hubu-investment-swarm-gate/`。
- 涉及文件：两层 manifest/wiki、evaluator README 与输出路径。
- 状态 / 数据变化：运行报告进入 ignored `artifacts/`，基线继续版本化。
- 验证命令与证据：两个 evaluator、backend/root doctor。
- 回滚边界：机械 rename 可由 Git 回滚。
- 完成定义：从任意 cwd 可运行、manifest 完整、运行后工作树不新增报告。

## 任务 4：准备 CourtOS-Brain 独立化

- 目标：解除生产清单对仓内 subtree 的默认依赖，并明确删除门禁。
- 前置条件：当前没有独立远端与内容等价证据。
- 输入：知识清单参数、外部 vault/仓内 subtree 状态。
- 输出：显式 `COURTOS_BRAIN_ARCHIVE_PATH` 契约与独立化门禁文档。
- 涉及文件：`backend/scripts/knowledge_resource_inventory.py`、`.harness/wiki/courtos-brain-extraction.md`。
- 状态 / 数据变化：不删除、不覆盖任一知识目录。
- 验证命令与证据：`python3 -m pytest -q tests/test_knowledge_resource_inventory.py`。
- 回滚边界：配置默认值和文档。
- 完成定义：未配置时不扫描仓内 subtree；删除保持阻塞直到恢复证据齐全。
