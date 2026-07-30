# Accounting Bureau Management Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate an owner-scoped management financial report Excel only when an authenticated decree is routed to 户部/会计司 and explicitly requests a report, then expose its protected download from the successful 上书房 reply.

**Architecture:** A request-scoped `AccountingReportSession` is created by the decree API and passed explicitly through the Chancellor graph, ministry agent, and bureau agent. The 会计司 node alone may ask the session to load and normalize approved local source files, run deterministic checks/calculations, create a pending workbook, and provide a bounded summary to the model; after the existing single `REPLY` archive succeeds, the API publishes the pending artifact and adds sanitized metadata to the response.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic, SQLite, `openpyxl>=3.1,<4`, `xlrd>=2.0,<3`, pytest, Ruff; Next.js 16 App Router, React 19, TypeScript 5.9, Node test.

## Global Constraints

- `docs/decisions/0028-decree-evidence-flow-governance-baseline.md` remains unchanged and authoritative.
- Only `(department="户部", bureau="会计司")` plus an explicit report request may generate an artifact.
- The source directory is `data/财务数据资料/20-25年财务报表及科目余额表/`; source files are read-only and never committed as implementation output.
- Raw financial rows must not enter model prompts, logs, HTTP errors, screenshots, or test fixtures.
- Parsing tests use synthetic workbook data under pytest temporary directories: real temporary `.xlsx` files and an injected legacy-reader seam for `.xls`.
- All amounts, ratios, variances, thresholds, checks, and workbook formulas are deterministic; the model only explains a bounded validated summary.
- Excel files live under backend runtime data, are owner-scoped, and are not addressable by filesystem path.
- Existing responses without artifacts remain valid; once requested, a missing or failed report must not be reported as complete success.
- Existing single/multi routing, serial ministry execution, exactly three Chancellor recommendations, and exactly one Shiguan `REPLY` remain intact.
- Git add/commit steps in this plan require separate explicit user authorization at execution time.

## File Structure

### Backend files to create

- `backend/app/accounting_reports/models.py`: immutable normalized finance rows, checks, report summaries, and pending/published artifact contracts.
- `backend/app/accounting_reports/intent.py`: deterministic explicit-report intent and requested-period extraction.
- `backend/app/accounting_reports/sources.py`: allowed-directory discovery, `.xlsx`/`.xls` adapters, source hashing, and normalization.
- `backend/app/accounting_reports/analysis.py`: deterministic aggregations, ratios, variances, and validation checks.
- `backend/app/accounting_reports/workbook.py`: seven-sheet Excel writer.
- `backend/app/accounting_reports/storage.py`: owner-scoped artifact metadata SQLite and atomic pending/published file lifecycle.
- `backend/app/accounting_reports/session.py`: request-scoped orchestration used only by the 会计司 node.
- `backend/app/accounting_reports/__init__.py`: narrow public interface.
- `backend/app/api/report_artifacts.py`: authenticated download endpoint.
- `backend/tests/test_accounting_report_intent.py`
- `backend/tests/test_accounting_report_sources.py`
- `backend/tests/test_accounting_report_analysis.py`
- `backend/tests/test_accounting_report_workbook.py`
- `backend/tests/test_accounting_report_storage.py`
- `backend/tests/test_accounting_report_session.py`
- `backend/tests/test_report_artifacts_api.py`

### Backend files to modify

- `backend/pyproject.toml`: add pinned-compatible workbook dependencies.
- `backend/app/main.py`: register the protected artifact router.
- `backend/app/agents/bureaus/agent.py`: invoke the session only for 会计司 and append only the bounded summary to its prompt.
- `backend/app/agents/ministries/agent.py`: accept and forward an optional report session.
- `backend/app/agents/junjichu/agent.py`: forward the same session through multi-department review.
- `backend/app/agents/chancellor/graph.py`: capture the request session in the graph factory closure and forward it to both branches.
- `backend/app/api/decrees.py`: create the session, publish after successful Shiguan archive, and add optional response artifacts.
- `backend/app/agents/synthesis_failures.py`: add a sanitized `report` failure stage if the existing classifier requires it.
- `backend/tests/test_bureaus_agent.py`
- `backend/tests/test_ministries_agent.py`
- `backend/tests/test_junjichu_agent.py`
- `backend/tests/test_chancellor_graph.py`
- `backend/tests/test_decrees_api.py`

### Frontend files to create

- `frontend/src/app/api/report-artifacts/[id]/route.ts`: authenticated same-origin download proxy.
- `frontend/src/app/api/report-artifacts/[id]/route.test.ts`

### Frontend files to modify

