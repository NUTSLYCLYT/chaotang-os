# Periodless Accounting Report Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让明确请求财务报表但未写年份的旨意，在确认前确定性采用上一完整年度并显示该年份；若该年度数据不可用则阻断为 `NEEDS_INPUT`；成功下旨后必须返回一个可鉴权下载的 XLSX 附件，不能静默成功并返回空附件。

**Architecture:** 把“是否请求报表”与“期间是否解析”拆成独立状态，在会计域内增加纯函数期间政策和共享数据根配置。拟旨图在 authority 登记前解析并验证默认年度，把采用年份写进 canonical decree；执行层继续遵守 ADR 0028 的先生成 PENDING、史馆归档、再 PUBLISHED 流程，同时增加“报表请求必须产生附件”的 fail-closed 不变量。前端沿用现有 canonical draft 与 artifact 响应契约，只补跨层和显示验收。

**Tech Stack:** Python 3.12、FastAPI、LangGraph、pytest、Pydantic；React、TypeScript、Vitest；openpyxl；现有 artifact store、BFF 和 Study UI。

---

## 已锁定产品与安全契约

- 未写年份只采用上一完整年度：`reference_date.year - 1`。在 2026 年为 2025 年。
- 2025 年数据无效时返回 `NEEDS_INPUT`，不探测、不选择 2024 或更早年份。
- “无有效数据”定义为：受控数据根中无法由既有严格 loader 找到支持格式的该年度来源、schema 校验失败，或没有可规范化行。业务核对结果为 FAIL 仍可生成报告并在报告中披露，不等同于来源无效。
- 确认前的 `expert_example`、`decree_text` 和假设说明必须明确显示采用年份；确认后仍执行同一 canonical decree。
- 显式有效年份/年份范围保持原语义。显式但无效或歧义的期间不得套用默认年份，应返回 `NEEDS_INPUT`。
- 普通非报表回奏仍可没有附件；明确报表请求成功时必须恰好产生并返回一个 XLSX。
- 不修改、绕过或复制替代 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`。
- 不读取真实私有密钥，不访问生产，不调用 DeepSeek、真实或付费模型。开发与验收只走 synthetic/fake 路径。
- 当前阶段只生成本文档和 failure 记录。进入实现前必须交回主管，由主管按“只读架构/规格 → TDD 实现 → 独立规格与代码审查 → 独立测试验收”顺序编排。共享文件禁止多个实现者并行写。
- 本计划不授权提交、推送、部署或生产动作；实现阶段也不得自行执行这些动作。

## 目标数据流

```text
用户旨意
  -> 报表意图分类（请求与期间分离）
  -> 无年份：固定解析为上一完整年度
  -> 严格加载该年度来源（只检查这一年）
      -> 无效：NEEDS_INPUT，无 authority、无下旨
      -> 有效：canonical draft 明示年份
  -> 用户确认 canonical decree
  -> 户部 / 会计司
  -> workbook 生成（PENDING）
  -> 史馆归档并绑定 artifact
  -> PUBLISHED
  -> backend artifacts 响应
  -> BFF 严格解析
  -> Study 下载链接
  -> owner 下载 200 / 跨 owner 404
```

## Task 1: 拆分报表请求与期间解析状态

**Files:**

- Modify: `backend/app/accounting_reports/models.py`
- Modify: `backend/app/accounting_reports/intent.py`
- Modify: `backend/app/accounting_reports/__init__.py`
- Test: `backend/tests/test_accounting_report_intent.py`

### Step 1: 写出会失败的域模型和意图测试

在 `backend/tests/test_accounting_report_intent.py` 增加精确用例：

```python
def test_periodless_accounting_report_is_requested_with_missing_period() -> None:
    intent = detect_accounting_report_intent(
        "读取系统内既有财务数据并生成可下载财务报表"
    )

    assert intent.kind is ReportIntentKind.MISSING_PERIOD
    assert intent.requested is True
    assert intent.period is None


def test_non_report_instruction_remains_not_requested() -> None:
    intent = detect_accounting_report_intent("整理本月户部事项并回奏")

    assert intent.kind is ReportIntentKind.NOT_REQUESTED
    assert intent.requested is False
    assert intent.period is None


