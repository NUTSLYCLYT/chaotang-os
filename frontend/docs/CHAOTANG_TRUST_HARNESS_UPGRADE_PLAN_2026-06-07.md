# 朝堂可信系统 Harness 升级方案 2026-06-07

## 目标

先让朝堂成为可信系统，再让它成为强大系统。

本方案只服务一条主线：工部开工、军机复核、史馆归档的开发闭环必须具备身份、审计、时间线、测试、回滚和上线闸门。

## 当前能力

已完成：

1. build ledger 支持 `dispatched / reviewing / returned / archived` 状态。
2. 状态迁移走后端 `action: transition`。
3. 前端不再提交完整 entry 覆盖状态。
4. 服务端开始从 session 生成 actor。
5. 审计事件包含 actor、状态迁移、note、timestamp。
6. 军机处和史馆展示状态时间线。
7. E2E 覆盖工部、军机处、史馆主链路。

## 六条升级泳道

### 1. 复杂代码实现 Harness

目标：让复杂实现先有边界，再进入 Codex 执行。

升级动作：

1. 每个开发任务必须先生成工部任务卡。
2. 任务卡必须包含 `files / commands / rollback / archiveTarget`。
3. 复杂改动拆成 P0/P1/P2 子任务。
4. 每个子任务最多改一个领域：API、UI、store、E2E、文档。
5. Codex 完成后必须写入验收结果和失败记录。

验收门：

1. `pnpm exec tsc --noEmit`
2. 目标 E2E
3. `npm run build`
4. 史馆归档一条结果记录

### 2. 安全判断 Harness

目标：所有状态变化和高风险动作都必须服务端鉴权。

升级动作：

1. 所有 POST API 先读 server session。
2. 前端传入的 actor 只能作为 UI 意图，不作为真实身份。
3. 状态迁移由后端校验合法路径。
4. 高风险动作增加 admin/session 检查。
5. 添加未授权、越权、非法迁移 E2E。

验收门：

1. 未登录迁移返回 401。
2. 非法迁移返回 409。
3. actor 来自 session，不来自 body。
4. 审计事件包含 actorId、role、tenant、source。

### 3. 数据库迁移 Harness

目标：从本地文件 ledger 平滑迁到可并发的数据库。

升级动作：

1. 先定义表：`build_ledger_entries`、`build_ledger_audit_events`。
2. 保留文件 store 作为 dev fallback。
3. API 不变，store 实现可替换。
4. 迁移脚本先 dry-run，再 write。
5. 加唯一键：`task_id`、`audit_event_id`。

验收门：

1. 文件 store 和 DB store 同一组 golden cases 输出一致。
2. 并发迁移不会丢 audit event。
3. 数据库失败时有明确错误，不静默成功。

### 4. 生产部署 Harness

目标：每次部署前知道能不能上、上了怎么回滚。

升级动作：

1. 部署前运行 `tsc / E2E / build`。
2. 增加 smoke test：工部、军机处、史馆三页可访问。
3. 增加 API smoke：GET build ledger、POST unauthorized transition。
4. 部署后写一条 release audit。
5. 保留 rollback 命令和上一版 artifact。

验收门：

1. smoke 全绿。
2. release audit 入史馆。
3. 有明确 rollback path。

### 5. 多人权限和身份审计 Harness

目标：多人协作时知道是谁在什么权限下改了什么。

升级动作：

1. actor 从 session 解析，不接受 body actor。
2. 每个 audit event 写入 actorId、role、tenant、source、ip/user-agent 摘要。
3. 按 tenant 隔离 build ledger。
4. 军机处 UI 显示当前服务端身份。
5. 史馆支持按 actor/task/status 过滤。

验收门：

1. 用户 A 看不到用户 B 的 tenant 数据。
2. 普通用户不能执行 admin-only 迁移。
3. 史馆能重建完整时间线。

### 6. 最终上线拍板 Harness

目标：上线不是感觉，而是一个可审计决定。

升级动作：

1. 军机处生成 release readiness。
2. 刑部安全检查通过。
3. 工部验收命令通过。
4. 史馆归档 release note。
5. 人类最终拍板，记录 sign-off。

验收门：

1. 有 sign-off actor。
2. 有测试证据。
3. 有安全结论。
4. 有 rollback plan。
5. 有上线后观察指标。

## 分快执行计划

### 快 1：可信状态迁移

范围：

1. 服务端 session actor。
2. transition action。
3. audit event 扩展。
4. 军机处/史馆状态时间线。
5. 未授权和非法迁移测试。

完成标准：build ledger 不能被前端任意改状态。

### 快 2：统一审计台账

范围：

1. 独立 audit store。
2. 史馆读取 audit store。
3. 按 taskId 生成完整时间线。
4. 追加 hash 或 sequence，防止审计顺序被悄悄改写。

完成标准：史馆可重放一条任务的所有状态变化。

### 快 3：数据库边界

范围：

1. schema 草案。
2. store interface。
3. file store 和 DB store 双实现。
4. golden cases 对比。

完成标准：迁移数据库不改前端，不改 API 合约。

### 快 4：上线闸门

范围：

1. release harness。
2. smoke tests。
3. security checklist。
4. sign-off record。

完成标准：每次上线都有证据、有签字、有回滚。

## 明日建议

明天只完成「快 1」剩余验收：

1. 加未授权 transition E2E。
2. 加非法 transition E2E 或 API-level check。
3. 史馆读取独立 audit store 的第一版。
4. 把结果归档到本文件。

不要扩新页面，不要做数据库迁移，不要部署。

