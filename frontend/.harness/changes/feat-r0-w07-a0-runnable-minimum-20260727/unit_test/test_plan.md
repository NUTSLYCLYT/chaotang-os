# 单测计划

## 覆盖范围

- generated read model parser、unknown action/blocker fail-closed。
- server action absence、PARTIAL honesty、archive receipt requirement。
- exact receipt 到既有 Shiguan detail contract 的映射。
- 上书房和史馆既有 focused regression。

## 命令

- `pnpm exec tsx --test <13 focused nodetest files>`
- `pnpm exec tsc --noEmit`

## 未覆盖风险

- Checkpoint B 并发/CAS、PARTIAL refresh resume 和真实客户合同。