def test_explicit_invalid_period_does_not_become_missing_period() -> None:
    intent = detect_accounting_report_intent("生成 2025-2024 年财务报表")

    assert intent.kind is ReportIntentKind.INVALID_PERIOD
    assert intent.requested is True
    assert intent.period is None
```

保留并调整现有显式年份、年份范围、非报表和大小写/标点测试，断言显式合法期间为 `EXPLICIT_PERIOD`。

### Step 2: 运行 RED 测试并确认失败原因

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_accounting_report_intent.py -q
```

Expected: FAIL，因为 `ReportIntentKind` 尚不存在，且无年份请求当前被返回为 `requested=False`。

### Step 3: 实现可表达四态的最小域模型

在 `models.py` 定义：

```python
from enum import StrEnum


class ReportIntentKind(StrEnum):
    NOT_REQUESTED = "NOT_REQUESTED"
    EXPLICIT_PERIOD = "EXPLICIT_PERIOD"
    MISSING_PERIOD = "MISSING_PERIOD"
    INVALID_PERIOD = "INVALID_PERIOD"


@dataclass(frozen=True, slots=True)
class ReportIntent:
    kind: ReportIntentKind
    period: ReportPeriod | None

    def __post_init__(self) -> None:
        has_period = self.period is not None
        if (self.kind is ReportIntentKind.EXPLICIT_PERIOD) != has_period:
            raise ValueError("only EXPLICIT_PERIOD may carry a report period")

    @property
    def requested(self) -> bool:
        return self.kind is not ReportIntentKind.NOT_REQUESTED
```

在 `intent.py` 先判定会计域词和报表交付词，再把结果分类为：

- 没有报表请求语义：`NOT_REQUESTED`
- 有合法显式期间：`EXPLICIT_PERIOD`
- 有报表请求语义但完全没有年份 token：`MISSING_PERIOD`
- 出现年份 token 但格式、顺序、跨度或数量非法：`INVALID_PERIOD`

不得用异常兜底成 `NOT_REQUESTED`。在 `__init__.py` 导出新枚举。

### Step 4: 运行 GREEN 测试

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_accounting_report_intent.py -q
```

Expected: PASS。

### Step 5: 回归所有会计域调用点

Run:

```powershell
rg "ReportIntent\(|\.requested|detect_accounting_report_intent" backend/app backend/tests
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_accounting_report_session.py backend/tests/test_accounting_report_cross_layer.py backend/tests/test_decrees_api.py -q
```

Expected: 搜索结果中的直接构造全部迁移到 `kind=`；测试若因旧假设失败，只更新与新四态契约直接相关的断言，不改变 ADR 0028 流程。

## Task 2: 实现上一完整年度解析与单年度来源验证

**Files:**

- Create: `backend/app/accounting_reports/config.py`
- Create: `backend/app/accounting_reports/period_policy.py`
- Modify: `backend/app/accounting_reports/__init__.py`
- Modify: `backend/app/api/decrees.py`
- Test: `backend/tests/test_accounting_report_period_policy.py`
- Test: `backend/tests/test_accounting_report_sources.py`

### Step 1: 写出默认年度、无回退和显式期间测试

创建 `backend/tests/test_accounting_report_period_policy.py`，使用 fake loader，不读取真实财务数据：

```python
def test_missing_period_uses_previous_complete_year() -> None:
    calls: list[ReportPeriod] = []

    def fake_loader(_source_dir: Path, period: ReportPeriod) -> list[LedgerRow]:
        calls.append(period)
        return [make_ledger_row(year=2025)]

    resolution = resolve_accounting_report_period(
        ReportIntent(ReportIntentKind.MISSING_PERIOD, None),
        reference_date=date(2026, 8, 5),
        source_dir=Path("synthetic"),
        loader=fake_loader,
    )

    assert resolution.status is PeriodResolutionStatus.RESOLVED
    assert resolution.period == ReportPeriod(2025, 2025)
    assert resolution.used_default is True
    assert calls == [ReportPeriod(2025, 2025)]


def test_missing_period_stops_when_previous_year_is_unavailable() -> None:
    calls: list[ReportPeriod] = []

    def unavailable(_source_dir: Path, period: ReportPeriod) -> list[LedgerRow]:
        calls.append(period)
        raise AccountingSourceError("source_unavailable")

    resolution = resolve_accounting_report_period(
        ReportIntent(ReportIntentKind.MISSING_PERIOD, None),
        reference_date=date(2026, 8, 5),
        source_dir=Path("synthetic"),
        loader=unavailable,
    )

    assert resolution.status is PeriodResolutionStatus.NEEDS_INPUT
    assert resolution.period == ReportPeriod(2025, 2025)
    assert calls == [ReportPeriod(2025, 2025)]
