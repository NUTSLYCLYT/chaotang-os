# 史馆运行库 schema 恢复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让本地史馆运行库能被显式预检、备份、迁移并验证，避免 schema 漂移导致的假绿。

**Architecture:** 在 `app.shiguan.maintenance` 中封装只读预检、受限迁移和 JSON 命令输出；复用现有 `db.migrate_v2_to_v3()` 与 `storage.list_archives()`，不把迁移接入请求或服务启动。命令层只解析参数和选择退出码，业务层不输出档案正文。

**Tech Stack:** Python 3.11、标准库 sqlite3/shutil/argparse/json、pytest、Ruff。

## Global Constraints

- 只允许 v2 到 v3 的显式迁移；普通请求和启动路径继续 fail-closed。
- 迁移前必须创建不覆盖的相邻备份；预检与输出不得暴露档案正文或证据正文。
- 测试只使用 `tmp_path` 数据库；不得访问网络、凭据或真实运行库。
- 不新增 HTTP API、第三方依赖或 `cli.py`。

---

### Task 1: 预检与受限迁移服务

**Files:**
- Create: `backend/app/shiguan/maintenance.py`
- Modify: `backend/tests/test_shiguan_migrations.py`

**Interfaces:**
- Produces: `inspect_runtime_database(path: Path) -> RuntimeDatabaseReport`
- Produces: `migrate_runtime_v2_to_v3(path: Path) -> RuntimeDatabaseReport`
- Consumes: `db.migrate_v2_to_v3(path)` and `storage.list_archives(db_path=path)`.

- [x] **Step 1: Write the failing tests**

```python
def test_runtime_migration_backs_up_v2_and_reads_archives(tmp_path):
    path = tmp_path / "shiguan.sqlite3"
    db.get_connection(path).close()
    connection = sqlite3.connect(path)
    connection.execute("DROP TABLE archive_evidence_references")
    connection.execute("PRAGMA user_version = 2")
    connection.commit()
    connection.close()

    report = maintenance.migrate_runtime_v2_to_v3(path)

    assert report.ready is True
    assert report.migrated is True
    assert path.with_name("shiguan.sqlite3.v2-backup").exists()
```

- [x] **Step 2: Run the focused test to verify RED**

Run: `backend\.venv\Scripts\python.exe -m pytest backend\tests\test_shiguan_migrations.py -k runtime_migration -v`

Expected: FAIL because `app.shiguan.maintenance` does not exist.

- [x] **Step 3: Implement the minimal service**

```python
def migrate_runtime_v2_to_v3(path: Path) -> RuntimeDatabaseReport:
    before = inspect_runtime_database(path)
    if before.version != 2 or not before.integrity_ok:
        raise ShiguanStorageError("史馆运行库不满足 v2 迁移条件")
    backup = path.with_name(f"{path.name}.v2-backup")
    if backup.exists():
        raise ShiguanStorageError("史馆运行库备份已存在")
    shutil.copy2(path, backup)
    db.migrate_v2_to_v3(path)
    after = inspect_runtime_database(path)
    storage.list_archives(db_path=path)
    return replace(after, migrated=True, backup_path=backup)
```

- [x] **Step 4: Run focused tests to verify GREEN**

Run: `backend\.venv\Scripts\python.exe -m pytest backend\tests\test_shiguan_migrations.py -k 'runtime_migration or runtime_preflight' -v`

Expected: PASS.

### Task 2: 命令入口与回归测试

**Files:**
- Modify: `backend/app/shiguan/maintenance.py`
- Modify: `backend/tests/test_shiguan_migrations.py`

**Interfaces:**
- Produces: `python -m app.shiguan.maintenance --check [--database PATH]`
- Produces: `python -m app.shiguan.maintenance --migrate-v2-to-v3 [--database PATH]`

- [x] **Step 1: Write the failing command test**

```python
def test_maintenance_check_emits_desensitized_json(tmp_path):
    path = tmp_path / "shiguan.sqlite3"
    db.get_connection(path).close()
    result = subprocess.run(
        [sys.executable, "-m", "app.shiguan.maintenance", "--check", "--database", str(path)],
        capture_output=True, text=True, check=False,
    )
    payload = json.loads(result.stdout)
    assert result.returncode == 0
    assert payload["ready"] is True
    assert "archives" not in result.stdout
```

- [x] **Step 2: Run the command test to verify RED**

Run: `backend\.venv\Scripts\python.exe -m pytest backend\tests\test_shiguan_migrations.py -k maintenance_check -v`

Expected: FAIL because the command parser is absent.

- [x] **Step 3: Add argparse command dispatch**

```python
parser.add_mutually_exclusive_group(required=True)
actions.add_argument("--check", action="store_true")
actions.add_argument("--migrate-v2-to-v3", action="store_true")
parser.add_argument("--database", type=Path, default=db._DEFAULT_DB_PATH)
```

Print `RuntimeDatabaseReport` as JSON; return zero only for a ready `--check` result or successful migration, otherwise print the same desensitized report to stderr and return one.

- [x] **Step 4: Run focused tests to verify GREEN**

Run: `backend\.venv\Scripts\python.exe -m pytest backend\tests\test_shiguan_migrations.py -k maintenance -v`

Expected: PASS.

### Task 3: 文档、实际运行库恢复与验证

**Files:**
- Create: `docs/product/tasks/2026-07-24-shiguan-runtime-schema-recovery.md`
- Modify: `docs/failures/2026-07-24-shiguan-runtime-schema-false-green.md`

- [x] **Step 1: Record the approved task and explicit operational sequence**

State the allowed paths, fail-closed rule, backup requirement, `--check` and `--migrate-v2-to-v3` commands, and acceptance criteria.

- [x] **Step 2: Verify code and harness offline**

Run:

```powershell
Set-Location backend; .venv\Scripts\python.exe -m ruff check .; .venv\Scripts\python.exe -m pytest
Set-Location ..; node scripts/check_harness.mjs; node scripts/check_harness.mjs --self-test; node .agents/hooks/check-harness.mjs --self-test
git diff --check
```

Expected: all commands PASS.

- [x] **Step 3: Preflight and migrate the actual runtime library**

Run from `backend/`:

```powershell
.venv\Scripts\python.exe -m app.shiguan.maintenance --check
.venv\Scripts\python.exe -m app.shiguan.maintenance --migrate-v2-to-v3
.venv\Scripts\python.exe -m app.shiguan.maintenance --check
```

Expected: first check reports healthy v2 but not ready, migration creates `data/shiguan.sqlite3.v2-backup`, final check reports healthy/ready v3.

- [x] **Step 4: Perform a local HTTP readback**

Start uvicorn on `127.0.0.1`, call `GET /api/v1/shiguan/archives`, then stop the process. Confirm HTTP 200 and a JSON response without modifying the archive data.
