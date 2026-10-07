"""Immutable registry for explicitly approved public JSON APIs."""

from __future__ import annotations

import json
import re
from collections import Counter
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from types import MappingProxyType
from urllib.parse import urlencode, urlsplit

from app.jinyiwei.models import (
    _ISO_3166_ALPHA2_CODES,
    EvidenceQuality,
    FactCategory,
    RequiredFact,
)

_QUERY_KEY = re.compile(r"^[A-Za-z][A-Za-z0-9_.-]{0,63}$")
GLOBAL_COVERAGE = "GLOBAL"


class PublicAccessPolicy(StrEnum):
    """Machine-enforced admission policy for approved public connectors."""

    FREE_PUBLIC_NO_CREDENTIALS = "FREE_PUBLIC_NO_CREDENTIALS"


def _normalize_coverage(value: str | tuple[str, ...]) -> str | tuple[str, ...]:
    if value == GLOBAL_COVERAGE:
        return GLOBAL_COVERAGE
    if (
        not isinstance(value, tuple)
        or not value
        or any(not isinstance(code, str) for code in value)
    ):
        raise ValueError("coverage must be GLOBAL or nonempty ISO 3166-1 alpha-2 codes")
    normalized = tuple(" ".join(code.split()).upper() for code in value)
    if (
        any(code not in _ISO_3166_ALPHA2_CODES for code in normalized)
        or len(normalized) != len(set(normalized))
    ):
        raise ValueError("coverage must contain unique ISO 3166-1 alpha-2 codes")
    return normalized


def _normalize_timestamp(value: str, field_name: str) -> str:
    normalized = " ".join(value.split())
    if not normalized:
        raise ValueError(f"{field_name} must not be blank")
    candidate = normalized[:-1] + "+00:00" if normalized.endswith("Z") else normalized
    try:
        parsed = datetime.fromisoformat(candidate)
    except ValueError as exc:
        raise ValueError(f"{field_name} must be an ISO-8601 timestamp") from exc
    if parsed.utcoffset() is None:
        raise ValueError(f"{field_name} must include a timezone offset")
    return normalized


@dataclass(frozen=True, slots=True)
class PublicApiRecord:
    """One deterministic record produced by connector-owned parsing code."""

    title: str
    text: str
    coverage: str | tuple[str, ...]
    license_note: str
    as_of: str | None = None
    published_at: str | None = None
    metadata: Mapping[str, object] = MappingProxyType({})

    def __post_init__(self) -> None:
        for name in ("title", "text"):
            value = " ".join(getattr(self, name).split())
            if not value:
                raise ValueError(f"{name} must not be blank")
            object.__setattr__(self, name, value)
        if self.as_of is not None:
            value = " ".join(self.as_of.split())
            if not value:
                raise ValueError("as_of must not be blank")
            object.__setattr__(self, "as_of", value)
        if self.published_at is not None:
            object.__setattr__(
                self,
                "published_at",
                _normalize_timestamp(self.published_at, "published_at"),
            )
        object.__setattr__(self, "coverage", _normalize_coverage(self.coverage))
        if not isinstance(self.license_note, str):
            raise ValueError("license_note must be a string")
        license_note = " ".join(self.license_note.split())
        if not license_note:
            raise ValueError("license_note must not be blank")
        object.__setattr__(self, "license_note", license_note)
        if not isinstance(self.metadata, Mapping):
            raise ValueError("metadata must be a mapping")
        object.__setattr__(self, "metadata", MappingProxyType(dict(self.metadata)))


QueryBuilder = Callable[[tuple[RequiredFact, ...], int], Mapping[str, str]]
ResponseParser = Callable[[bytes], Sequence[PublicApiRecord]]


