# chaotang-os 可删除性裁定 · 2026-06-08

> Phase 3「吸收有价值资源」的收口。大神会审（Bezos/张小龙/Deming/charity/schneier）一致定调：
> **最诚实的产物不是再吸收，而是一张让 `/home/ubuntu/chaotang-os` 可删除的清单。**
> 判据（panel 铁律）：一段遗产资源值得吸收 ⟺ 删掉它会让真闭环里某个 `real`/`LIVE` handler 断。

## 裁定：DROP 代码，决策已在主线，留少量文档/设计图作参考

| 检查 | 结果 | 证据 |
|------|------|------|
| 真链路代码依赖 | **0** | `court-workflow`/`workflow-orchestrator`/`user-experience-modes`/`court-workflows`/`CourtWorkflow` 在 live 路径（`src/app/api/court` + `src/features/shangshufang`）命中 0 文件 |
| 决策是否已在主线 | **是（早已吸收）** | court-workflow 概念 5 个 FE 文件；board-maturity 规则 3 个 BE 文件；donggong/signoff **21** 个主线文件 |
| 唯一独有内容 | 仅 **~7 篇文档 + 一批设计 PNG** | `docs/朝堂OS-产品结构.md`(1330L)、`INTEGRATION_ALIGNMENT.md`、`CHAOTANG_PANEL_SKILLS.md`、`CHAOTANG_BOARD_MATURITY_ROADMAP.md`、`HUBU_BUDGET_PLATFORM_DESIGN.md`、根目录 `EASTERN_PALACE_HARNESS.md`/`PRINCE_DATABASE_GUIDE.md`/`PROJECT_MASTER_HARNESS.md`；`*.png`（throne/edict/study 等参考图） |
| `tt/chaotang-web-lyt` | 0/0 同步，无独有内容 | `HEAD == aa80f90 == 主线 HEAD` |

代码（`backend`/`bridge`/`web`/`data`/`scripts`）**全 DROP**：不在真链路，决策已在主线。
设计 PNG 是否进 FE 资产台账 = **非上线关键**，Option C 下 defer 到上线后再评（避免无证据盲搬，违反 absorption matrix「no blind asset dump」）。

## 删除门状态（据既有 deletion-policy）

| Gate | 状态 |
|------|------|
| Inventory（文件清单） | ✅ 完成（见 `CHANGE_LEDGER` + `CHAOTANG_OS_LEGACY_INVENTORY_AND_ABSORPTION_GATES` + 本档） |
| Migration（每项有去向或明确拒绝） | ✅ 本档即裁定：代码 DROP / 决策已在主线 / 文档+PNG 留作参考 |
| Mainline verification | ✅ FE `pnpm build` 0 · `tsc` 0 · true-loop E2E 2 passed · `verify-study-edict` 真后端 PASS；BE pytest 3/3 · harness `passed:true` |
| Archive（删前留冷备份） | ✅ **完成**：`/home/ubuntu/archive/chaotang-os-legacy-2026-06-08.tar.gz`（72M，gzip 校验 OK，1303 文件，含 `.git`+源码+docs+data+PNG；仅排除 node_modules/.next 等可再生物）。8 篇唯一文档已另吸收进主线 `docs/legacy-os-reference/` |
| Human signoff（人工签字） | ✅ **用户「全做」批准（2026-06-08）** |

> **已执行（2026-06-08）**：`rm -rf /home/ubuntu/chaotang-os` 完成；recommended end state 达成（FE + BE + 冷备份 tarball）。
> 可逆性：`tar xzf /home/ubuntu/archive/chaotang-os-legacy-2026-06-08.tar.gz -C /home/ubuntu` 即恢复。
> 注：`/home/ubuntu/workspace/chaotang-os`（容器目录，内含已归档的 `chaotang-ui-ms`）是另一回事，未动。

## 建议下一步

1. 用户确认裁定无误（尤其：那 7 篇文档里若有任何决策**尚未**进主线，现在指出，我抽成 1 行决策备忘补进主线 docs）。
2. 批准后：建冷备份 tarball → 用户签字 → 删 `chaotang-os`，达成 recommended end state：

```text
/home/ubuntu/workspace/chaotang-web-lyt  = 最终前端
/home/ubuntu/workspace/jiqun_ai          = 最终后端/harness
/home/ubuntu/archive/chaotang-os-legacy-2026-06-08.tar.gz = 冷备份
```

> 🎲 大神视角（jeff-bezos）：⚠️ 这是单向门——删之前那一下 tarball 是你唯一的回头路，别省。
> 💡 真正的风险不是"误删宝石"（grep 已证宝石不在代码里），而是"为了想象中的宝石迟迟不删"，让 1.8G 死系统继续制造"还有东西没吸收"的幻觉拖住上线。裁定已下：archive + 签字 + 删，闭环。