- `frontend/src/lib/backendClient.ts`: strict optional artifact parsing and protected download helper.
- `frontend/src/lib/backendClient.test.ts`
- `frontend/src/app/api/decrees/chancellor/route.ts`: pass the optional artifact list to the browser.
- `frontend/src/app/api/decrees/chancellor/route.test.ts`
- `frontend/src/app/study/decreeStatus.ts`: retain artifacts in successful UI state.
- `frontend/src/app/study/decreeStatus.test.ts`
- `frontend/src/app/study/studySubmission.ts`: preserve artifacts from BFF success.
- `frontend/src/app/study/studySubmission.test.ts`
- `frontend/src/features/study-visual/studyWorkspaceState.ts`: project artifacts into the workspace view state.
- `frontend/src/features/study-visual/studyWorkspaceState.test.ts`
- `frontend/src/features/study-visual/DevStudyWorkspace.tsx`: render the download affordance inside the reply.
- `frontend/src/features/study-visual/DevStudyWorkspace.module.css`: style the report attachment without changing unrelated court layout.
- `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`

### Documentation files to modify

- `backend/AGENTS.md`
- `frontend/AGENTS.md`
- `ARCHITECTURE.md`
- `docs/product/tasks/2026-07-29-accounting-bureau-management-report.md`

---

### Task 1: Freeze the report intent and normalized finance contracts

**Files:**
- Create: `backend/app/accounting_reports/models.py`
- Create: `backend/app/accounting_reports/intent.py`
- Create: `backend/app/accounting_reports/__init__.py`
- Test: `backend/tests/test_accounting_report_intent.py`

**Interfaces:**
- Produces: `ReportPeriod(start_year: int, end_year: int)`.
- Produces: `ReportIntent(requested: bool, period: ReportPeriod | None)`.
- Produces: `detect_accounting_report_intent(decree_text: str) -> ReportIntent`.
- Produces: frozen `NormalizedLedgerRow`, `SourceRef`, `ReportCheck`, `AccountingReportSummary`, `PendingReportArtifact`, and `PublishedReportArtifact`.

- [ ] **Step 1: Write failing intent tests**

```python
from app.accounting_reports.intent import detect_accounting_report_intent


def test_explicit_management_report_request_is_detected() -> None:
    intent = detect_accounting_report_intent(
        "请户部会计司根据财务数据生成2020年至2025年管理层综合财务报告"
    )
    assert intent.requested is True
    assert intent.period is not None
    assert (intent.period.start_year, intent.period.end_year) == (2020, 2025)


def test_plain_financial_question_does_not_request_excel() -> None:
    intent = detect_accounting_report_intent("请分析今年费用为何上升")
    assert intent.requested is False
    assert intent.period is None
```

Also cover `Excel`, `报表`, `财务报告`, reversed/unsupported periods, blank text, and a report word without a financial/accounting context.

- [ ] **Step 2: Run the focused test and observe RED**

Run:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_accounting_report_intent.py -q
```

Expected: collection fails because `app.accounting_reports` does not exist.

- [ ] **Step 3: Add strict immutable contracts**

Use frozen, slotted dataclasses. The minimum public shapes are:

```python
@dataclass(frozen=True, slots=True)
class ReportPeriod:
    start_year: int
    end_year: int


@dataclass(frozen=True, slots=True)
class ReportIntent:
    requested: bool
    period: ReportPeriod | None


@dataclass(frozen=True, slots=True)
class SourceRef:
    file_name: str
    sheet_name: str
    row_number: int
    file_sha256: str


@dataclass(frozen=True, slots=True)
class NormalizedLedgerRow:
    year: int
    category: str
    account_code: str
    account_name: str
    opening_debit: Decimal
    opening_credit: Decimal
    movement_debit: Decimal
    movement_credit: Decimal
    closing_debit: Decimal
    closing_credit: Decimal
    source: SourceRef
```

Validate years as `2000 <= year <= 2100`, reject reversed ranges, require nonblank account identity/source fields, and require finite `Decimal` values.

- [ ] **Step 4: Implement conservative deterministic intent parsing**

Require both:

- a finance/accounting domain signal such as `财务`, `会计`, `科目`, `资产负债`, `利润`, or `现金流`; and
- a deliverable signal such as `生成报表`, `财务报告`, `管理报告`, `Excel`, or `下载表格`.

Extract either `YYYY年至YYYY年`, `YYYY-YYYY`, or a single `YYYY年`; reject ambiguous or reversed ranges rather than guessing. Do not call a model.

- [ ] **Step 5: Run focused tests**

Run:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_accounting_report_intent.py -q
.venv\Scripts\python.exe -m ruff check app/accounting_reports tests/test_accounting_report_intent.py
```

Expected: all tests pass and Ruff reports `All checks passed!`.

- [ ] **Step 6: Commit only if separately authorized**

```powershell
git add backend/app/accounting_reports backend/tests/test_accounting_report_intent.py
git commit -m "feat: define accounting report intent contracts"
```

### Task 2: Load and normalize approved `.xlsx` and `.xls` sources