```

另加：显式期间原样返回且不做默认年度预检；`INVALID_PERIOD` 返回 `NEEDS_INPUT`；`NOT_REQUESTED` 返回 `NOT_REQUESTED`。

### Step 2: 运行 RED 测试

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_accounting_report_period_policy.py -q
```

Expected: FAIL，因为模块与解析类型尚不存在。

### Step 3: 创建共享受控根配置与纯期间政策

`config.py` 只定义由仓库位置推导的允许根，不读取环境密钥：

```python
from pathlib import Path


DEFAULT_ACCOUNTING_SOURCE_DIR = (
    Path(__file__).resolve().parents[3] / "data" / "accounting"
)
```

实际末级目录名必须复用 `decrees.py` 当前已批准路径；迁移时先用测试锁定解析后的绝对路径完全相等，禁止凭计划文字新造目录。

`period_policy.py` 定义：

```python
class PeriodResolutionStatus(StrEnum):
    NOT_REQUESTED = "NOT_REQUESTED"
    RESOLVED = "RESOLVED"
    NEEDS_INPUT = "NEEDS_INPUT"


@dataclass(frozen=True, slots=True)
class AccountingPeriodResolution:
    status: PeriodResolutionStatus
    period: ReportPeriod | None
    used_default: bool
    reason: str | None = None


def resolve_accounting_report_period(
    intent: ReportIntent,
    *,
    reference_date: date,
    source_dir: Path,
    loader: Callable[[Path, ReportPeriod], Sequence[LedgerRow]] = load_ledger_rows,
) -> AccountingPeriodResolution:
    ...
```

`MISSING_PERIOD` 只构造 `ReportPeriod(reference_date.year - 1, reference_date.year - 1)` 并调用 loader 一次。捕获已知的 `AccountingSourceError` 并返回稳定、无内部路径的 `reason="previous_complete_year_unavailable"`；不使用循环，不扫描更早年份。空 rows 同样视为不可用。`decrees.py` 改为导入共享常量，删除重复路径推导。

### Step 4: 运行 GREEN 和来源回归

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_accounting_report_period_policy.py backend/tests/test_accounting_report_sources.py -q
```

Expected: PASS；无回退测试证明只请求 2025 一次。

## Task 3: 在 authority 登记前固定默认年份或阻断拟旨

**Files:**

- Modify: `backend/app/agents/chancellor_draft/graph.py`
- Test: `backend/tests/test_chancellor_draft_graph.py`
- Test: `backend/tests/test_chancellor_drafts_api.py`

### Step 1: 写出确认前明示年份的 RED 测试

在 graph 测试中固定时钟和 fake loader：

```python
def test_periodless_report_draft_canonicalizes_previous_complete_year() -> None:
    graph = build_chancellor_draft_graph(
        chat_model=FakeDraftModel(valid_accounting_payload(year=2025)),
        today_provider=lambda: date(2026, 8, 5),
        accounting_source_dir=Path("synthetic"),
        accounting_source_loader=lambda _root, _period: [make_ledger_row(year=2025)],
    )

    result = graph.invoke({"messages": [HumanMessage(
        "读取系统内既有财务数据并生成可下载财务报表"
    )]})

    assert result["status"] == "DRAFT_READY"
    assert "2025" in result["expert_example"]
    assert result["decree_text"] == result["expert_example"].strip()
    assert any("上一完整年度" in item for item in result["draft"]["assumptions"])
    assert result["draft"]["primary_ministry"] == "户部"
    assert result["draft"]["receiving_office"] == "会计司"
```

再加三类测试：

- fake 模型首轮遗漏或篡改 2025 时，校验失败并进入既有修订循环；最终只能接受显式 2025 的 canonical decree。
- 2025 loader 抛出 `AccountingSourceError` 时返回 `NEEDS_INPUT`，fake 模型调用次数为 0。
- 显式 2024 请求不被重写成 2025。

API 测试断言：成功无年份草稿登记的 authority 中 `decree_text` 含 2025；不可用时 `status=NEEDS_INPUT`、没有 `decree_text`、既有 authority 被撤销/不创建。

### Step 2: 运行 RED 测试

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_chancellor_draft_graph.py backend/tests/test_chancellor_drafts_api.py -q
```

