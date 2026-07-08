# 兵部飞轮线实现报告

status: DONE
commit: e9f7ba64

## 四命令结果

| 命令 | 结果 |
|------|------|
| pnpm test:core | 329 tests pass, 0 fail（含新增 ok43/44/45 三条） |
| pnpm test:node | 445 tests pass, 0 fail（含新增 ok53/54/55 三条） |
| tsc --noEmit | 0 错误 |
| build | ✓ Compiled successfully in 22.2s |

## 文件清单（6个）

- `src/core/courtos/department-flywheel/bingbu/config.ts` — BINGBU_FLYWHEEL_CONFIG(maxPerRun:2) + BINGBU_KEYWORDS(22个销售关键词)
- `src/core/courtos/department-flywheel/bingbu/hooks-pure.ts` — selectCandidates + passesThreshold（纯函数，无 @/ 值导入）
- `src/core/courtos/department-flywheel/bingbu/hooks.ts` — bingbuHooks(DeptHooks)，derive 用 CRO 引擎
- `src/core/courtos/department-flywheel/bingbu/hooks.nodetest.ts` — 纯逻辑测试（test:core）
- `src/core/courtos/department-flywheel/bingbu/hooks.derive.itest.ts` — derive 集成测试（test:node）
- `src/app/api/court/bingbu/auto-raise/route.ts` — 镜像户部 route，使用 bingbuHooks + BINGBU_FLYWHEEL_CONFIG

## derive 测试归属

derive 依赖 `runBingbuCROSalesOfficeReview`/`evaluateBingbuQualityGate` 等 @/ 值导入，
无法在 `node --experimental-strip-types` 下运行，故归入 **hooks.derive.itest.ts**（test:node 覆盖）。
hooks.nodetest.ts 只测无 @/ 值导入的 selectCandidates + passesThreshold。

## 阈值设计

passesThreshold = 命中 BINGBU_KEYWORDS 中至少 1 个关键词（克制阈值，与 selectCandidates 门一致）。
与户部不同（户部需金额 ≥ 50 万），兵部 v1 阶段采用"有销售语义即够格"的宽松门，
待真实数据积累后可收紧（如命中 ≥ 2 个关键词或含特定高优先词）。

## DeptId 说明

types.ts 中 DeptId 已含 'bingbu'，无需修改。
