# 规格说明：fix-p8-p9-frontend-residual-cleanup-20260718

## 背景

P12 已把 P8 国力薄纵切与 P9 翰林最小读模型合入远端，但原 P9 分支中删除
`hanlin-home-mock.ts` 的死码清理和一条尚书房 canonical API 路径回归测试没有随
整合包进入。P0 重打包独立审查允许这两个真实前端残余拆为 Packet B，禁止恢复
其余旧 packet 证据。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | `hanlin-home-mock.ts` 在删除前存在，但 `frontend/src` 无任何引用 | `rg -n "hanlin-home-mock" frontend/src` 零命中 | Codex 隔离 worktree | 否 |
| 已确认事实 | 尚书房生产调用使用 canonical completion endpoint | `ShangshufangPage.tsx:3256` | 源码直读 + 新 node test | 否 |
| 已确认事实 | 清理后相关测试、类型与 REAL build 通过 | 8 tests、tsc、Next build | 本 change CI 摘要 | 否 |
| 未知问题 | P8/P9 方案总体验收剩余项 | P12 状态仍为 VERIFIED_PARTIAL | 后续独立 packet | 是，阻断总体验收，不阻断本清理包 |

## 数据流与调用链

翰林页面 → 当前 authenticated API/read-model（本包只移除不可达 mock 文件）；
尚书房页面 → `backendFetch('/api/shangshufang/finance-intel-loop/complete')` → 明确后端 API。
新增 node test 读取生产页面源码，阻止旧 `/api/court/shangshufang/...` 路径回流。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| 翰林读模型来源 | `frontend/src/features/hanlin/lib/{api,read-model}.ts` 与后端 API | 翰林页面 | 现有 7 个相关 node tests + type/build |
| 尚书房 finance completion 路径 | `ShangshufangPage.tsx` 的 `backendFetch` 调用 | 浏览器页面 | 新路径回归测试 + build |

## 范围

- 删除 `frontend/src/features/hanlin/lib/hanlin-home-mock.ts`。
- 新增 `frontend/src/features/shangshufang/finance-intel-loop-path.nodetest.ts`。
- 新增唯一 root change `fix-p8-p9-frontend-residual-cleanup-20260718`。

## 非目标

- 不修改任何生产页面或运行逻辑。
- 不新增前端 BFF、route handler、adapter 或 API alias。
- 不修改 UI、文案、视觉、交互或 source label。
- 不恢复旧 P8/P9 change 证据，不处理 docs-only 归档材料。
- 不宣称 P8/P9 `VERIFIED_COMPLETE`。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| mock 仍有动态或别名引用 | 删除应停止 | `rg`、TypeScript、production build |
| canonical API 路径回退 | node test 必须失败 | 正向匹配 canonical、反向拒绝旧 court-prefixed 路径 |
| 构建缺少 API mode | fail closed，不允许默认 mock build | 首次 build exit 1；显式 `NEXT_PUBLIC_API_MODE=real` 后通过 |
| 删除无用户可见行为 | 不要求伪造浏览器截图 | 源码零引用 + type/build 证据 |

## 风险与回滚边界

主要风险是误删仍可达模块或路径测试只锁字符串、不锁真实生产调用。通过全仓引用
扫描、相关 Hanlin tests、TypeScript、production build 和直接读取
`ShangshufangPage.tsx` 控制。回滚只需恢复 mock 文件并移除新增测试/change；无
数据库、API 或运行态迁移。

## 计划确认记录

- 批准人：项目业主
- 批准日期：2026-07-18
- 批准范围：Packet A 发布后，基于新远端顺序实施 Packet B，再独立复审与 D6 发布。
- 明确未批准：夹带其他本地提交、恢复旧 packet、改生产 UI/API 或未经复审直接推送。

## 验收标准

1. mock 删除前后生产源码引用均为零，删除后类型与 build 通过。
2. 新路径测试通过并拒绝旧 court-prefixed endpoint。
3. Hanlin API/read-model 相关测试与新增路径测试共 8 passed。
4. 前端/根 doctor 与 `git diff --check` 通过。
5. 精确 diff 只含声明范围；Claude GO 前不合 ext。

## 验证计划

引用扫描 → 最小删除/测试 → 相关 node tests → TypeScript → REAL build →
前端/根 doctor → diff/边界复核。无用户可见行为变化，不运行浏览器 E2E。
