"""Public source-layer contracts and adapters."""

from app.jinyiwei.sources.base import (
    EvidenceExtractor,
    EvidenceSource,
    SourceDocument,
    SourceQuery,
    SourceResult,
)
from app.jinyiwei.sources.mcp import McpSource
from app.jinyiwei.sources.public_api import PublicApiSource
from app.jinyiwei.sources.public_web import (
    PublicWebSource,
    SearchDiscovery,
    SearchProvider,
    SearchProviderUnavailableError,
    WikimediaSearchProvider,
)
from app.jinyiwei.sources.shiguan import ShiguanSource

__all__ = [
    "EvidenceExtractor",
    "EvidenceSource",
    "McpSource",
    "PublicApiSource",
    "PublicWebSource",
    "SearchDiscovery",
    "SearchProvider",
    "SearchProviderUnavailableError",
    "ShiguanSource",
    "SourceDocument",
    "SourceQuery",
    "SourceResult",
    "WikimediaSearchProvider",
]
