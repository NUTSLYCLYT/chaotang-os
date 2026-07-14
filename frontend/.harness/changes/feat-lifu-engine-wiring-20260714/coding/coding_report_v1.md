# 实现报告 v1

## 改动

- 新增 `src/features/lifu/api/lifu-compliance.ts`：定义请求结果类型、响应边界校验、canonical path 和 `FALLBACK` 判别联合；默认 transport 使用 authenticated `backendFetch`。
- 新增 `src/features/lifu/api/lifu-compliance.nodetest.ts`：覆盖成功解析、源标签保留、网络不可达和非 2xx 降级。
- 更新 `src/features/lifu/components/commitment-gate-tab.tsx`：增加任务输入、运行态、硬闸 VerdictCard、两路软意见卡、缺失覆盖与 FALLBACK 错误卡。
- 更新 `src/features/lifu/lib/lifu-roster.ts` 及测试：只有承诺门保留 `engine:true`，真实引擎统计为 `1/8`。
- 更新 `docs/product/PROJECT_PRODUCT.md` 第 7.1 节：以真实 endpoint、硬闸及 source label 边界取代“不承诺运行能力”的旧表述。

## 取舍

- UI 不提供虚构 project ID；第三源未关联时直接展示后端 `missing_coverage`，避免把“未采集”写成“无风险”。
- adapter 返回判别联合而不是 throw 给 UI；失败分支没有 `report/light` 字段，从类型层阻止错误态被渲染为有效裁决。
- 边界校验要求 `deterministic_gated===true`、有效灯色、核查项、三源意见与缺失覆盖形状；形状漂移与网络失败使用同一诚实 FALLBACK 语义。
- 保留原有本地报价与防失真模块，但不再通过 roster `engine` 旗标把它们描述成后端能力。

## 边界

- 未新增 `src/app/api/**` 或 `route.*`。
- 未修改 backend、dadian、其它部门、package/lockfile 或 `scripts/lib/**`。
- 未 push，未触碰 dev/ext refs。
