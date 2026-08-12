# 规格说明：fix-professional-agent-k0-root-registration-20260810

## 背景

K0 内容候选已在 `ac815b52837be8b486fd139404222c1ba95fd074` 获得独立 `GO_FOR_CANDIDATE`，但根总清单与 doctor 尚未强制索引。若不登记，删除全部矩阵文件也不会被根 doctor 发现。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | K0 candidate 12/12，93 pytest，独立复核 GO | 前序 change review/CI | Project Owner | 否 |
| 已确认事实 | 根 manifest/doctor 当前未登记 K0 | 删除/缺失登记负向审查 | Project Owner | 是 |
| 已确认事实 | 修改 project manifest 会令旧 exact-H authority 暂时 STOP | V2 pinned-tree check | Authority Owner | 是，直至新 exact-H 推广 |

## 数据流与调用链

K0 candidate → 根 manifest 精确登记 → root doctor 必需文件与 CLI 委派 → exact-H review/authority → Gitee 推广。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `professionalAgentAssets` | `.harness/manifest/project-harness.json` | root doctor / 项目 Owner | exact object validator + Node test |
| K0 matrix | 前序候选 | root doctor | CLI 必须 PASS，否则 doctor FAIL |

## 范围

仅根登记、doctor、清单 wiki、测试和本 change；不改产品 runtime/API/data/frontend。

## 非目标

不修改旧 K0 donor，不更改 99 frozen refs，不启用生产，不绕过 exact-H authority。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 登记缺失/漂移 | Node test 与 doctor 失败 | registration negative test |
| 矩阵文件缺失或无效 | root doctor 失败 | delegated matrix CLI |
| 未完成 exact-H 推广 | authority STOP，禁止合并 | v2 authorize |

## 风险与回滚边界

主要风险是为了让 doctor 变绿而削弱旧 authority。控制方式是允许候选阶段 authority 暂时 STOP，完成 exact-H 审批后再推广；不修改 resolver 规则。回滚为单提交 revert 根登记。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-08-10
- 批准范围：继续完成 K0 根登记与 EXT 单主线收敛。
- 明确未批准：绕过 authority、生产启用、删除旧资产或整包合并旧分支。

## 验收标准

1. 根 manifest 精确登记 K0。
2. doctor 缺失矩阵或登记漂移时失败。
3. matrix test/CLI 通过。
4. exact-H 独立复核与 authority 完成后才允许 Gitee 合入。

## 验证计划

- `node --test scripts/professional-agent-matrix.nodetest.mjs`
- `node scripts/professional-agent-matrix.mjs --check`
- `node scripts/harness-doctor.mjs`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
