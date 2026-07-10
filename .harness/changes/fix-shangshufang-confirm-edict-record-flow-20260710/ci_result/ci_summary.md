# CI 摘要：fix-shangshufang-confirm-edict-record-flow-20260710

## 命令

- `cd backend; python -m pytest -q tests/test_shangshufang_loop_api.py`
- `cd frontend; npx tsc --noEmit`
- `cd frontend; npx tsx --test src/core/courtos/persistence/courtos-mvp-api.nodetest.ts`
- 本地运行时验证：`POST /api/shangshufang/draft-edict` 后接 `POST /api/shangshufang/confirm-edict`

## 结果

- 后端测试：13 passed, 1 warning。
- 前端 TypeScript：通过。
- 前端 node 契约测试：3 passed。
- 本地 8081 后端已重启，健康检查通过。
- 运行时链路：`confirm-edict` 返回 `status=edict_recorded`、`decree_record.status=edict_recorded`，且不返回 `swarm_run`。