**Files:**
- Modify: `backend/pyproject.toml`
- Create: `backend/app/accounting_reports/sources.py`
- Test: `backend/tests/test_accounting_report_sources.py`

**Interfaces:**
- Consumes: `ReportPeriod`, `NormalizedLedgerRow`, `SourceRef`.
- Produces: `load_ledger_rows(source_dir: Path, period: ReportPeriod) -> tuple[NormalizedLedgerRow, ...]`.
- Produces: `AccountingSourceError` with stable codes only: `source_missing`, `source_path_invalid`, `source_format_unsupported`, `source_schema_invalid`, `source_period_conflict`.

- [ ] **Step 1: Add failing synthetic workbook tests**

Create test workbooks only under `tmp_path`. Use `openpyxl.Workbook` for `.xlsx` and an injected legacy-reader seam for `.xls`, so repository tests never copy real financial data.

The representative normalized header is:

```python
[
    "科目类别", "科目编码", "科目名称",
    "期初借方", "期初贷方",
    "本期借方", "本期贷方",
    "期末借方", "期末贷方",
]
```

Assert:

- hierarchical account codes remain text;
- blanks normalize to `Decimal("0")`;
- numeric strings and numbers normalize identically;
- filename year and requested period must agree;
- duplicate year/source type fails closed;
- paths outside `source_dir.resolve()` are rejected;
- source hashes and row numbers are retained;
- `.xls` and `.xlsx` adapters produce equal normalized rows.

- [ ] **Step 2: Run focused tests and observe RED**

Run:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_accounting_report_sources.py -q
```

Expected: failure because `load_ledger_rows` is undefined.

- [ ] **Step 3: Add runtime dependencies**

Add to `[project].dependencies`:

```toml
"openpyxl>=3.1,<4",
"xlrd>=2.0,<3",
```

Reinstall only through the declared backend environment during execution:

```powershell
cd backend
.venv\Scripts\python.exe -m pip install -e ".[dev]"
```

Do not install packages ad hoc outside `pyproject.toml`.

- [ ] **Step 4: Implement adapters and normalization**

Implement:

```python
def load_ledger_rows(
    source_dir: Path,
    period: ReportPeriod,
) -> tuple[NormalizedLedgerRow, ...]:
    approved_root = source_dir.resolve(strict=True)
    candidates = _discover_period_files(approved_root, period)
    rows = tuple(
        row
        for candidate in candidates
        for row in _load_candidate(candidate, approved_root)
    )
    _validate_period_coverage(rows, period)
    return rows
```

Open workbooks in read-only/data-only mode where supported. Never evaluate macros, external links, formulas from untrusted locations, or follow symlinks outside the approved root. Error messages contain only the stable code and safe filename, never row values.

- [ ] **Step 5: Run focused tests and dependency audit**

Run:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_accounting_report_sources.py -q
.venv\Scripts\python.exe -m pip check
.venv\Scripts\python.exe -m ruff check app/accounting_reports/sources.py tests/test_accounting_report_sources.py
```

Expected: PASS, `No broken requirements found.`, and Ruff success.

- [ ] **Step 6: Commit only if separately authorized**

```powershell
git add backend/pyproject.toml backend/app/accounting_reports/sources.py backend/tests/test_accounting_report_sources.py
git commit -m "feat: normalize accounting workbook sources"
```

### Task 3: Build deterministic analysis and finance checks

**Files:**
- Create: `backend/app/accounting_reports/analysis.py`
- Test: `backend/tests/test_accounting_report_analysis.py`

**Interfaces:**
- Consumes: `tuple[NormalizedLedgerRow, ...]`, `ReportPeriod`.
- Produces: `analyze_ledger(rows, period) -> AccountingReportSummary`.
- `AccountingReportSummary` exposes only aggregate metrics, named exceptions, checks, and source IDs safe for the accounting model prompt.

- [ ] **Step 1: Write failing reconciliation and trend tests**

Use a small synthetic chart of accounts that includes assets, liabilities, revenue, cost, and expenses. Assert exact `Decimal` results for:

- yearly closing assets/liabilities/equity;
- revenue, cost, expense, and profit;
- year-over-year amount and rate with zero-denominator handling;
- opening-versus-prior-closing continuity;
- debit/credit movement balance;
- negative/direction anomalies;
- a material movement threshold stored as a named constant;
- overall `PASS` only when every required check passes.

Example:

```python
summary = analyze_ledger(rows, ReportPeriod(2024, 2025))
assert summary.metrics_by_year[2025]["profit"] == Decimal("240.00")
assert summary.checks[0].status in {"PASS", "FAIL"}
assert "raw_rows" not in summary.to_model_payload()
```

