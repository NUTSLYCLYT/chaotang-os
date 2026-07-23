"""Approved, query-only MCP capability registry."""

from .client import McpClient, McpClientError, McpToolResult
from .contracts import (
    DiscoveredTool,
    McpAccessPolicy,
    McpServerConfig,
    McpSourceKind,
    McpToolApproval,
    McpToolMapping,
    McpTransport,
    ToolEffect,
)
from .credentials import (
    CredentialProvider,
    EnvCredentialProvider,
    McpCredentialError,
    PinnedOAuthRefresh,
    SensitiveHeaders,
)
from .mapping import DeterministicMcpMapper, McpMappingError
from .registry import (
    McpRegistry,
    McpRegistryError,
    approval_fingerprint,
    load_default_registry,
)

__all__ = [
    "DiscoveredTool",
    "McpAccessPolicy",
    "McpClient",
    "McpClientError",
    "McpMappingError",
    "McpCredentialError",
    "PinnedOAuthRefresh",
    "McpRegistry",
    "McpRegistryError",
    "McpServerConfig",
    "McpSourceKind",
    "McpToolApproval",
    "McpToolMapping",
    "McpToolResult",
    "DeterministicMcpMapper",
    "McpTransport",
    "ToolEffect",
    "CredentialProvider",
    "EnvCredentialProvider",
    "SensitiveHeaders",
    "approval_fingerprint",
    "load_default_registry",
]
