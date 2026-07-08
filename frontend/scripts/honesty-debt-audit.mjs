#!/usr/bin/env node
/**
 * 诚实债审计 · 已退役(2026-06-28)
 *
 * 原审计(2026-06-22 张小龙建议)扫 src/app/(dashboard)/manor-dept/[deptCode] 下的 *-client.tsx,
 * 找"渲染 SEED_/MOCK_/getDeptSeed 假数据却没挂 ConfidenceSourceBadge"的部门卡。
 *
 * 退役原因(证据驱动):
 *   1. manor-dept 旧部门工位目录已无路由(无 page.tsx),其 client 文件随架构迁移退役至 dev/_attic;
 *      现役部门页在 src/app/(dashboard)/departments/[code] → src/features/departments/*。
 *   2. confidence-source-badge.tsx 组件已不存在、全仓 0 引用。
 *   3. 旧假数据 idiom(SEED_/getDeptSeed)在现役 src/features 218 个组件里仅 1 处命中、且已标来源。
 *      → 简单重指到 features = 0 债 = 假绿(正则匹配不到新写法),违"禁假绿"铁律,故不重指。
 *
 * 诚实债现由数据边界兜底,不再做部门卡级文本扫描:
 *   - `pnpm guard:realdata`(gate:daily 内 REALDATA_STRICT=1·0漂移阻断门)——禁假数据冒充 LIVE。
 *   - sourceLabel / reality-state(src/lib/reality/reality-state.ts)——所有面向用户结果必带来源。
 *
 * 若未来要恢复"部门卡级"专项诚实检查,应围绕 sourceLabel 可见性重新设计
 *   (扫消费 DEMO/FALLBACK 却没渲染来源的用户面组件),而非复活旧 idiom 扫描。
 * 台账见 dev/notes/surface-cleanup-map.md。
 */
console.log('ℹ️  guard:honesty 已退役(2026-06-28)。诚实债改由 guard:realdata(0漂移) + sourceLabel 兜底。');
console.log('   原因:所审旧架构(manor-dept 客户端 + confidence-source-badge)已随迁移消失,重指会造假绿。');
console.log('   详见 scripts/honesty-debt-audit.mjs 头注 与 dev/notes/surface-cleanup-map.md。');
process.exit(0);