- [ ] **Step 2: Run focused tests and observe RED**

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_accounting_report_analysis.py -q
```

Expected: failure because `analyze_ledger` is undefined.

- [ ] **Step 3: Implement auditable helper functions**

Keep formulas in small named functions:

```python
def signed_closing(row: NormalizedLedgerRow) -> Decimal:
    return row.closing_debit - row.closing_credit


def safe_growth(current: Decimal, prior: Decimal) -> Decimal | None:
    if prior == 0:
        return None
    return (current - prior) / abs(prior)
```

Centralize account-family mapping in a visible immutable mapping. Unknown accounts remain in detail and surface a mapping warning; they are never silently dropped or guessed into a financial statement line.

- [ ] **Step 4: Implement bounded model payload**

`AccountingReportSummary.to_model_payload()` returns:

```python
{
    "period": {"start_year": 2020, "end_year": 2025},
    "metrics": [...],
    "exceptions": [...],
    "checks": [...],
    "source_ids": [...],
}
```

Exclude account-level rows, bank/customer names, raw cell contents, local paths, and source workbook bytes.

- [ ] **Step 5: Run analysis tests and Ruff**

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_accounting_report_analysis.py -q
.venv\Scripts\python.exe -m ruff check app/accounting_reports/analysis.py tests/test_accounting_report_analysis.py
```

Expected: PASS.

- [ ] **Step 6: Commit only if separately authorized**

```powershell
git add backend/app/accounting_reports/analysis.py backend/tests/test_accounting_report_analysis.py
git commit -m "feat: add deterministic accounting analysis"
```

### Task 4: Generate and verify the seven-sheet Excel report

**Files:**
- Create: `backend/app/accounting_reports/workbook.py`
- Test: `backend/tests/test_accounting_report_workbook.py`

**Interfaces:**
- Consumes: normalized rows, `AccountingReportSummary`, output `Path`.
- Produces: `write_management_report(rows, summary, destination) -> str`, returning the final SHA-256.
- Raises: `AccountingWorkbookError("workbook_generation_failed")` without leaking data.

- [ ] **Step 1: Write failing workbook structure tests**

Generate into `tmp_path` and reopen with `openpyxl.load_workbook(..., data_only=False)`. Assert the exact ordered sheet names:

```python
[
    "管理摘要",
    "核心财务报表",
    "科目趋势",
    "异常分析",
    "科目明细",
    "校验结果",
    "数据来源",
]
```

Also assert:

- derived cells contain formulas, not pasted totals;
- source/detail values keep numeric types;
- money, percentages, dates, and account codes have correct formats;
- freeze panes and filters exist on long sheets;
- `校验结果` exposes `PASS/FAIL`, actual, expected, difference, and notes;
- no formula contains an external workbook link or a local absolute path;
- formulas contain no `#REF!`, `#DIV/0!`, `#VALUE!`, or `#NAME?` literals;
- report metadata includes period, generated time, and source hashes.

- [ ] **Step 2: Run focused tests and observe RED**

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_accounting_report_workbook.py -q
```

Expected: failure because the writer is missing.

- [ ] **Step 3: Implement workbook generation**

Use one workbook with formulas referencing quoted sheet names:

```python
summary_sheet["B6"] = "='核心财务报表'!B8"
summary_sheet["B6"].number_format = '#,##0.00;[Red](#,##0.00);-'
```

Use visible section headers, restrained fills, explicit units, no decorative 3D charts, and no merged cells in calculation blocks. Set workbook calculation mode to automatic if supported by the installed `openpyxl`.

- [ ] **Step 4: Add an independent workbook audit helper**

Implement `_audit_generated_workbook(path)` to reopen the saved workbook and verify:

- exact sheets;
- nonempty required ranges;
- formulas only reference known sheets/ranges;
- all required checks exist;
- workbook ZIP can be reopened;
- file SHA-256 is computed after final close.

Delete the incomplete destination on failure.

- [ ] **Step 5: Run workbook tests**

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_accounting_report_workbook.py -q
.venv\Scripts\python.exe -m ruff check app/accounting_reports/workbook.py tests/test_accounting_report_workbook.py
```

Expected: PASS.

- [ ] **Step 6: Commit only if separately authorized**

```powershell
git add backend/app/accounting_reports/workbook.py backend/tests/test_accounting_report_workbook.py
git commit -m "feat: generate accounting management workbook"
```

### Task 5: Add owner-scoped artifact lifecycle and protected download

**Files:**
- Create: `backend/app/accounting_reports/storage.py`
- Create: `backend/app/accounting_reports/session.py`
- Create: `backend/app/api/report_artifacts.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_accounting_report_storage.py`
- Test: `backend/tests/test_accounting_report_session.py`
- Test: `backend/tests/test_report_artifacts_api.py`