Expected: FAIL，因为 graph 还没有期间政策注入和确定性阻断。

### Step 3: 注入可测试时钟、来源根与 loader

把 builder 扩展为：

```python
def build_chancellor_draft_graph(
    chat_model: BaseChatModel | None = None,
    dotenv_path: Path | None = None,
    *,
    today_provider: Callable[[], date] = date.today,
    accounting_source_dir: Path = DEFAULT_ACCOUNTING_SOURCE_DIR,
    accounting_source_loader: AccountingSourceLoader = load_ledger_rows,
) -> CompiledStateGraph:
    ...
```

在 `_draft` 节点调用 `detect_accounting_report_intent` 和 `resolve_accounting_report_period`。只对 `MISSING_PERIOD` 做来源预检；禁止读取来源文件内容之外的密钥或调用外部模型。

### Step 4: 实现确定性 NEEDS_INPUT 和 canonical 年份约束

- `NEEDS_INPUT` 在调用 chat model 之前构造，`decree_text=None`、`draft=None`，revision prompt 明确“上一完整年度 2025 数据不可用，请补齐 2025 年数据或明确提供可用报表年份”。不得泄露绝对路径或 loader 原始异常。
- 解析成功时给模型追加系统约束：报表期间只能为 2025、主办必须为户部、承办必须为会计司、assumptions 必须解释默认规则。
- 在模型结果通过 Pydantic 校验后，再对 `expert_example/decree_text` 运行意图解析，要求 `EXPLICIT_PERIOD` 且期间严格等于解析结果；同时沿用现有精确路由校验。
- canonical fingerprint 继续覆盖最终 `decree_text` 和 draft payload，因此年份自动进入 authority 信任边界；不另建旁路 metadata，不改变 ADR 0028。

### Step 5: 运行 GREEN 测试

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_chancellor_draft_graph.py backend/tests/test_chancellor_drafts_api.py -q
```

Expected: PASS；不可用路径不调用模型、不登记 authority。

## Task 4: 执行层对报表附件 fail closed

**Files:**

- Modify: `backend/app/accounting_reports/session.py`
- Modify: `backend/app/api/decrees.py`
- Test: `backend/tests/test_accounting_report_session.py`
- Test: `backend/tests/test_decrees_api.py`
- Test: `backend/tests/test_accounting_report_cross_layer.py`

### Step 1: 写出“报表不能成功返回空附件”的 RED 测试

Session 测试：

```python
def test_requested_report_with_unresolved_period_fails_closed() -> None:
    session = AccountingReportSession(...)

    with pytest.raises(AccountingReportIntentError, match="report_period_unresolved"):
        session.maybe_generate(
            decree_text="读取系统内既有财务数据并生成可下载财务报表",
            route=exact_accounting_route(),
        )

    assert artifact_store.list_pending() == []
```

API/跨层测试增加：

- 构造可通过 authority 校验、但仍缺期间的对抗性 canonical decree，执行应返回既有脱敏报表失败响应，而不是 200；史馆没有新归档，artifact store 没有 PUBLISHED。
- 构造 report agent 不产生 pending artifact 的故障注入，执行必须失败并回滚，不得返回空 `artifacts`。
- 普通非报表旨意仍成功且 `artifacts=[]`，防止把附件变成所有回奏的强制项。
- 正常 2025 会计报告仍按 PENDING → archive/bind → PUBLISHED 返回恰好一个附件。

### Step 2: 运行 RED 测试

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_accounting_report_session.py backend/tests/test_decrees_api.py backend/tests/test_accounting_report_cross_layer.py -q
```

Expected: 新增的 unresolved-period 和 missing-artifact 测试 FAIL；现有 ADR 0028 生命周期测试仍 PASS。

### Step 3: 实现 session 域错误和 API 附件不变量

在 `session.py` 增加稳定域错误：

```python
class AccountingReportIntentError(RuntimeError):
    pass
```

`maybe_generate` 的门控改为：

```python
intent = detect_accounting_report_intent(decree_text)
if not intent.requested:
    return None
if intent.kind is not ReportIntentKind.EXPLICIT_PERIOD or intent.period is None:
    raise AccountingReportIntentError("report_period_unresolved")
```

