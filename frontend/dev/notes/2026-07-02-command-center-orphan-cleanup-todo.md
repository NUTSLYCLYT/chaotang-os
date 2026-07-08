# command-center/page.tsx 遗留孤儿函数清理(待办)

合并 origin/master 时发现:origin 自己重构 command-center 页面(切到 ShangshufangLayoutShell)
时留下了一批调用点已改、但函数定义没删的死代码。合并中已清理3个最初发现的
(StageTitle/VerdictHandoffBanner/CommandCenterPanels),清理 CommandCenterPanels 时
又暴露出它内部依赖的一批也变成孤儿:

- ProgressTeamsPanel(1381行起)
- ConflictResolutionPanel(1457行起)
- ChancellorLoopPanel(1603行起)
- BossDecisionPanel(1685行起)
- CoreMemoScroll(2102行起)
- LeftSidePanel(2254行起)
- RightSidePanel(2352行起)
- ExecutionPathContent 需确认(两个调用点都在上述死函数内,可能连带变孤儿)

**清理前置**: 逐个用 `grep -n "<函数名"` 确认 JSX 调用点为0 再删,注意交叉依赖
(如 ExecutionPathContent 被多个死函数各引用一次,删除顺序有讲究)。
清理后须过双门: `pnpm exec tsc --noEmit` + `NEXT_PUBLIC_API_MODE=real pnpm build`。

不影响功能(两道门当前已绿),纯代码卫生债务,按铁律3该清但不阻塞上线。
