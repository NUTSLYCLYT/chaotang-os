# 登基门槛原型 · 三根桩(scaffold)

> 分支 `feat/coronation-threshold`(独立 worktree,不撞主线并发 agent)。
> 规格:`docs/coronation/CORONATION_SPEC.md` · 总纲:`docs/coronation/MASTER_PLAN.md`

## 三根桩(已立)

1. **真状态机** — `lib/coronation-machine.ts`
   「下旨→满朝回奏」的状态机。成功/慢/失败/谏言**都是真实分支**。
   demo 时间线在 `lib/coronation-scenario.ts`(脚本化但**状态为真**:含 1 次谏官出列 + 1 次诚实"慢")。
   接真后端时:把时间线换成真实 agent 事件流,状态分支不变;每个 MinisterState 由一个真 agent 状态驱动(§2 保真率=1)。

2. **假数据诚实层** — `lib/provenance.ts` + `components/ProvenanceBadge.tsx`
   `real | demo | fallback | unavailable`,**帝金锁给 real**,假数据用专属非帝金色 + 角标。
   接上书房已落地的 `sourceMode`;稳定后提升为全局契约 `lib/contracts/provenance.ts`。

3. **成本三问 CI 门** — `scripts/cost-three-questions-gate.mjs`
   `node scripts/cost-three-questions-gate.mjs` —— 当前**故意红**,逼出三个硬上限(花多少钱/跑什么命令/看谁数据)。Phase 3 焊死后转绿。

## 看原型

挂一个路由消费 `CoronationPrototype`(如 `app/(dashboard)/coronation/page.tsx`),`pnpm dev` 访问。
当前是**骨架**:状态机 + 诚实标记跑通,视觉占位,封神细节(镜头/动效/峰终具体结果)待迭代。

## 下一步(按 MASTER_PLAN Phase 1)
- 腿 A:把骨架的占位升级成"那一秒"的真封神(镜头、群臣亮灯、回奏丝滑 <1.5s、峰终给具体结果)。
- 腿 B:200 行最小链路接真后端,看第一张真实 token 账单;填 `cost-limits.json` 让 CI 门转绿。
- 真人测试:5 个小商户怼脸,盯眼睛。