**Interfaces:**
- Produces: `AccountingReportSession(owner_user_id, run_id, source_dir, artifact_dir, db_path)`.
- Produces: `session.maybe_generate(department, bureau, decree_text) -> str | None`, returning only a bounded prompt summary.
- Produces: `session.publish(reply_id: str) -> tuple[PublishedReportArtifact, ...]`.
- Produces: `session.abort() -> None`.
- Produces: `get_published_artifact(artifact_id, owner_user_id, db_path)`.
- Produces: `GET /api/v1/report-artifacts/{artifact_id}/download`.

- [ ] **Step 1: Write failing storage lifecycle tests**

Assert:

- new rows start `PENDING`;
- owner, run ID, report period, source hash set, and file hash are required;
- `publish(reply_id)` atomically moves the file to its final opaque ID and sets `PUBLISHED`;
- publishing the same run/reply is idempotent;
- a second owner cannot read metadata or bytes;
- `abort()` removes only pending files for that run;
- published files referenced by a reply are never removed by pending cleanup;
- SQLite constraints reject duplicate official artifacts for the same `(owner_user_id, reply_id, report_type)`.

- [ ] **Step 2: Write failing authenticated API tests**

Follow existing `CurrentUser` patterns. Assert 401 without a session, 404 for unknown/cross-owner IDs, 200 for the owner, and headers:

```text
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename*=UTF-8''...
X-Content-Type-Options: nosniff
Cache-Control: private, no-store
```

The route takes only `artifact_id`; it never accepts an owner ID or file path.

- [ ] **Step 3: Implement storage schema and filesystem safety**

Create a dedicated runtime database, defaulting to `backend/data/report_artifacts.sqlite3`, and files under `backend/data/report_artifacts/`. Validate resolved paths stay under the configured artifact root. Use write-to-temporary + `Path.replace()` for final publication.

The metadata table includes:

```sql
artifact_id TEXT PRIMARY KEY,
owner_user_id TEXT NOT NULL,
run_id TEXT NOT NULL,
reply_id TEXT,
report_type TEXT NOT NULL,
display_name TEXT NOT NULL,
period_start INTEGER NOT NULL,
period_end INTEGER NOT NULL,
source_hashes_json TEXT NOT NULL,
file_sha256 TEXT NOT NULL,
state TEXT NOT NULL CHECK (state IN ('PENDING', 'PUBLISHED', 'ABORTED')),
created_at TEXT NOT NULL,
published_at TEXT
```

- [ ] **Step 4: Implement the request-scoped session**

`maybe_generate` begins with the exact boundary:

```python
if (department, bureau) != ("户部", "会计司"):
    return None
intent = detect_accounting_report_intent(decree_text)
if not intent.requested:
    return None
```

It loads, analyzes, creates one pending workbook, records the pending artifact, and returns `summary.to_model_prompt()` only. Repeated calls within the same session return the same summary/artifact and do not regenerate.

- [ ] **Step 5: Implement protected streaming download**

Resolve the published artifact by `(artifact_id, current_user.id)`, confirm its hash before serving, and return `FileResponse` with the fixed MIME and safe content disposition. Storage/hash errors map to a stable 503 without paths or row data.

- [ ] **Step 6: Run focused tests**

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_accounting_report_storage.py tests/test_accounting_report_session.py tests/test_report_artifacts_api.py -q
.venv\Scripts\python.exe -m ruff check app/accounting_reports app/api/report_artifacts.py tests/test_accounting_report_storage.py tests/test_accounting_report_session.py tests/test_report_artifacts_api.py
```

Expected: PASS.

- [ ] **Step 7: Commit only if separately authorized**

```powershell
git add backend/app/accounting_reports backend/app/api/report_artifacts.py backend/app/main.py backend/tests/test_accounting_report_storage.py backend/tests/test_accounting_report_session.py backend/tests/test_report_artifacts_api.py
git commit -m "feat: store and serve accounting report artifacts"
```

### Task 6: Thread report generation through the existing decree graph

**Files:**
- Modify: `backend/app/agents/bureaus/agent.py`
- Modify: `backend/app/agents/ministries/agent.py`
- Modify: `backend/app/agents/junjichu/agent.py`
- Modify: `backend/app/agents/chancellor/graph.py`
- Modify: `backend/app/agents/synthesis_failures.py`
- Modify: `backend/tests/test_bureaus_agent.py`
- Modify: `backend/tests/test_ministries_agent.py`
- Modify: `backend/tests/test_junjichu_agent.py`
- Modify: `backend/tests/test_chancellor_graph.py`

**Interfaces:**
- Consumes: optional `AccountingReportSession`.
- Preserves: `invoke_bureau_agent(...) -> str` and `MinistryOpinion`/`BureauOpinion` response shapes.
- Adds keyword-only `report_session: AccountingReportSession | None = None` to `invoke_bureau_agent`, `invoke_ministry_agent`, `invoke_junjichu_agent`, and `build_chancellor_graph`. The compiled graph nodes capture this request-scoped object from the graph factory closure and forward the same object; it is not placed in serialized graph state.

- [ ] **Step 1: Add the trigger matrix at the bureau boundary**

Add tests proving:

```python
cases = [
    ("户部", "会计司", "生成2020至2025年财务报表", 1),
    ("户部", "会计司", "分析费用变化", 0),
    ("户部", "预算司", "生成财务报表", 0),
    ("工部", "技术司", "生成财务报表", 0),
]
```

The final integer is expected `session.maybe_generate` calls. Also assert the bounded summary is appended to the accounting prompt while raw rows, paths, customer names, and workbook bytes are absent.

- [ ] **Step 2: Run the bureau test and observe RED**

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_bureaus_agent.py -q
```

