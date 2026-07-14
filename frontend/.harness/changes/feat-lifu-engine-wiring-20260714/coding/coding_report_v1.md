# 实现报告 v1

## 2026-07-14 对抗复审修复轮

- 六部 hub 保留卡片主体选中蜂群面板的行为，并把标志区既有 `Link` 的目标改为从 `CHAOTANG_V1_LIUBU` 按 canonical department 查得的工作台 `href`；礼部现在真实渲染 `/liubu/libu_rites`，其余五部同时由同一事实源供给导航。
- adapter 从后端 `src/lipu_compliance_report.py` 核实并枚举 `DETERMINISTIC_GATE / LLM_ONLY / ENGINE_BACKED`，所有报告及软意见 `source_label` 均经该集合校验；返回值改为逐字段构造，移除 `as unknown as LipuComplianceReport` 双重断言。
- adapter 使用项目既有 `AbortSignal.timeout` 惯例，默认 8 秒，并用 abort race 保证即使自定义 transport 永不 settle 也会进入诚实 `FALLBACK`。
- 成功 nodetest 新增 `result.report.source_label` 断言；另新增未知 source label、永不返回 transport 和六部页面静态挂载回归测试。
- 产品文档明确当前 UI 不提交 `project_id`，xhs 区展示后端 `missing_coverage` 未关联占位；工作台文案改为“红黄绿黑四灯”。

### TDD 证据

- RED：未知 `source_label` 实际返回 `success`；永不返回 transport 触发 100ms 测试看门狗；挂载后的六部 hub 不含 `href="/liubu/libu_rites"`。
- GREEN：完整礼部 nodetest 共 7 个用例通过（adapter 5、roster 1、六部 hub 页面挂载 1）。

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
- 未修改 backend、dadian、其它部门工作台、package/lockfile 或 `scripts/lib/**`；六部 hub 的共享卡片导航修复覆盖既有六部入口。
- 未创建根级 `.harness/changes` 记录；继续使用前端 11 阶段事实源。
- 未 push，未触碰 dev/ext refs。
