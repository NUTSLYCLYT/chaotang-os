# 军机处筛选零结果退出主舞台

## Summary

当用户筛选后没有匹配案卷时，军机处退出三栏主舞台并显示整页“暂无匹配案卷”卡片，破坏了已确认的空数据模块结构。

## Root Cause

场景组件将“初始案卷为空”和“筛选后的可见案卷为空”拆成两个渲染分支。前者使用完整主舞台，后者使用遗留的整页空卡，导致同样的零数据状态呈现不一致。

## Prevention

军机处的成功读取结果只要可见案卷为零，就使用同一个完整三栏空态。加载与读取错误继续走专用状态分支，不再为筛选零结果维护另一套页面结构。

## Detection

运行 `node --test frontend/src/features/junjichu-visual/JunjichuScene.test.ts`。测试会拒绝遗留的“暂无匹配案卷”文案，并断言空态主舞台和共享卷轴仍被渲染。

## Evidence

- [军机场景](../../frontend/src/features/junjichu-visual/JunjichuScene.tsx) 以统一 `cases.length === 0` 分支呈现完整空态。
- [场景回归测试](../../frontend/src/features/junjichu-visual/JunjichuScene.test.ts) 锁定没有独立筛选空卡。
- [业务流基线](../decisions/0028-decree-evidence-flow-governance-baseline.md) 约束军机处为只读会审呈现，不补造业务数据。