Expected: new tests fail because `report_session` is unsupported.

- [ ] **Step 3: Add explicit optional session forwarding**

In `invoke_bureau_agent`, call:

```python
report_summary = (
    report_session.maybe_generate(department, bureau, decree_text)
    if report_session is not None
    else None
)
```

Append only `report_summary` to the user message under `会计司确定性报表摘要`. Do not change the strict model output from `{"opinion": ...}`.

Pass the same object through ministry single and Junjichu multi paths. Do not create sessions inside agent packages and do not use a module global/context variable.

- [ ] **Step 4: Add graph propagation tests**

Assert:

- single 户部 can reach 会计司 and generates once;
- multi that includes 户部 and another department generates once;
- other ministries receive the session but cannot generate;
- report failure is wrapped as a sanitized graph failure with stage `report`;
- existing call order and model call counts are unchanged except local deterministic report work.

- [ ] **Step 5: Run graph/ministry regressions**

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_bureaus_agent.py tests/test_ministries_agent.py tests/test_junjichu_agent.py tests/test_chancellor_graph.py -q
.venv\Scripts\python.exe -m ruff check app/agents tests/test_bureaus_agent.py tests/test_ministries_agent.py tests/test_junjichu_agent.py tests/test_chancellor_graph.py
```

Expected: PASS.

- [ ] **Step 6: Commit only if separately authorized**

```powershell
git add backend/app/agents backend/tests/test_bureaus_agent.py backend/tests/test_ministries_agent.py backend/tests/test_junjichu_agent.py backend/tests/test_chancellor_graph.py
git commit -m "feat: trigger reports from accounting bureau"
```

### Task 7: Publish artifacts only after the single Shiguan reply succeeds

**Files:**
- Modify: `backend/app/api/decrees.py`
- Modify: `backend/tests/test_decrees_api.py`
- Modify: `backend/tests/test_shiguan_archive_decree.py`

**Interfaces:**
- Adds response model `ReportArtifactResponse`.
- Adds `artifacts: list[ReportArtifactResponse] = Field(default_factory=list)` to `ChancellorDecreeResponse`.
- Preserves every existing response field and the archive-first business boundary.

- [ ] **Step 1: Add failing API lifecycle tests**

Assert:

- a normal decree returns `"artifacts": []`;
- a report decree publishes exactly one artifact after `archive_result.archived is True`;
- response fields use snake case:

```json
{
  "artifact_id": "opaque-id",
  "kind": "ACCOUNTING_MANAGEMENT_REPORT_XLSX",
  "display_name": "2020-2025年管理层综合财务报告.xlsx",
  "period_start": 2020,
  "period_end": 2025,
  "generated_at": "2026-07-29T..."
}
```

- explicit report generation failure returns sanitized 502 and calls `abort()`;
- Shiguan archive failure prevents publication and calls `abort()`;
- publication failure does not return a success response;
- non-report existing single/multi fixtures remain valid.

- [ ] **Step 2: Run decree tests and observe RED**

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_decrees_api.py -q
```

Expected: new artifact assertions fail.

- [ ] **Step 3: Create and pass one session per authenticated request**

At the start of the endpoint body, create:

```python
report_session = build_accounting_report_session(
    owner_user_id=current_user.id,
    run_id=secrets.token_hex(16),
)
```

Change the API helper to:

```python
def get_chancellor_graph(*, report_session: AccountingReportSession | None = None):
    return build_chancellor_graph(
        lifecycle_observer=_lifecycle_observer_context.get(),
        report_session=report_session,
    )
```

Then call exactly `get_chancellor_graph(report_session=report_session)`. Do not put the session in the `graph.invoke(...)` payload or `ChancellorGraphState`.

- [ ] **Step 4: Publish only after archive success**

After `archive_chancellor_decree`:

```python
if report_session.has_pending:
    if not archive_result.archived or not archive_result.reply_id:
        raise AccountingReportPublicationError("reply_archive_required")
    published = report_session.publish(archive_result.reply_id)
    response = response.model_copy(
        update={"artifacts": [ReportArtifactResponse.from_domain(item) for item in published]}
    )
```

