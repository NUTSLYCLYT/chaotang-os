# READY_FOR_REVIEW 独立验收清单

验收日期：2026-07-14。结论只表示代码/契约是否可保留在 ext，不等于生产 READY；旧记录中的 `PROD`、4/4、浏览器截图均是历史快照，当前发布事实以 `prod:doctor=STOP` 为准。

| Change | 已合入提交 | 当前证据 | 唯一结论 | 边界 / 后续 |
| --- | --- | --- | --- | --- |
| `fix-release-harness-launch-routes-20260713` | `559983f` | 联合发布路由测试通过 | 验收合入 | 页面矩阵契约，不代表当前浏览器发布通过 |
| `fix-production-runtime-identity-20260713` | `55e128a` | identity 3/3；foreign 3050 当前 STOP | 验收合入 | STOP 正是正确行为 |
| `fix-release-harness-true-chain-default-20260713` | `e2aba40` | 联合测试确认只允许显式 skip | 验收合入 | 不继承历史 PROD |
| `fix-shangshufang-im-canonical-path-20260713` | `af2e693` | canonical path 专项通过 | 验收合入 | 只认可 URL 契约 |
| `fix-launch-link-canonicalization-20260713` | `e0e11d8` | link 专项 2/2 | 验收合入 | 下一 release 重跑浏览器导航 |
| `fix-release-harness-retired-route-20260713` | `b9d3b80` | 资源入口/退役路径联合测试通过 | 验收合入 | 历史资源阁截图不计当前证据 |
| `fix-true-chain-health-real-evidence-20260713` | `2087d48` | 后端专项 3/3 | 验收合入 | 只认可只读评估器；当前仍 STOP |
| `fix-shiguan-honest-empty-drawer-20260713` | `acd8f7a` | 诚信专项 1/1 | 验收合入 | 下一 release 重跑浏览器 |
| `fix-mobile-decree-input-overflow-20260713` | `19f21db` | 响应式约束专项 1/1 | 验收合入 | 下一 release 重新生成 390px 截图/trace |
| `fix-release-harness-real-session-20260713` | `e6f2dce` | 显式 token 注入联合测试通过 | 验收合入 | 尚无外部 trust anchor 下的真实 release |
| `backend/harness/changes/s3-lease-attestation-gate-20260713` | `224367e` | lease 核心 9/9；backend closeout 8/9 | 退回修正 | 补 adapter 专项、修复依赖仓库形状的 fixture，再联合验证 |

统计：验收合入 10，退回修正 1，明确废弃 0，未决 0。
