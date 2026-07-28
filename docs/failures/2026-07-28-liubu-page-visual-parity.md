# 六部页面视觉迁移与 dev 基准不一致

## Summary

用户发现当前“六部总览”、各部级页和各司级页与 `dev` 分支的对应页面不一致。该问题影响从六部入口进入部门和属司时的页面连续性与既有视觉认知。

## Root Cause

当前前端以 `frontend/src/features/ministries-visual/` 下的 `MinistryOverviewScene`、`DepartmentScene` 和 `OfficeScene` 重建了 `/liubu` 路由；`dev` 则由已移除的 `features/zhuangyuan`、`features/departments` 和 `features/bureaus` 页面组件渲染。迁移验收只约束现行业务基线与当前页面结构，没有为三层页面建立逐项的 `dev` 视觉基准比对，因此重建后的布局、组件与交互未被识别为偏差。

## Prevention

把六部总览、部级页和司级页作为一个视觉迁移单元，先由用户确认哪些 `dev` 视觉和交互属于迁移范围，再为每一层建立可执行的视觉/路由验收基准。基准不得迁入 `dev` 的旧 API、模拟数据或业务流，必须继续遵守 ADR 0028。

## Detection

在前端变更前后运行现有的页面结构测试，并补充覆盖三层 `/liubu` 路由的视觉基准检查；人工验收时在同一视口并排核对当前页与 `dev` 的截图。`node scripts/check_harness.mjs` 仅校验仓库治理约束，不能替代视觉一致性检查。

## Evidence

- `dev:frontend/src/app/(dashboard)/liubu/page.tsx` 使用 `DomainCard` 与 `ThreeAxisOfficeRails`；当前入口为 `frontend/src/features/ministries-visual/MinistryOverviewScene.tsx`。
- `dev:frontend/src/app/(dashboard)/liubu/[code]/page.tsx` 和 `dev:frontend/src/app/(dashboard)/liubu/[code]/[office]/page.tsx` 分别转向已移除的部门/司级页面组件；当前对应实现为 `frontend/src/features/ministries-visual/DepartmentScene.tsx` 和 `frontend/src/features/ministries-visual/OfficeScene.tsx`。
- [ADR 0028](../decisions/0028-decree-evidence-flow-governance-baseline.md) 规定 `dev` 的旧 API、模拟数据和任务模型不得作为当前业务事实。