In every exception path call `report_session.abort()` before re-raising. Do not change the existing rule that the HTTP response does not claim Shiguan archival success.

- [ ] **Step 5: Run API and Shiguan regressions**

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_decrees_api.py tests/test_shiguan_archive_decree.py -q
.venv\Scripts\python.exe -m ruff check app/api/decrees.py tests/test_decrees_api.py tests/test_shiguan_archive_decree.py
```

Expected: PASS.

- [ ] **Step 6: Commit only if separately authorized**

```powershell
git add backend/app/api/decrees.py backend/tests/test_decrees_api.py backend/tests/test_shiguan_archive_decree.py
git commit -m "feat: attach reports to archived decree replies"
```

### Task 8: Add strict frontend artifact parsing and protected BFF download

**Files:**
- Modify: `frontend/src/lib/backendClient.ts`
- Modify: `frontend/src/lib/backendClient.test.ts`
- Modify: `frontend/src/app/api/decrees/chancellor/route.ts`
- Modify: `frontend/src/app/api/decrees/chancellor/route.test.ts`
- Create: `frontend/src/app/api/report-artifacts/[id]/route.ts`
- Create: `frontend/src/app/api/report-artifacts/[id]/route.test.ts`

**Interfaces:**
- Produces frontend `ReportArtifact`.
- Produces `SubmitDecreeData.artifacts: ReportArtifact[]`.
- Produces `GET /api/report-artifacts/{encoded-id}` same-origin BFF.

- [ ] **Step 1: Add failing strict parser tests**

Define:

```ts
export interface ReportArtifact {
  artifactId: string;
  kind: "ACCOUNTING_MANAGEMENT_REPORT_XLSX";
  displayName: string;
  periodStart: number;
  periodEnd: number;
  generatedAt: string;
}
```

Test an empty list, one valid artifact, duplicate IDs, unknown kind, blank display name, noninteger years, reversed years, unexpected fields, and missing `artifacts`. For compatibility, missing `artifacts` maps to `[]`; a present malformed list rejects the whole success response.

- [ ] **Step 2: Add failing BFF download tests**

Assert:

- no `courtos_session` cookie returns 401 without backend call;
- invalid/blank/path-like ID returns 400;
- valid ID is URL-encoded and Bearer session is forwarded;
- only successful XLSX content is streamed;
- backend 401/404/503 map to stable sanitized responses;
- neither backend URL nor session appears in the browser response.

- [ ] **Step 3: Run focused tests and observe RED**

```powershell
cd frontend
node --test src/lib/backendClient.test.ts src/app/api/decrees/chancellor/route.test.ts "src/app/api/report-artifacts/[id]/route.test.ts"
```

Expected: new artifact cases fail.

- [ ] **Step 4: Implement strict parsing and BFF streaming**

The decree BFF returns camel-case page data with `artifacts`. The download route reads the HttpOnly cookie, calls `backendClient`, forwards only the fixed XLSX headers, and never buffers/logs workbook contents beyond what the framework requires.

- [ ] **Step 5: Run focused frontend tests**

```powershell
cd frontend
node --test src/lib/backendClient.test.ts src/app/api/decrees/chancellor/route.test.ts "src/app/api/report-artifacts/[id]/route.test.ts"
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit only if separately authorized**

```powershell
git add frontend/src/lib/backendClient.ts frontend/src/lib/backendClient.test.ts frontend/src/app/api/decrees/chancellor frontend/src/app/api/report-artifacts
git commit -m "feat: proxy accounting report downloads"
```

### Task 9: Render the Excel download inside the successful 上书房 reply

**Files:**
- Modify: `frontend/src/app/study/decreeStatus.ts`
- Modify: `frontend/src/app/study/decreeStatus.test.ts`
- Modify: `frontend/src/app/study/studySubmission.ts`
- Modify: `frontend/src/app/study/studySubmission.test.ts`
- Modify: `frontend/src/features/study-visual/studyWorkspaceState.ts`
- Modify: `frontend/src/features/study-visual/studyWorkspaceState.test.ts`
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.tsx`
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.module.css`
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`

**Interfaces:**
- Consumes: `ReportArtifact[]`.
- Renders: one accessible anchor per artifact with `href=/api/report-artifacts/${encodeURIComponent(artifactId)}`.

- [ ] **Step 1: Add failing state propagation tests**

Extend every success fixture with `artifacts`. Assert ordinary replies preserve `[]`, and report replies retain the exact artifact metadata through:

`backendClient → BFF body → parseChancellorSuccessResponse → studySubmission → studyWorkspaceState`.

- [ ] **Step 2: Add failing source/UI contract tests**

Assert the successful reply contains:

```tsx
<a
  data-testid={`decree-artifact-${artifact.artifactId}`}
  href={`/api/report-artifacts/${encodeURIComponent(artifact.artifactId)}`}
