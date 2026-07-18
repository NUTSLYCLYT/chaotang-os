# Packet P15 独立复审报告 v1

- Change ID: `fix-m1-task-trace-hardening-p15-20260719`
- Packet ID: P15
- 复审人: Claude Code（独立 review-only 复审，独立 detached worktree）
- 复审日期: 2026-07-19
- Verdict: 见本报告末尾唯一裸终态行

## 固定 SHA

| 角色 | SHA |
| --- | --- |
| B（predecessor，P14 已发布远端） | `5d273c3fbe5e02e52b6ab3e8630f6d54a0c78a43` |
| H（本包实现候选） | `33be947347f8a2ad25fbf69418bb9e9616bce099` |

结构核对：

- `git rev-parse H^` = `5d273c3fbe5e02e52b6ab3e8630f6d54a0c78a43` = B。PASS。
- `git rev-list --parents -n 1 H` 仅含一个 parent（B），H 非 merge commit。PASS。
- `git log --oneline B..H` 恰好 1 个提交 `33be947 fix: harden M1 task trace contracts`。PASS。
- 全部复审基于 `git diff B..H` 固定 SHA，未使用浮动 HEAD。
- 复审在独立 detached worktree `/home/ubuntu/Projects/chaotang-os/.worktrees/review-p15-m1`（checkout H）执行；未切换分支、未修改主工作树或任何其他 worktree、未清理任何文件。

## Diff 范围核对

`git diff --name-only B..H`（恰好 6 路径，与包声明一致）：

```
.harness/changes/fix-m1-task-trace-hardening-p15-20260719/ci_result/ci_summary.md
.harness/changes/fix-m1-task-trace-hardening-p15-20260719/request_analysis/spec.md
.harness/changes/fix-m1-task-trace-hardening-p15-20260719/request_analysis/tasks.md
.harness/changes/fix-m1-task-trace-hardening-p15-20260719/summary.md
backend/src/contracts/task_trace.py
backend/tests/test_task_trace_contracts.py
```

- 仅触及 1 个 root change 目录 `fix-m1-task-trace-hardening-p15-20260719`。PASS。
- 无 API、路由、数据库、迁移、队列、provider、前端或 lockfile 变化。PASS。
- `git diff --check B..H` 无输出。PASS。
- 关键词扫描 `门下省|工部|国力|census|269b2ec|d8ade24`：4 处命中全部位于本包 spec/summary 的**非目标与边界声明**段（"不处理…"、"不 cherry-pick…"），属于范围排除文字，非夹带内容。P6/P8/P9 亦仅以非目标声明形式出现，无旧 change 目录、无旧证据文件、无本地 78 提交历史进入 diff。PASS。
- 测试文件 diff 为纯增量：唯一删除行是 `-from pydantic import ValidationError`（被 `from pydantic import BaseModel, ValidationError` 取代）。无既有测试被删除或弱化。PASS。

## 实跑命令与结果（独立 worktree @ H）

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `git diff --check B..H` | 0 | 无输出 |
| B 基线 RED 独立复现脚本（`/tmp` 外部脚本，未改仓内文件） | 1 | `('trace-unassigned', 'trace-unassigned')`；冲突输入被静默接受并解析为 `trace-explicit` |
| 独立行为/变异探针 32 例（`/tmp` 外部脚本） | 0 | 见下"重点审查结论" |
| `python3 -m pytest -q tests/test_task_trace_contracts.py -p no:randomly` | 0 | `18 passed in 3.74s` |
| `python3 -m pytest -q tests -p no:randomly` | 0 | `2738 passed, 37 skipped, 4 warnings in 281.30s (0:04:41)` |
| `python3 scripts/harness_doctor.py`（backend） | 0 | `backend-harness-doctor: 0 errors, 0 warning(s)` |
| `node scripts/harness-doctor.mjs`（root） | 0 | `project-harness-doctor: 0 errors, 0 warning(s)` |
| `rg -n "src.contracts\|contracts.task_trace"`（全仓，排除 .md） | — | 除契约文件与其自身单测外零命中 |

## 重点审查结论

### 1. RED 证据真实性

以 `git show B:backend/src/contracts/task_trace.py` 取出基线源码，在仓外脚本中独立执行两条断言：

- 两个默认 envelope 的 trace ID 均为固定 `trace-unassigned`，完全相同——与 ci_summary 记录的 `('trace-unassigned', 'trace-unassigned')` 逐字一致。
- `trace={"trace_id": "trace-explicit"}` 与 `trace_id="trace-flat-different"` 同时提供时，基线静默采用嵌套值、丢弃平铺值，无任何报错。

脚本退出码 1。两条 RED 均为真实可复现缺陷，非事后补写。PASS。

### 2. 默认 trace ID 唯一性、格式与熵

