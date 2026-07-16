# P7 干对账预演（Grove 建议，2026-07-17 01:3x 执行，不构成收官宣布）

> 目的：按 DONE 五门现在跑一次干核，提前暴露收官日会卡的证据缺口。
> 全部数字为审查者实测（命令戳口径）。

## 五门现状

### 门 1：P0–P9 全 GO 合入 —— 预演态：6/10

✅ P0（×2）、P1、P2（+回归+residual）、P3、P4、P4.5、D6 闸。
⏳ P5 进行中；P6/P7/P8 未开工；P9 部分被并行会话承接（**残段核销未做**——
c669c8a 吃掉多少、剩多少无对账文件，收官必卡，建议 P6 前补一页 P9 核销单）。

### 门 2：零未闭环验证残留 —— 预演态：4 类残留在册

| 残留 | 位置 | 收官处置路径 |
| --- | --- | --- |
| NOT_RUN_SAFETY_BLOCKED（P0 登记） | 2 份 ci_summary | P2 回归包已带指纹跑全量→**可核销但无核销记录**——需一页正式解除文书引 af064fb 证据 |
| 后端 7 失败 | 台账 OPEN×7 | 3 个新立 change+P6/P7 步骤，均未动工 |
| 前端 7 基线失败 | 台账 OPEN×7 | P6 子步骤 a/b |
| lint MISSING+chancellor_chat deselect | P0 baseline | 前者待用户裁决；后者收官显式 deferred |

### 门 3：P7 KPI 三项 —— 预演态：1 绿 1 可测 1 有洞

- **LOC**：当前 241709 vs P0 基线 238894 = **+2815**——目标"净负增长"当前
  未达。归因待分：P4.5/P3 新增（investment：execution_state 410、
  archive_outcomes 198、守门测试群）vs 待删死码（P6 的 swarm_orchestrator
  ~600+、三省族、engines 移 attic 后 LOC 是否计入）。**P6 死码归档后重测；
  若仍正，收官按"归因表"呈报而非硬凑负数——诚实优先。**
- 事实源计数：部门码后端 1+前端 1 ✓（P1）；前端状态机 0 ✓（P4）；可机器复测。
- **流量曲线：有洞**——canonical 计数器 P2 起在位，但 legacy 端点归零曲线
  需要观测窗口数据；daemon 已 gate（bf05102），**"gate 后零调用"的读数
  从未导出成文件**。收官前需一次计数快照落盘。

### 门 4：蒸馏 golden cases 入 CI —— 预演态：绿

test_frontend_second_brain_distillation 4 passed 且被收录；xfail=0
（未用 xfail 形态，直接可跑）——无 deferred 悬挂。✅

### 门 5：deferred 清单完整映射 —— 预演态：散装

deferred 项现散在：P3 deferred-boundaries（throne/物理拆窗口）、红灯台账、
P4 review（部级前端脑 Wave 3）、census-review（CEN-01..05 待修）、
P4.5 各步（quarantine 回填 FCV1-002 等）。**收官需一页汇总表**（来源引用即可，
不重写内容），否则终审"无遗漏差集"核不动。

## 预演结论

收官日会卡的四件事，现在开始准备：
1. **P9 残段核销单**（并行会话承接对账）；
2. **NOT_RUN_SAFETY_BLOCKED 正式解除文书**（证据已在，缺文书）；
3. **legacy 计数快照导出**（gate 后零调用读数落盘）；
4. **deferred 汇总页**。
LOC 正增长按归因表诚实呈报，不硬凑。
