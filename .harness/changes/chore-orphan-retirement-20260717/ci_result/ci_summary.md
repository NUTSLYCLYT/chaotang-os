# CI 摘要：chore-orphan-retirement-20260717

验证日期：2026-07-17；工作树：`task/p6-orphan-retirement-rebased`；基线：`d7f7436fb6a7f257df7b13a4bc703c866602b243`。

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 |
| --- | ---: | --- | --- |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 根级边界、manifest、change 结构 |
| `cd frontend && pnpm harness:doctor` | 0 | 0 errors / 0 warnings | 无 BFF、前端 harness |
| `cd backend && python3 scripts/harness_doctor.py` | 0 | 0 errors / 0 warnings | 后端 harness 与 golden 清单 |
| `cd frontend && pnpm test:node` | 0 | 1041 passed / 0 failed | 全量前端 node 回归；基线为 1040 passed / 7 failed；新增 restore digest 回归 1 条 |
| `cd frontend && pnpm exec tsc --noEmit` | 0 | PASS | TypeScript |
| `cd frontend && NEXT_PUBLIC_API_MODE=real pnpm build` | 0 | PASS，39 个页面生成/收集成功 | production build；礼部不在 static params |
| `cd frontend && pnpm censor` | 0 | 0 red / 2 yellow | 诚实门、治理哨兵；黄色仅分支领先与 dirty |
| `cd frontend && pnpm knip:reachability` | 1 | 719 个既有 unused-file 候选 | P6 三个退役模块不再出现在 `src` 清单；该门基线未清零 |
| `cd backend && python3 -m pytest -q tests/test_contract_alignment_p0.py tests/test_frontend_second_brain_distillation.py` | 0 | 36 passed | 强认证、零 DecisionTask 写入、治理语义蒸馏 |
| `cd backend && ruff check ...P6 Python files...` | 0 | PASS | Python lint/import 顺序 |
| `cd backend && python3 -m pytest -q` | 1 | 2690 passed / 37 skipped / 7 failed | 后端全量；6 条在原始基线专项复现，第 7 条由全量测试生成 RAG 状态后多 3 个证据项 |
| 干净 B 与全新 clean H 专项复现 | 1 | 两者均 6 failed / 1 passed | 精确复现 closeout duplicate、lawyer RAG 4 条、persona roster；钦天监单独运行均通过 |
| `cd backend && python3 scripts/commit_closeout_check.py` | 0 | 0 staged high-risk / 0 high-risk drift | 暂存边界（提交前将再次执行） |
| `git diff --check` | 0 | PASS | 空白与冲突卫生 |
| P6 新基线迁移逐文件对账 | 0 | 31 paths identical / 0 overlaps | 旧 `bbb1000` 工作树只读保留；内容迁到修复后的 `d7f7436f` |
| restore manifest 基线/摘要回归 | 1→0 | 旧 `bbb1000` RED；`d7f7436f` + 5 SHA-256 GREEN | 可恢复清单绑定修复基线与 attic 精确字节 |
| Claude backend 分片 review-v1 | 0 | INSUFFICIENT_EVIDENCE | 要求关闭第七条归因、golden 执行与 DB fixture 证明缺口 |
| review-v1 回修专项 | 0 | 36 passed / Ruff PASS / doctor 0/0 | 三个 P6 case 驱动真实 gate；招聘直接禁止 persistence adapter |
| Claude 分片复审 | 0 | BACKEND_GO / FRONTEND_GO / EVIDENCE_GO | backend 缺口关闭；frontend 与证据边界无 blocker；Fable 显式降级 |

## RED → GREEN 证据

- 后端认证 RED：4 个未认证 compatibility POST 均实际返回 200；实现后 4 条返回 401，连同招聘零写测试共 5 passed。
- 治理蒸馏 RED：三条 P6 case ID 缺失；补 golden 后该文件 5 passed。
- 前端归档 RED：礼部状态错误、原路径仍存在、防回流名单缺失；归档闭环聚焦测试最终 36 passed。
- 全量前端由基线 1040/7 变为 1041/0；额外暴露并修正一条被错误 active 状态遮蔽的礼部陈旧断言，并补清单摘要回归。
- backend review-v1 指出的证据缺口已按 `packet_review/review-v1.md` 回修；最终全包 review 必须使用更高版本。

## 未验证与已知阻塞

- 浏览器未针对本工作树启动：许可端口 3002、3050 分别由 `/home/ubuntu/Projects/chaotang-os/frontend` 与 `/home/ubuntu/workspace/frontend/chaotang-master-wt` 的既有服务占用。未停止、替换或借用它们冒充本分支证据。
- `swarm_orchestrator.py` 和两个后端 router 未归档：仍有调用或缺少 replacement VERIFIED + 连续 14 天零调用证据。
- 后端全量不全绿；6 条基线失败已复现，钦天监 1 条暴露全量测试产生持久 RAG 状态的隔离问题。本 Packet 未越界修复。
- knip 仍有 719 个项目既有候选，本 Packet 只证明目标三文件已离开生产树和 reachability 输出。
- 后端全量曾生成两个未跟踪 `backend/knowledge/docs/ima_archived/*.md`；验证后已删除，未纳入提交。
- 工部/吏部两个 result GET 仍是匿名存量接口且 sid 熵有限；P6 不扩大范围，后续安全 Packet 应补读取鉴权与归属校验。

## Diff 与回滚复核

- 应提交：P6 根 change、后端 auth/golden/tests、前端 taxonomy/route/tests/guards、dated attic 与恢复资料。
- 不应提交：`backend/var/**`、`backend/config/flow_opc.yaml.bak`、`.next/**`、测试生成知识文档、环境文件或密钥。
- 回滚：可按实现、guard、attic 三组 revert；恢复 attic 文件必须另开 review change，核对 manifest SHA-256 并重新通过安全门。
- 真实数据库/服务：未写入、未重启、未停止；所有后端验证使用测试进程/本地测试状态。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 7 条 known-red 迁移 | 前端 full 1041/0 | PASS |
| 四 POST 强认证且招聘零主库写 | backend 36 passed | PASS |
| 三省孤儿可逆归档且 0 生产引用 | retirement test、manifest、architecture guard | PASS |
| 安全语义进入 canonical harness | 3 个新增 golden cases + 5 passed | PASS |
| 后端候选不绕过删除门 | `scope-decision.md` | PASS（保持阻塞） |
| 完整浏览器证据 | 许可端口被其他工作树占用 | BLOCKED |
| 所有全量门 0 fail | 前端全绿；后端/knip 有已解释非零 | PARTIAL |

## 声明状态

- `VERIFIED_PARTIAL`