在 `decrees.py` 沿用现有异常清理路径，并在归档前检查：

```python
report_requested = detect_accounting_report_intent(canonical_decree_text).requested
if report_requested and not accounting_session.has_pending_artifact:
    raise AccountingReportPublicationError("report_artifact_required")
```

实际属性/方法名必须复用 session 现有接口；若当前只返回 artifact id，则以该返回值作为不变量，不增加第二份状态源。失败必须走现有 pending 清理，不能归档、绑定或发布。

### Step 4: 运行 GREEN 和生命周期回归

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_accounting_report_session.py backend/tests/test_decrees_api.py backend/tests/test_accounting_report_cross_layer.py -q
```

Expected: PASS，包括 archive 失败、bind 失败、publish 失败、owner 隔离和精确路由对抗测试。

## Task 5: 把无年份请求贯穿 synthetic、BFF 与 Study 验收

**Files:**

- Modify: `backend/tests/synthetic_accounting_acceptance_app.py`
- Modify: `backend/tests/run_accounting_synthetic_acceptance.py`
- Test: `frontend/src/app/study/chancellorDraft.test.ts`
- Test: `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`
- Test: `frontend/src/features/study-visual/StudyArtifactLinks.test.ts`

### Step 1: 将 synthetic 主场景改成无年份请求

统一输入：

```python
ACCOUNTING_REQUEST = "读取系统内既有财务数据并生成可下载财务报表"
EXPECTED_REPORT_YEAR = 2025
REFERENCE_DATE = date(2026, 8, 5)
```

synthetic app 只能注入 fake draft model、固定时钟、临时允许根和 2025 synthetic ledger rows；不得读取仓库真实财务文件或调用真实模型。fake model 输出的 `expert_example/decree_text` 必须为单年 2025，并保持户部/会计司精确路由。

### Step 2: 扩充跨层断言

`run_accounting_synthetic_acceptance.py` 依次断言：

1. 拟旨为 `DRAFT_READY`，确认前 UI 所用响应字段明确含 2025。
2. 下旨使用服务端登记的 canonical `decree_text`，不得用客户端替代文本。
3. 最终 response 的 `artifacts` 长度严格为 1，状态为 `PUBLISHED`，媒体类型和文件名为 XLSX。
4. XLSX 仍有既有七张工作表，数据期间只含 2025，并保留来源/核对说明。
5. owner 经 BFF 下载为 200；跨 owner 对同一 URL 为 404；越界路径不可下载。
6. 归档记录绑定该 artifact；失败注入路径没有孤儿 PENDING/PUBLISHED 文件。

### Step 3: 增加前端契约测试

- `chancellorDraft.test.ts`：`DRAFT_READY` 的无年份原始请求对应响应中，canonical `decree_text` 必须包含 2025；`NEEDS_INPUT` 不允许带 `decree_text`。
- `DevStudyWorkspace.test.ts`：草稿区域在确认前渲染“2025”，且 `NEEDS_INPUT` 时不暴露下旨动作。
- `StudyArtifactLinks.test.ts`：一个 PUBLISHED XLSX 渲染一个可下载链接；普通空 artifacts 仍不渲染；不把空附件静默解释为“财务报告已生成”。

### Step 4: 运行前端 RED/GREEN 和 synthetic 验收

先在代码修改前运行新增测试，Expected: 至少“无年份 canonical 2025”场景 FAIL。实现完成后运行：

```powershell
Push-Location frontend
npm test
npm run typecheck
npm run lint
npm run build
Pop-Location
backend\.venv\Scripts\python.exe backend/tests/run_accounting_synthetic_acceptance.py
```

Expected: 全部 PASS；synthetic 输出明确记录 2025、单个 artifact、owner 200、cross-owner 404 和七张工作表。

## 独立审查顺序

实现任务必须由主管顺序派发，不能由当前设计任务直接实施：

1. **架构/规格只读角色**：核对四态意图、上一完整年度政策、ADR 0028、不回退和失败语义；不写文件。
2. **实现角色**：按 Task 1 → 5 串行 TDD 写入。任何共享文件（尤其 `models.py`、`graph.py`、`decrees.py`）同一时刻只允许一个实现者写。
3. **独立规格审查角色**：逐条对照已锁定产品契约，重点检查无年份 2025、无数据 NEEDS_INPUT、草稿明示年份、成功必有附件。
4. **独立代码审查角色**：检查 owner 隔离、路径允许根、异常脱敏、pending 清理、归档原子性、无真实模型/密钥调用和无 ADR 0028 漂移。
5. **独立测试验收角色**：在审查问题修复后，从干净的新鲜进程执行下述完整验收；实现者不得自签最终通过。

## 最终同一版本连续 10 轮完整验收

### 固定版本与重置规则

测试验收角色先记录：绝对工作区、分支、HEAD、`git status --short`，以及所有受影响业务代码、测试和配置文件的 SHA-256 清单。每轮开始前重新计算并与第 1 轮比对。

- 任一命令失败：立即停止，修复后从第 1 轮重新计数。
- 任一业务代码、测试、配置或验收命令发生实质变化：从第 1 轮重新计数。
- 只在验收记录中追加命令输出与 PASS 证据，不视为版本变化；不得在 10 轮中穿插实现修改。
- 10 轮全部使用同一 synthetic/fake 数据与固定日期 2026-08-05，不访问生产、真实密钥或付费模型。

### 每一轮必须完整执行的命令

从仓库根目录依次执行，任何一步失败即该轮 FAIL：

```powershell
$resolvedWorkspace = (Resolve-Path -LiteralPath .).Path
Write-Output "ABSOLUTE_WORKSPACE=$resolvedWorkspace"
git branch --show-current
git rev-parse HEAD
git status --short
backend\.venv\Scripts\python.exe -m ruff check backend
backend\.venv\Scripts\python.exe -m pytest backend/tests -q
Push-Location frontend
npm test
npm run typecheck
npm run lint
npm run build
Pop-Location
backend\.venv\Scripts\python.exe backend/tests/run_accounting_synthetic_acceptance.py
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
git diff --check
```

每轮证据必须包含：同一 SHA-256 清单、每条命令、退出码 0、pytest/Vitest 测试数、synthetic 的 2025/单附件/owner 200/cross-owner 404/七工作表摘要，以及 harness 四条命令的 PASS 输出。

### 验收台账

实施时由独立测试验收角色逐轮追加实际证据；以下十轮全部完成前不得宣称正式通过：

- [ ] Round 1：完整命令集 PASS，版本清单一致，证据已记录
- [ ] Round 2：完整命令集 PASS，版本清单一致，证据已记录
- [ ] Round 3：完整命令集 PASS，版本清单一致，证据已记录
- [ ] Round 4：完整命令集 PASS，版本清单一致，证据已记录
- [ ] Round 5：完整命令集 PASS，版本清单一致，证据已记录
- [ ] Round 6：完整命令集 PASS，版本清单一致，证据已记录
- [ ] Round 7：完整命令集 PASS，版本清单一致，证据已记录
- [ ] Round 8：完整命令集 PASS，版本清单一致，证据已记录
- [ ] Round 9：完整命令集 PASS，版本清单一致，证据已记录
- [ ] Round 10：完整命令集 PASS，版本清单一致，证据已记录

## 最终验收标准

- 无年份报表请求在 2026 年的确认前草稿明确显示 2025，且 authority 和执行使用同一 canonical decree。
- 2025 来源有效时，经精确户部/会计司路径返回恰好一个可下载 XLSX；artifact 生命周期严格为 PENDING → 归档绑定 → PUBLISHED。
- 2025 来源无效时为 `NEEDS_INPUT`，不调用模型、不登记 authority、不下旨、不归档、不生成附件，也不读取 2024。
- 显式合法期间保持原值；显式非法期间不套用默认年度。
- 报表请求缺少 artifact 时 fail closed；普通非报表回奏仍允许 `artifacts=[]`。
- owner 下载 200、跨 owner 404、越界路径拒绝；响应和日志不泄露绝对来源路径或内部异常。
- BFF 严格解析和 Study 链接渲染通过；用户不再得到“财务报表成功但无下载附件”的静默结果。
- ADR 0028 文件及其行为基线未改变。
- 同一最终版本连续 10 轮完整验收全部有新鲜 PASS 证据。

## 建议实现拆分

建议 **5 个实现任务**（上文 Task 1–5），随后单独进行独立规格/代码审查和 10 轮测试验收。五个实现任务存在共享文件与依赖关系，应由主管串行安排，不适合并行写入。
