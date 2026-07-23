# 变更摘要：feat-r0-w05-evidence-rework-implementation-20260723-20260723

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | feat-r0-w05-evidence-rework-implementation-20260723-20260723 |
| 类型 | feat |
| 状态 | IN_PROGRESS_SLICE_4A_GREEN |
| Owner | Backend / Canonical Runtime |
| 创建日期 | 20260723 |

## 范围

- 主线：R0-W05 evidence-bound rework，纵切 1–4A。
- 文件：公共裁决 API、精确 content hash 门、三个 W05 v1 契约、canonical outbox
  generation identity、Alembic 019 及测试。
- 验证：纵切 4A 先证明同一补证网络重试会撞重复写入，再把 exact prior memorial +
  补证要求绑定为一个可复用的 rework generation。
