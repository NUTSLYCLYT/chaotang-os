# 军机处理顺 · 拆分方案（2026-06-29 · 先审后改·铁律4）

> 目标:把军机处从"什么都塞的仪表盘"收敛回"御前合议厅"。**本方案不动代码**,审过再执行。

## 0. 现状诊断
`src/app/(dashboard)/command-center/page.tsx` = **2580 行**,塞了两个无关的脑子:
- **主使命·会审/奏折**(39 处):圣旨→六部会审→奏折→执行路径。这是军机处该有的。
- **scope creep·部门建设台账**(56 处·比主使命还重):build-ledger / 工部建设案 / DEPARTMENT_BUILD_TASKS——这是**产品开发进度看板**,不是御前合议。
- 违铁律5(版面预算:一版面一脑子)+ 铁律6(维度混淆:合议是"决策维度",建设台账是"开发运维维度")。

## 1. 目标态:军机处只剩一条线
```
圣旨原文 → 六部会审(灯号+缺证+风险) → 御史台审计 → 最终奏折 → 圣裁出口
```
进军机处的人只为一件事:**看会审结论、拍板**。不为看"工部页面建到第几步"。

## 2. 剥离清单(要搬走的 build-ledger 块)
| 块 | 行(约) | 现状 | 去向 |
|---|---|---|---|
| build-ledger imports | 40-53 | `BUILD_STATUS_LABEL/assessBuildLedgerEntry/readBuildLedger/DEPARTMENT_BUILD_TASKS` 等 | 随组件迁走 |
| **工部建设案草稿 panel** | 247-330 | `Gongbu Build Draft · 工部建设案`(buildTask 卡) | → 工部页(`/departments/works` 或工部办公厅) |
| **BuildLedgerDetailDrawer** | 393+ | 建设台账详情抽屉 | → 运维/operating-loop 面 |
| buildLedger state + 订阅 | 1464 + subscribeBuildLedger | 页面级 build 状态机 | 随之迁走 |
| 工部 build-case 流转 | transitionBuildCase 调用处 | 建设案状态推进 | → 工部 |

**保留不动**(军机处主使命):大臣会审 panel(862)、FinalMemorialPanel 最终奏折(1013)、右侧面板"大臣会审+最终奏折"(1707)、御史台审计、BattleStream SSE 作战流、圣旨原文。

## 3. 去向决策(产品取舍·需你拍)
build-ledger/部门建设台账该落哪?三个候选:
- **A. 工部**(推荐):"建设"本就是工部的活;工部建设案 panel 天然属工部办公厅。
- B. 庄园`/manors`:AGENTS.md §0.0.1 定庄园=蜂群执行中心,建设进度可视为执行态。
- C. 独立 ops 面:operating-loop 已有 lib,可起一个"建设台账"运维页。
代码已在 `src/features/operating-loop/lib/`,搬到 A/B/C 都是**移动渲染块 + 改一处导航入口**,不重写逻辑。

## 4. 风险 + 回归断言(铁律4·高危改大文件)
- **风险**:2580 行大文件,build-ledger 与会审可能共享 state/工具函数(如 taskId、mode、CommandPanel)——剥离时勿误删共享件。
- **双门**(铁律4):① 开独立 code-reviewer 子 agent 读真 diff 找盲点;② 回归断言——「军机处主视图 render 后,DOM 不含 build-ledger 测试 id(如 `工部建设案`)」+「会审/奏折 panel 仍在」。
- **双类型门**:root `tsc` + `next build` 跑通(剥离后无断 import)。

## 5. 分步执行(剥离后才动刀)
1. 新建/确定 build-ledger 落点组件(A/B/C 选定)。
2. 把 247-330 + 393+ + state/订阅/build-case 块**整体 git mv 思路迁移**到落点,改导航入口。
3. 军机处删除迁走块 + 相关 import,核心会审流不动。
4. 跑双类型门 + 回归断言 + 独立会审。
5. 净行数应大幅下降(2580 → 估 ~1600,砍掉 build-ledger 约 900+ 行相关)。

## 6. 预期收益
军机处回归"御前合议厅":一眼看清"该不该接这单/缺什么证/谁反对/最终奏折"。build-ledger 回到它该在的地方(工部),各管各的脑子——铁律5/6 复位。
