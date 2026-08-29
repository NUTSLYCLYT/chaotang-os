# Tenant Principal V1 — Readiness Compatibility Prerequisite

任务 ID：`TENANT-PRINCIPAL-V1-READINESS-COMPATIBILITY-PREREQUISITE-20260829`

冻结基线：`63195b81871c0c32c6ace3f05138b8caeba80afe`

冻结基线 tree：`33e24f7bdf8d2173826d7e4e5a19be9221621d74`

状态：`OWNER_AUTHORIZED / GOVERNANCE_ONLY / READY_TO_MATERIALIZE`

## 问题

已批准的 Tenant Principal V1 exact14 必须修改
`backend/app/api/auth.py` 与 `backend/app/auth/models.py`。这两个文件属于六部 Runtime
65 文件内容边界，因此合法产品字节会把 runtime fingerprint 从已接受状态推进到
`sha256:a6d109de75e877620a89241a4dcabcc716e1a5a1a18a024c9a3cb73e578de80c`。

当前根 Harness 只接受四组历史 ordered pair，因而确定性返回：

`六部 Runtime 就绪证据未绑定当前实现、服务端解析器或独立复审`

不能从产品 authority 修改 `scripts/check_harness.mjs`，因为它是受保护治理路径。本任务因此是
独立、前置、最小的 protected-path compatibility successor。

## 唯一候选范围

1. `backend/tests/test_six_ministry_readiness_report.py`
2. `scripts/check_harness.mjs`

候选只允许：

- 在 Node 与 Python 两个 validator 中原子追加同一个完整 ordered pair；
- 保留现有四组 pair 的字节、顺序和语义；
- 将精确 pair 数从 4 更新为 5；
- 增加正向接受与未知、单边、混搭失败关闭证据。

新增 pair：

```json
[
  "sha256:a6d109de75e877620a89241a4dcabcc716e1a5a1a18a024c9a3cb73e578de80c",
  "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924"
]
```

## 不变边界

- historical reviewed fingerprint 保持
  `sha256:a6c2de2ca7f15069a6d997ce2cccb9498ddd4dd1269d539c192993e85a265190`；
- historical file count 保持 69；
- runtime-content file count 保持 65；
- exclusions 保持精确四条；
- successor-content paths 保持精确两条；
- `docs/migrations/2026-08-14-six-ministry-runtime-readiness.json` 不改；
- 不修改 authority、CI、产品 API、数据库、Tenant 代码或发布配置。

## Owner 授权

Owner 于 2026-08-29 明确授权：

> 创建并快进推送三文件 readiness compatibility prerequisite 治理包；随后创建、提交、验证并
> 快进推送两文件受保护前置候选；再重签 Tenant Principal V1 exact14 successor approval；
> 最终 Tenant 产品 candidate 只保留本地，不推送。

该授权不包含 force push、merge commit、部署或最终 Tenant 产品 candidate push。

## 验收

- [x] 基线与远端 `origin/ext-dev` 精确一致。
- [x] 新 tuple 来自已完成实现的 65 路径机械指纹与未变 successor 指纹。
- [x] candidate scope 精确两文件。
- [ ] 两 validator 同提交、同 tuple、现有 pair 集合 `+1/-0`。
- [ ] 根 Harness、self-test、readiness Python 测试、后端全测、authority 回归全部通过。
- [ ] 独立 code/security review 无未关闭 P0–P2。
- [ ] 两文件候选普通 fast-forward 推送后，再签发 Tenant exact14 successor approval。

## 失败关闭

远端漂移、第三候选路径、现有 pair 删除/替换/重排、指纹计算不一致、任一测试失败或复审发现
P0–P2，均立即 STOP。旧 Tenant approval 与旧本地 candidate 只能作为 byte donor，不得继续消费。
