"""Regression guard: test runs must never resolve to the real control-plane DB.

On 2026-07-17 a bare ``pytest`` silently wrote the real
``backend/var/data/fengqun.db`` because conftest isolated DB_URL and the tenant
sqlite path but not the runtime_paths root.  resolve_runtime_paths() derives its
data dir from FENGQUN_RUNTIME_ROOT (default backend/var); conftest now binds
that to a temp dir.  This test fails closed if that isolation is removed.
"""

from pathlib import Path

from src.runtime_paths import resolve_runtime_paths

_REAL_VAR = (Path(__file__).resolve().parents[1] / "var").resolve()


def test_runtime_paths_isolated_from_real_control_plane() -> None:
    resolved = resolve_runtime_paths().data.resolve()
    real = (_REAL_VAR / "data").resolve()
    assert resolved != real, (
        "FENGQUN_RUNTIME_ROOT is not isolated during tests — a bare pytest "
        "would write the REAL control-plane DB. conftest must setdefault it to "
        "a temp dir."
    )


# Every module that captures resolve_runtime_paths() into a module-level constant
# at import time.  Each freezes whatever FENGQUN_RUNTIME_ROOT was when it first
# imported, so ANY of them pointing at the real backend/var means bare pytest
# would pollute it.  Checking only one (e.g. kpi_tracker) is false-green: a
# different module could freeze to the real path while that one is isolated.
_FROZEN_RUNTIME_PATHS = [
    ("kpi_tracker", "_KPI_DB_PATH"),
    ("memory_store", "MEMORY_DIR"),
    ("direct_feedback", "FEEDBACK_DIR"),
    ("chaotang_store", "_DATA_ROOT"),
    ("repair", "REPAIRS_DIR"),
    ("sqlite_vec_rag", "DEFAULT_DB"),
    ("typed_memory", "MEMORY_BASE"),
    ("user_preference", "DEFAULT_PREFERENCE_DIR"),
    ("ima_knowledge_store", "_METADATA_DIR"),
    ("chaotang_launch_loop", "DEFAULT_ARCHIVE_PATH"),
]


def test_import_time_frozen_paths_isolated_from_real_var() -> None:
    """In-process check: with conftest having set FENGQUN_RUNTIME_ROOT, none of the
    known import-time frozen-constant modules resolve under the real backend/var.

    HONEST SCOPE: this runs after conftest, so these modules always see the temp
    root here — it cannot reproduce the "module imported before conftest" ordering
    bug (impossible in-process).  What it *does* catch: conftest's env-set being
    removed or pointed at the real var (then every frozen path lands under real
    var and this fails).  The load-bearing-ness of the env-set is proven
    separately by test_bare_process_without_env_freezes_to_real_var below.
    """
    import importlib

    polluting = []
    for mod_name, attr in _FROZEN_RUNTIME_PATHS:
        module = importlib.import_module(f"src.{mod_name}")
        frozen = Path(getattr(module, attr)).resolve()
        if frozen == _REAL_VAR or _REAL_VAR in frozen.parents:
            polluting.append(f"{mod_name}.{attr} -> {frozen}")

    assert not polluting, (
        "import-time frozen runtime paths under the REAL backend/var — conftest's "
        "FENGQUN_RUNTIME_ROOT isolation is removed or misconfigured, so bare "
        f"pytest would pollute the real control-plane volume: {polluting}"
    )


def test_bare_process_without_env_freezes_to_real_var() -> None:
    """Anti-false-green: prove the conftest env-set is load-bearing, not that the
    in-process check is vacuously true.  The in-process test above always runs
    after conftest set the temp root, so on its own it could be green simply
    because isolation happens to be unnecessary.  Here we spawn a CLEAN subprocess
    with FENGQUN_RUNTIME_ROOT unset and confirm a frozen-constant module really
    does freeze under the real backend/var — i.e. the pollution risk is real and
    conftest setting the env before any import is what prevents it.  (The child
    only prints the path; it does not write, so no pollution occurs.)  If this
    ever stops holding, runtime_paths gained a safe default and the conftest hack
    should be re-evaluated.
    """
    import os
    import subprocess
    import sys

    backend = Path(__file__).resolve().parents[1]
    clean_env = {
        k: v
        for k, v in os.environ.items()
        if k not in ("FENGQUN_RUNTIME_ROOT", "FENGQUN_VAR_DIR")
    }
    proc = subprocess.run(
        [sys.executable, "-c", "from src import kpi_tracker; print(kpi_tracker._KPI_DB_PATH)"],
        cwd=str(backend),
        env=clean_env,
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stderr
    frozen = Path(proc.stdout.strip()).resolve()
    assert _REAL_VAR in frozen.parents, (
        f"expected a no-env import to freeze under the real var {_REAL_VAR}, got "
        f"{frozen}. If runtime_paths gained a safe default, the conftest "
        "FENGQUN_RUNTIME_ROOT isolation may no longer be load-bearing — re-evaluate."
    )
