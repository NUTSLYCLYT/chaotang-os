# 朝堂 Console Feature 目录

## 作用
朝堂 Console 产品的所有新代码入口。**只在这个目录内改**，不碰 V2 已有的 overview / governance / manors / scribe 等页面。

## 目录结构
```
court-console/
├── pages/       ← 5 大模块的页面实现（由 app/(dashboard)/court-console/*/page.tsx 引用）
├── components/  ← 本 feature 专用组件（PetitionScroll / StampDrop / ReplayControls ...）
├── lib/         ← 业务逻辑、从 Harness 移植的纯 TS 模型
├── types/       ← feature 专用类型
```

## 五大模块与路由

| 模块 | 路由 | 页面文件 | 状态 |
|---|---|---|---|
| 奏折大厅 (Atrium) | `/court-console/atrium` | `pages/atrium.tsx` | ✅ 100% — 双栏历史+卷轴+打字机+烟花 |
| 朝堂大殿 (Palace) | `/court-console/palace` | `pages/palace.tsx` | ✅ 100% — KPI BFF + 活跃榜 + 六部 + 庄园 |
| 庄园巡按 (Manors) | `/court-console/court-manors` | `pages/manors.tsx` | ✅ 100% — 8 庄园列表 + 详情页 + HexSwarm |
| 刑部回档 (Audit) | `/court-console/audit` | `pages/audit.tsx` | ✅ 100% — 搜索/时间轴/1x-5x-10x 回放 |
| 朝报 (Gazette) | `/court-console/gazette` | `pages/gazette.tsx` | ✅ 100% — 竖排公文/日期导航/PDF 导出 |

> 路由 slug 用 `court-manors` 避开 V2 已存在的 `/manors` 避免混淆。

## 开发规约
见 worktree 根 `CLAUDE.md` + `docs/court-console/20-ARCHITECTURE.md`