>
  下载财务报告
</a>
```

Also assert the link appears only when artifacts exist, includes the display name/period in accessible text, and is inside the existing successful `EdictStage`.

- [ ] **Step 3: Run focused tests and observe RED**

```powershell
cd frontend
node --test src/app/study/decreeStatus.test.ts src/app/study/studySubmission.test.ts src/features/study-visual/studyWorkspaceState.test.ts src/features/study-visual/DevStudyWorkspace.test.ts
```

Expected: new artifact assertions fail.

- [ ] **Step 4: Implement propagation and presentation**

Keep the download affordance in the existing reply content after the three recommendations. Use a text label, not an icon-only control. Do not fetch the file until the user clicks.

- [ ] **Step 5: Run focused tests, lint, and typecheck**

```powershell
cd frontend
node --test src/app/study/decreeStatus.test.ts src/app/study/studySubmission.test.ts src/features/study-visual/studyWorkspaceState.test.ts src/features/study-visual/DevStudyWorkspace.test.ts
npm run lint
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit only if separately authorized**

```powershell
git add frontend/src/app/study frontend/src/features/study-visual
git commit -m "feat: show accounting report in decree reply"
```

### Task 10: Complete cross-layer regression, privacy audit, and documentation

**Files:**
- Modify: `backend/AGENTS.md`
- Modify: `frontend/AGENTS.md`
- Modify: `ARCHITECTURE.md`
- Modify: `docs/product/tasks/2026-07-29-accounting-bureau-management-report.md`
- Test: existing backend/frontend/integration suites

**Interfaces:**
- Produces: fresh delivery evidence and an implementation report; no new runtime interface.

- [ ] **Step 1: Add a cross-layer synthetic success fixture**

Use only synthetic amounts and temporary paths. Assert one full single-route accounting report request:

- selects 户部/会计司;
- generates and publishes exactly one workbook;
- archives exactly one `REPLY`;
- returns one artifact;
- downloads for the owner;
- rejects a second user;
- workbook representative totals tie to the synthetic source.

Add a multi-route fixture proving the same single report artifact survives a 军机处 route without changing department order.

- [ ] **Step 2: Run security/privacy scans**

Run:

```powershell
rg -n "陕西铭硕|中国银行4233|建设银行0489" backend/tests frontend/src docs/product/tasks/2026-07-29-accounting-bureau-management-report.md docs/superpowers/plans/2026-07-29-accounting-bureau-management-report.md
rg -n "data/财务数据资料|财务数据资料" backend/tests frontend/src
```

Expected: no real account/customer data in implementation tests or frontend source; only approved high-level source-directory documentation may mention the directory.

- [ ] **Step 3: Run complete backend verification**

```powershell
cd backend
.venv\Scripts\python.exe -m ruff check .
.venv\Scripts\python.exe -m pytest -q
```

Expected: all pass. Record exact counts and warnings.

- [ ] **Step 4: Run complete frontend verification**

```powershell
cd frontend
npm test
npm run lint
npm run typecheck
npm run build
```

Expected: all pass.

- [ ] **Step 5: Run repository governance checks**

```powershell
cd ..
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
git diff --check
```

Expected: all pass.

- [ ] **Step 6: Perform manual local acceptance without real model/network**

Start backend and frontend with an injected/fake graph and temporary synthetic accounting source directory. Log in as user A, submit the synthetic report decree, verify the reply link downloads a valid workbook, then verify user B receives 404 for the same opaque artifact ID. Do not use the real 12 workbooks, DeepSeek, MCP, public network, or production databases in automated acceptance.

- [ ] **Step 7: Update architecture and task evidence**

Document:

- exact trigger boundary;
- dependencies and runtime paths;
- seven-sheet workbook contract;
- owner isolation/download route;
- archive-before-publish lifecycle;
- actual commands, PASS/FAIL, warnings, unrun real-data/model checks, and remaining risks.

Set the task to `Implemented` only after every required automated check passes. Leave `Acceptance Review` as `Pending` until Codex product acceptance.

- [ ] **Step 8: Final commit only if separately authorized**

Before any Git write, print and verify the absolute workspace path, branch, HEAD, and `git status` as required by root `AGENTS.md`. Then:

```powershell
git add backend frontend ARCHITECTURE.md docs/product/tasks/2026-07-29-accounting-bureau-management-report.md docs/superpowers/specs/2026-07-29-accounting-bureau-management-report-design.md docs/superpowers/plans/2026-07-29-accounting-bureau-management-report.md
git commit -m "feat: add accounting management report artifacts"
```

Do not stage `data/财务数据资料/**`, `backend/data/**`, generated workbooks, credentials, logs, screenshots containing financial data, or unrelated user changes.