@dataclass(frozen=True, slots=True)
class PublicApiConnector:
    """Code-owned endpoint, minimal query builder, and deterministic parser."""

    name: str
    origin: str
    path: str
    allowed_query_keys: frozenset[str]
    publisher: str
    quality_ceiling: EvidenceQuality
    categories: frozenset[FactCategory]
    jurisdictions: str | tuple[str, ...]
    coverage: str | tuple[str, ...]
    access_policy: PublicAccessPolicy
    free_public_access_basis: str
    license_note: str
    freshness_semantics: str
    redistribution_restrictions: str
    query_builder: QueryBuilder
    response_parser: ResponseParser
    fact_matcher: Callable[[RequiredFact], bool] | None = None

    def __post_init__(self) -> None:
        name = " ".join(self.name.split())
        publisher = " ".join(self.publisher.split())
        parsed = urlsplit(self.origin)
        if (
            not name
            or parsed.scheme != "https"
            or not parsed.netloc
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("connector origin must be a fixed HTTPS origin")
        if (
            not self.path.startswith("/")
            or "?" in self.path
            or "#" in self.path
            or "\\" in self.path
            or any(part in {".", ".."} for part in self.path.split("/"))
        ):
            raise ValueError("connector path must be a fixed absolute path")
        if not publisher:
            raise ValueError("publisher must not be blank")
        if not isinstance(self.categories, frozenset) or not self.categories or any(
            not isinstance(category, FactCategory) for category in self.categories
        ):
            raise ValueError("categories must be a nonempty FactCategory set")
        jurisdictions = _normalize_coverage(self.jurisdictions)
        coverage = _normalize_coverage(self.coverage)
        if self.access_policy is not PublicAccessPolicy.FREE_PUBLIC_NO_CREDENTIALS:
            raise ValueError("access_policy must be FREE_PUBLIC_NO_CREDENTIALS")
        if not isinstance(self.free_public_access_basis, str):
            raise ValueError("free_public_access_basis must be a string")
        free_public_access_basis = " ".join(self.free_public_access_basis.split())
        if not free_public_access_basis:
            raise ValueError("free_public_access_basis must not be blank")
        if not isinstance(self.license_note, str):
            raise ValueError("license_note must be a string")
        license_note = " ".join(self.license_note.split())
        if not license_note:
            raise ValueError("license_note must not be blank")
        normalized_audit_fields: dict[str, str] = {}
        for field_name in ("freshness_semantics", "redistribution_restrictions"):
            value = getattr(self, field_name)
            if not isinstance(value, str):
                raise ValueError(f"{field_name} must be a string")
            normalized = " ".join(value.split())
            if not normalized:
                raise ValueError(f"{field_name} must not be blank")
            normalized_audit_fields[field_name] = normalized
        if not self.allowed_query_keys or any(
            not _QUERY_KEY.fullmatch(key) for key in self.allowed_query_keys
        ):
            raise ValueError("allowed query keys must be explicit safe names")
        if not callable(self.query_builder):
            raise ValueError("query_builder must be a fixed callable")
        if not callable(self.response_parser):
            raise ValueError("response_parser must be a fixed callable")
        if self.fact_matcher is not None and not callable(self.fact_matcher):
            raise ValueError("fact_matcher must be a fixed callable")
        if self.quality_ceiling is EvidenceQuality.PRIMARY:
            raise ValueError("public API quality cannot exceed AUTHORITATIVE")
        object.__setattr__(self, "name", name)
        object.__setattr__(self, "publisher", publisher)
        object.__setattr__(self, "origin", f"https://{parsed.netloc.casefold()}")
        object.__setattr__(self, "allowed_query_keys", frozenset(self.allowed_query_keys))
        object.__setattr__(self, "categories", frozenset(self.categories))
        object.__setattr__(self, "jurisdictions", jurisdictions)
        object.__setattr__(self, "coverage", coverage)
        object.__setattr__(self, "access_policy", self.access_policy)
        object.__setattr__(self, "free_public_access_basis", free_public_access_basis)
        object.__setattr__(self, "license_note", license_note)
        for field_name, value in normalized_audit_fields.items():
            object.__setattr__(self, field_name, value)

    def matches_fact(self, fact: RequiredFact) -> bool:
        """Return whether this connector is approved for this fact.

        GLOBAL jurisdiction coverage intentionally includes facts with no declared
        jurisdiction; a country-specific connector must never infer that scope.
        """

        in_scope = fact.category in self.categories and (
            self.jurisdictions == GLOBAL_COVERAGE
            or fact.jurisdiction is not None and fact.jurisdiction in self.jurisdictions
        )
        return in_scope and (
            self.fact_matcher is None or bool(self.fact_matcher(fact))
        )

    def build_url(self, facts: tuple[RequiredFact, ...], limit: int) -> str:
        query = self.query_builder(facts, limit)
        if not isinstance(query, Mapping) or set(query) - self.allowed_query_keys:
            raise ValueError("connector query contains an unregistered query key")
        pairs: list[tuple[str, str]] = []
        for key in sorted(query):
            value = query[key]
            if not isinstance(key, str) or not isinstance(value, str):
                raise ValueError("connector query keys and values must be strings")
            pairs.append((key, value))
        suffix = urlencode(pairs)
        return f"{self.origin}{self.path}" + (f"?{suffix}" if suffix else "")

    def owns_url(self, url: str, expected_url: str) -> bool:
        try:
            parsed = urlsplit(url)
            expected = urlsplit(expected_url)
        except ValueError:
            return False
        origin = f"{parsed.scheme}://{parsed.netloc.casefold()}"
        expected_origin = f"{expected.scheme}://{expected.netloc.casefold()}"
        if (
            origin != self.origin
            or expected_origin != self.origin
            or parsed.path != self.path
            or expected.path != self.path
            or parsed.fragment
            or expected.fragment
        ):
            return False
        actual_pairs = _safe_query_pairs(parsed.query)
        expected_pairs = _safe_query_pairs(expected.query)
        if actual_pairs is None or expected_pairs is None:
            return False
        if any(key not in self.allowed_query_keys for key, _value in actual_pairs):
            return False
        return Counter(actual_pairs) == Counter(expected_pairs)


class PublicApiRegistry:
    """Read-only connector registry; names cannot be replaced at runtime."""

    __slots__ = ("_connectors", "_names")

    def __init__(self, connectors: Sequence[PublicApiConnector]) -> None:
        values: dict[str, PublicApiConnector] = {}
        for connector in connectors:
            if connector.name in values:
                raise ValueError(f"duplicate public API connector: {connector.name}")
            values[connector.name] = connector
        self._connectors = MappingProxyType(values)
        self._names = tuple(values)

    @property
    def connectors(self) -> Mapping[str, PublicApiConnector]:
        return self._connectors

    @property
    def names(self) -> tuple[str, ...]:
        return self._names

    def get(self, name: str) -> PublicApiConnector:
        try:
            return self._connectors[name]
        except KeyError as exc:
            raise KeyError("public API connector is not registered") from exc

    def connectors_for(
        self, facts: tuple[RequiredFact, ...]
    ) -> tuple[PublicApiConnector, ...]:
        """Select registered connectors that match at least one unresolved fact."""

        return tuple(
            connector
            for connector in self._connectors.values()
            if any(connector.matches_fact(fact) for fact in facts)
        )


def build_default_public_api_registry() -> PublicApiRegistry:
    """Return the production no-login public API registry.

    GitHub is deliberately scoped to facts whose subject uses the explicit
    ``github:owner/repository`` form.  Ordinary entity investigations remain
    on the existing Wikidata connector and cannot accidentally fan out to a
    second provider.
    """

    return PublicApiRegistry(
        (
            PublicApiConnector(
                name="wikidata_entity_search",
                origin="https://www.wikidata.org",
                path="/w/api.php",
                allowed_query_keys=frozenset(
                    {"action", "search", "language", "format", "limit"}
                ),
                publisher="Wikidata",
                quality_ceiling=EvidenceQuality.SECONDARY,
                categories=frozenset({FactCategory.ENTITY_REFERENCE}),
                jurisdictions=GLOBAL_COVERAGE,
                coverage=GLOBAL_COVERAGE,
                access_policy=PublicAccessPolicy.FREE_PUBLIC_NO_CREDENTIALS,
                free_public_access_basis=(
                    "Wikidata offers this no-login free public endpoint."
                ),
                license_note="Wikidata data is available under CC0 1.0.",
                freshness_semantics="Entity search results are retrieved at investigation time.",
                redistribution_restrictions="Wikidata data is available under CC0 1.0.",
                query_builder=_build_wikidata_query,
                response_parser=_parse_wikidata_response,
                fact_matcher=lambda fact: not _is_github_repository_fact(fact),
            ),
            PublicApiConnector(
                name="github_repository_search",
                origin="https://api.github.com",
                path="/search/repositories",
                allowed_query_keys=frozenset({"q", "per_page"}),
                publisher="GitHub",
                quality_ceiling=EvidenceQuality.AUTHORITATIVE,
                categories=frozenset({FactCategory.ENTITY_REFERENCE}),
                jurisdictions=GLOBAL_COVERAGE,
                coverage=GLOBAL_COVERAGE,
                access_policy=PublicAccessPolicy.FREE_PUBLIC_NO_CREDENTIALS,
                free_public_access_basis=(
                    "GitHub exposes a public repository-search endpoint without a user credential."
                ),
                license_note=(
                    "Repository license is publisher-declared; verify the repository "
                    "license before reuse."
                ),
                freshness_semantics=(
                    "Repository metadata is retrieved at investigation time; "
                    "timestamps come from GitHub."
                ),
                redistribution_restrictions=(
                    "Respect the repository license and GitHub API terms when "
                    "redistributing metadata."
                ),
                query_builder=_build_github_repository_query,
                response_parser=_parse_github_repository_response,
                fact_matcher=_is_github_repository_fact,
            ),
        )
    )


def _build_wikidata_query(
    facts: tuple[RequiredFact, ...], limit: int
) -> Mapping[str, str]:
    subjects = tuple(dict.fromkeys(fact.subject for fact in facts))
    return {
        "action": "wbsearchentities",
        "search": " ".join(subjects),
        "language": "en" if all(subject.isascii() for subject in subjects) else "zh",
        "format": "json",
        "limit": str(min(max(limit, 1), 10)),
    }


def _parse_wikidata_response(body: bytes) -> tuple[PublicApiRecord, ...]:
    payload = json.loads(body)
    if not isinstance(payload, dict) or not isinstance(payload.get("search"), list):
        raise ValueError("invalid Wikidata search response")
    records: list[PublicApiRecord] = []
    for item in payload["search"]:
        if not isinstance(item, dict):
            continue
        entity_id = item.get("id")
        label = item.get("label")
        description = item.get("description")
        if (
            not isinstance(entity_id, str)
            or re.fullmatch(r"Q[1-9][0-9]*", entity_id) is None
            or not isinstance(label, str)
            or not " ".join(label.split())
            or not isinstance(description, str)
            or not " ".join(description.split())
        ):
            continue
        normalized_label = " ".join(label.split())
        normalized_description = " ".join(description.split())
        records.append(
            PublicApiRecord(
                title=f"{normalized_label} ({entity_id})",
                coverage=GLOBAL_COVERAGE,
                license_note="Wikidata data is available under CC0 1.0.",
                text=f"{normalized_label} — {normalized_description}",
            )
        )
    return tuple(records)


_GITHUB_SUBJECT = re.compile(
    r"^github:(?P<repository>"
    r"[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100})$"
)


def _github_repository_name(subject: str) -> str | None:
    match = _GITHUB_SUBJECT.fullmatch(" ".join(subject.split()))
    return None if match is None else match.group("repository")


def _is_github_repository_fact(fact: RequiredFact) -> bool:
    return (
        fact.category is FactCategory.ENTITY_REFERENCE
        and fact.expected_shape == "object"
        and _github_repository_name(fact.subject) is not None
    )


def _build_github_repository_query(
    facts: tuple[RequiredFact, ...], limit: int
) -> Mapping[str, str]:
    repositories = tuple(
        dict.fromkeys(
            repository
            for repository in (_github_repository_name(fact.subject) for fact in facts)
            if repository is not None
        )
    )
    if not repositories:
        raise ValueError("github repository fact is required")
    return {
        "q": " ".join(f"repo:{repository}" for repository in repositories),
        "per_page": str(min(max(limit, 1), 10)),
    }


def _parse_github_repository_response(body: bytes) -> tuple[PublicApiRecord, ...]:
    payload = json.loads(body)
    if not isinstance(payload, dict) or not isinstance(payload.get("items"), list):
        raise ValueError("invalid GitHub repository search response")
    records: list[PublicApiRecord] = []
    for item in payload["items"]:
        if not isinstance(item, dict):
            continue
        full_name = item.get("full_name")
        html_url = item.get("html_url")
        description = item.get("description")
        updated_at = item.get("updated_at")
        if (
            not isinstance(full_name, str)
            or re.fullmatch(r"[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}", full_name) is None
            or not isinstance(html_url, str)
            or urlsplit(html_url).scheme != "https"
            or urlsplit(html_url).netloc.casefold() != "github.com"
            or not isinstance(description, str)
            or not isinstance(updated_at, str)
        ):
            continue
        try:
            updated = _normalize_timestamp(updated_at, "updated_at")
            created = item.get("created_at")
            created_at = (
                _normalize_timestamp(created, "created_at")
                if isinstance(created, str)
                else None
            )
        except ValueError:
            continue
        license_payload = item.get("license")
        license_id = (
            license_payload.get("spdx_id")
            if isinstance(license_payload, dict)
            else None
        )
        license_name = (
            license_payload.get("name")
            if isinstance(license_payload, dict)
            else None
        )
        license_text = " ".join(
            str(value).strip()
            for value in (license_id, license_name)
            if isinstance(value, str) and value.strip()
        ) or "NOASSERTION"
        numeric = {
            key: item.get(key)
            for key in ("stargazers_count", "open_issues_count")
        }
        if any(type(value) is not int or value < 0 for value in numeric.values()):
            continue
        default_branch = item.get("default_branch")
        if not isinstance(default_branch, str) or not default_branch.strip():
            continue
        normalized_description = (
            " ".join(description.split())
            if isinstance(description, str)
            else ""
        ) or "(no description)"
        text = (
            f"{full_name}: {normalized_description}. "
            f"License: {license_text}. Updated: {updated}. "
            f"Pushed: {item.get('pushed_at') or 'unknown'}. "
            f"Stars: {numeric['stargazers_count']}. "
            f"Open issues: {numeric['open_issues_count']}. "
            f"Default branch: {default_branch.strip()}."
        )
        records.append(
            PublicApiRecord(
                title=full_name,
                text=text,
                coverage=GLOBAL_COVERAGE,
                license_note=(
                    "Repository license is publisher-declared; verify the repository "
                    "license before reuse."
                ),
                as_of=updated,
                metadata={
                    "repository": {
                        "full_name": full_name,
                        "html_url": html_url,
                        "description": normalized_description,
                        "license_spdx_id": license_id,
                        "license_name": license_name,
                        "updated_at": updated,
                        "pushed_at": item.get("pushed_at"),
                        "created_at": created_at,
                        "stargazers_count": numeric["stargazers_count"],
                        "open_issues_count": numeric["open_issues_count"],
                        "default_branch": default_branch.strip(),
                    }
                },
            )
        )
    return tuple(records)


def _safe_query_pairs(query: str) -> tuple[tuple[str, str], ...] | None:
    from urllib.parse import parse_qsl

    try:
        return tuple(parse_qsl(query, keep_blank_values=True, strict_parsing=True))
    except ValueError:
        return None