- 连续构造 5000 个默认 `TaskEnvelope`，得到 5000 个互不相同的 trace ID（逐实例唯一，非类级共享）。默认值经由 `default_factory` 每次实例化调用，未落入"可变默认值"陷阱。
- 格式严格匹配 `trace-unassigned-[0-9a-f]{32}`，即 `uuid4().hex`，122 位随机熵。前缀稳定且语义诚实——生成值自我标注为"未分配"，不会被下游误读成调用方提供的真实追踪标识。
- 序列化：`model_dump(mode="json")` → `model_validate` 往返后 trace ID 不变；UUID 仅在构造时生成一次，不会在每次序列化时漂移。PASS。

### 3. `from_legacy()` 对 dict 与 `TraceContext` 两种形状的一致性

两种形状在归一化后走**同一条**冲突检测与补全路径，独立探针逐项确认：

| 场景 | dict 形状 | `TraceContext` 实例形状 | 一致 |
| --- | --- | --- | --- |
| ID 相同 | 通过，保留 span_id | 通过，保留 span_id | 是 |
| ID 冲突 | `ValueError` | `ValueError` | 是 |
| 嵌套缺 ID + 平铺有值 | 补入平铺值 | 不适用（实例必有 ID） | 是 |
| 嵌套 `trace_id=None` + 平铺有值 | 补入平铺值 | 不适用 | 是 |
| 空 dict `{}` + 平铺有值 | 补入平铺值 | 不适用 | 是 |
| 单独提供、无平铺值 | 通过 | 通过 | 是 |

补充确认：`TraceContext` 子类经 `isinstance` 接受（符合里氏替换），且子类额外字段在 `TaskEnvelope` 的 `extra="forbid"` 校验处仍然 fail closed。调用方传入的 dict 与 `TraceContext` 实例在调用后均未被修改（无隐式副作用）。PASS。

### 4. 顶层与 trace 类型边界是否 fail closed

| 输入 | 实测结果 |
| --- | --- |
| 顶层 `None` / `str` / `int` / `list` / `set` / 裸 `object()` | 全部 `TypeError: unsupported legacy value type: ...` |
| 顶层 `MappingProxyType` | 通过（`Mapping` 协议，符合声明） |
| `trace="not-a-trace"` | `TypeError: unsupported trace value type: ...` |
| `trace=` 无关 `BaseModel` | `TypeError` |
| `trace=` 恰好带 `trace_id` 字段的**伪装** `BaseModel` | `TypeError`（未被鸭子类型蒙混过关） |
| 嵌套 `trace` 含未知字段 | `ValidationError`（extra forbid） |
| 平铺或嵌套 `trace_id=123` | `ValidationError`（pydantic v2 不做 int→str 强转） |

未发现任何"看起来像 trace 就放行"的松散分支。归一化只认 `Mapping` 与 `TraceContext` 两种确切形状，与 docstring 声明一致。PASS。

### 5. `trace_id or _unassigned_trace_id()` 是否不诚实地吞掉显式空字符串

**会吞掉，且存在真实不对称**——这是本次复审最值得记录的一点，实测：

- `from_legacy({..., "trace_id": ""})`（无 `trace`）→ **不报错**，生成 `trace-unassigned-<uuid>`。
- `from_legacy({..., "trace": {"trace_id": ""}})` → `ValidationError`（`min_length=1`）。
- `from_legacy({..., "trace_id": "", "trace": {"trace_id": "abc"}})` → `ValueError` 冲突（`''` 参与冲突检测，未被提前吞掉）。
- 因 `or` 判定的是 falsy 而非 `None`，`trace_id=0` 同样被吞掉，而 `trace_id=123` 会被 `ValidationError` 拒绝——类型边界在 falsy 值上出现缺口。

即：同一个空字符串，出现在顶层被静默替换，出现在嵌套则被拒绝。判定为 **LOW 而非 MEDIUM**，理由三条：
1. 替换值前缀为 `trace-unassigned-`，**自我标注为未分配**，不冒充调用方提供的真实 ID，不构成对下游观察者的欺骗——这与本包修掉的"冲突时静默改换调用方指定值"在诚实性上有本质区别。
2. 该行 falsy 语义**在基线 B 已存在**（`trace_id or "trace-unassigned"`），本包只替换了常量，未引入也未加重该行为；相对基线是严格改进（碰撞消失）。
3. spec 的边界条件表未声明"显式空字符串必须拒绝"，因此不构成文档与实现的矛盾；且全仓零生产调用方，现实影响面为空。

记录为 F1，交由后续 M1-B 生产接线 packet 处理，本包不修（遵守 review-only 与不顺手修复纪律）。

### 6. 异常类型与错误信息稳定性

- 类型边界一律 `TypeError`，语义冲突一律 `ValueError`，两类不混用，调用方可分别捕获。
- `ValueError` 消息回显双方 trace ID（`legacy trace_id=... vs trace.trace_id=...`）。trace ID 是诊断标识而非凭据，回显是定位冲突所必需，不构成敏感信息泄露。
- `TypeError` 消息含 `type(...)!r`，会带出调用方类的模块路径。属于常规类型错误信息量级，未泄露实例内容、配置或凭据。可接受。

