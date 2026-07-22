"""R0-W03 摄取阈值常量——OQ-02/OQ-06 冻结值。

以下数值均记录在
`.harness/changes/docs-r0-w03-secure-ingest-approval-20260722-20260722/owner_approval/exact-h-approval.md`，
经 Product Owner 通过 AskUserQuestion 显式确认，改动需要同等级别的重新批准，不能顺手改。
"""

from __future__ import annotations

# OQ-02（已批准，文本无依据，纯推断的占位值——真实用量出现后可申请调整）
MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB
MAX_DOCX_PAGES = 100  # 仅当 docProps/app.xml 缓存了 <Pages> 时才检查；读不到不硬拒

# zip-bomb 启发式阈值（我的推断，非 OQ-02 本身，同样未经文本依据，随附批准）
MAX_ZIP_MEMBER_COUNT = 1000
MAX_ZIP_COMPRESSION_RATIO = 100  # file_size / max(compress_size, 1)
MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES = 500 * 1024 * 1024  # 500 MB

# 下载票据 TTL（我的推断，未经文本依据）
DOWNLOAD_TICKET_TTL_SECONDS = 5 * 60  # 5 分钟，单次使用
