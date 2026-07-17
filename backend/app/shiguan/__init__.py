"""Public interface for the 史馆 (Shiguan / Hall of Records) domain.

A dedicated, deterministic domain service independent of ``app.agents.**``,
``app.api.**`` and ``app.langgraph_runtime`` -- no LLM calls, no HTTP
concerns. Persists five archive types (``MEMORIAL``/``DECISION``/
``TASK_RESULT``/``KNOWLEDGE``/``PUBLICITY``) to a local sqlite database
(``app.shiguan.db``), exposes strict CRUD + statistics
(``app.shiguan.storage``), explainable old-case recall
(``app.shiguan.recall``) and best-effort automatic archival of chancellor
decrees (``app.shiguan.archive_decree``).

HTTP wiring (request/response contracts, route registration, error status
mapping) is intentionally out of scope here -- see a later module's
``app/api/shiguan.py``.
"""

from app.shiguan.archive_decree import archive_chancellor_decree
from app.shiguan.errors import (
    ArchiveNotFoundError,
    ArchiveValidationError,
    ShiguanError,
    ShiguanStorageError,
)
from app.shiguan.models import (
    Archive,
    ArchiveCreate,
    ArchiveType,
    Evidence,
    RealityLabel,
    ReviewStatus,
    ReviewStatusValue,
    Statistics,
)
from app.shiguan.recall import (
    RecallContext,
    RecallMatch,
    find_similar_archives,
    safe_recall_context_for_department,
)
from app.shiguan.storage import (
    create_archive,
    get_archive,
    get_statistics,
    list_archives,
    upsert_review_status,
)

__all__ = [
    "Archive",
    "ArchiveCreate",
    "ArchiveNotFoundError",
    "ArchiveType",
    "ArchiveValidationError",
    "Evidence",
    "RealityLabel",
    "RecallContext",
    "RecallMatch",
    "ReviewStatus",
    "ReviewStatusValue",
    "ShiguanError",
    "ShiguanStorageError",
    "Statistics",
    "archive_chancellor_decree",
    "create_archive",
    "find_similar_archives",
    "get_archive",
    "get_statistics",
    "list_archives",
    "safe_recall_context_for_department",
    "upsert_review_status",
]