### 7. UUID 默认值对可重复性、序列化与既有契约的影响

- 副作用是两个默认构造的 envelope 不再 `==` 相等（实测 `False`）。这是唯一性目标的必然结果，非缺陷，但任何未来依赖 envelope 等值比较、哈希或快照夹具的代码必须显式注入 `trace`。
- 未改变字段名、`schema_version`、JSON 形状或任何公共契约；往返序列化稳定。
- backend 全量 2738 项通过，证明无既有测试依赖旧固定值。PASS。

### 8. 生产调用面独立扫描

`rg -n "TaskEnvelope|from_legacy\(|task_trace|TraceContext"` 与 `rg -n "src.contracts|contracts.task_trace"` 全仓（排除 .md）扫描结果：命中仅限 `backend/src/contracts/task_trace.py` 与 `backend/tests/test_task_trace_contracts.py`。同目录其他契约模块（如 `memorial_card`）有生产 importer，`task_trace` 没有。

spec 与 summary 中"当前生产代码无 `TaskEnvelope` / `from_legacy()` 调用方、本包不宣称 M1 生产接线完成"的声明**属实**，无越权宣称。PASS。

### 9. change 文档诚实性

- 声明的 18 项聚焦测试：实跑 `18 passed`，与测试文件中 14 个测试函数 + 1 个 4 参数化用例（14 + 4 = 18）吻合。
- 声明的全量 2738 passed / 37 skipped / 4 warnings / 0 failed：实跑逐项一致。
- 声明的 warning 归因"两个重复 FastAPI Operation ID + 两个 OpenClaw fallback 场景，非本包引入"：实跑 4 条 warning 分别为 `scribe_lessons` 与 `manor_stream` 的 Duplicate Operation ID（`web/routers/governance_compat.py`）以及 `openclaw_dispatch fallback→spawn` 的服务不可达与 timeout 两例（`src/flow_engine.py:2591`），归因与范围精确属实，与本包 diff 无关。
- 状态 `IMPLEMENTED_CANDIDATE / EXTERNAL_REVIEW_PENDING` 如实；ci_summary 的"未验证项"主动列出生产接线缺口与复审待收口，未夸大。PASS。

## Findings

| # | 级别 | 内容 | 处置 |
| --- | --- | --- | --- |
| F1 | LOW | 顶层 falsy `trace_id`（`""`、`0`）被 `or` 静默替换为生成 ID，而同一空字符串嵌套于 `trace` 时被 `ValidationError` 拒绝，边界不对称；`0` 被吞而 `123` 被拒，falsy 值上类型边界有缺口。基线 B 已存在同一 falsy 语义，本包未引入亦未加重，且替换值自我标注为 `trace-unassigned-` 前缀、不冒充真实 ID，spec 亦未声明须拒绝。 | 不阻断本包。建议 M1-B 生产接线时把顶层 `trace_id` 的存在性判定由 falsy 改为 `is None`，让显式空值 fail closed。勿在本包顺手修复。 |
| F2 | LOW（观察） | 两个默认构造的 `TaskEnvelope` 不再等值（`==` 为 `False`），默认 trace 唯一性的必然副作用。 | 不阻断。后续任何依赖 envelope 等值/哈希/快照的测试或去重逻辑须显式注入 `trace`。 |
| F3 | LOW（范围外观察） | 执行 backend 全量套件会在仓库树内生成未跟踪产物 `backend/knowledge/docs/ima_archived/doc-b5338f5e29eb.md`（本复审 2026-07-19 01:45 由全量跑触发，H 提交时间为 01:42，非本包 diff 内容）。任何跑全量的 worktree 都会被污染。 | 不阻断本包，且按 review-only 纪律**未清理**。建议后续独立 packet 处理测试写入隔离或 gitignore。本 review-only 提交 R 不包含该产物。 |

无 HIGH，无 MEDIUM。

## 复审局限

- 本复审为固定 SHA 静态与行为复审，未做浏览器端到端验证——本包不含前端或运行时路径，不适用。
- 行为探针在仓外 `/tmp` 脚本中执行，未修改仓内任何正式测试文件；探针覆盖 32 个边界用例，不等于穷尽证明。
- 未验证生产接线正确性：本包本就无生产调用方，接线属后续 M1-B packet，其风险不在本包可验证范围内。
- 全量套件与两级 doctor 均在本 worktree 单次执行，未做多次重跑或跨机复现。
- 本复审不构成对 M1 总体完成度的背书，仅对 B..H 这一净切片给出结论。

## 复审纪律声明

- 未修改 H 中任何实现、测试、summary、spec、tasks、ci 文件。
- 除本 review-only commit R 外未创建任何提交；R 为 H 的单亲子提交，仅新增 `packet_review/review-v1.md` 与 `packet_review/approval-v1.json` 两个文件。
- 未执行 merge、未执行 push、未执行 rebase、未执行 amend。
- 未删除或清理任何文件，未触碰主工作树或其他 worktree。

PACKET_REVIEW_GO
