# 变更摘要：chore-single-fact-c0a-baseline-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | chore-single-fact-c0a-baseline-20260714 |
| 类型 | chore |
| 状态 | VERIFIED_COMPLETE |
| Owner | Project Agent |
| 创建日期 | 20260714 |

## 范围

- 主线：唯一事实源融合 C0A——clean base 与版本化业务入口清单。
- 文件：capability inventory、治理说明、静态 Harness 测试、本 change record。
- 不修改：业务 router、数据库、worker、前端页面、部署、运行进程或生产数据。

## 结果

- 在独立 worktree `/home/ubuntu/Projects/chaotang-os-c0a`、分支 `chore/single-fact-c0a-20260714` 上固定父提交 `417a90eea010598b36bffc46eed01d62e0a9f049`、tree `046073709b3114a70d8fdcbb44d771de51853a1d`。
- capability inventory 从 v1 升到 v2，新增 12 个 BUSINESS 事实面：1 `CANONICAL`、7 `MIGRATE_REQUIRED`、4 `DISCOVERED`。
- 唯一 canonical business terminal writer 固定为 `canonical-shangshufang-decision-loop`。
- 所有非 canonical BUSINESS 入口在缺少 runtime telemetry 时保持 `invocations=null` 且不得进入 `DELETE_CANDIDATE`。
- TDD 证据：新增测试先因缺少 canonical business entry 失败（1 failed/2 passed），补清单后 3/3 通过。

## 后续阻断

- C0B：尚未建立覆盖 HTTP、worker、scheduler、admin/replay、DB/file/object-store/knowledge 的运行遥测。
- C0C：没有 owner 批准的观察窗口和调用数据。
- C0D：4 个 `DISCOVERED` 入口族尚未裁决为 migrate/read-only/retire。
- 外部 required check/attestation authority 未由本 change 配置，不能把本地证据解释为发布授权。
