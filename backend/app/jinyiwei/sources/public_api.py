"""Bounded access to code-registered public JSON APIs."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Protocol

from app.jinyiwei.models import (
    FactCategory,
    SourceAttempt,
    SourceAttemptStatus,
    SourceType,
)
from app.jinyiwei.network import PinnedHTTPSResponse
from app.jinyiwei.source_registry import PublicApiRecord, PublicApiRegistry
from app.jinyiwei.sources.base import SourceDocument, SourceQuery, SourceResult

_PUBLIC_API_USER_AGENT = "chaotang-os/1.0"


class _Client(Protocol):
    def fetch(self, url: str, **kwargs: object) -> PinnedHTTPSResponse: ...


class PublicApiSource:
    """Call only the explicit connectors present in an immutable registry."""

    def __init__(
        self,
        *,
        registry: PublicApiRegistry,
        client: _Client,
        now: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._registry = registry
        self._client = client
        self._now = now

    def fetch(self, query: SourceQuery) -> SourceResult:
        started = self._now()
        if SourceType.PUBLIC_API not in query.request.source_scope:
            return self._result((), SourceAttemptStatus.SKIPPED, started, (), "source_out_of_scope")
        if self._expired(query):
            return self._result((), SourceAttemptStatus.BLOCKED, started, (), "deadline_exceeded")
        if not self._registry.names:
            return self._result(
                (),
                SourceAttemptStatus.SKIPPED,
                started,
                (),
                "public_api_not_configured",
            )

        requested = {
            fact.key: fact
            for fact in query.request.required_facts
            if fact.key in query.unresolved_fact_keys
        }
        facts = tuple(requested[key] for key in query.unresolved_fact_keys)
        connectors = self._registry.connectors_for(facts)
        attempted_fact_keys: set[str] = set()

        def facts_attempted() -> tuple[str, ...]:
            return tuple(fact.key for fact in facts if fact.key in attempted_fact_keys)

        documents: list[SourceDocument] = []
        try:
            news_document_indexes: dict[object, list[int]] = {}
            for connector in connectors:
                if self._expired(query):
                    return self._result(
                        (),
                        SourceAttemptStatus.BLOCKED,
                        started,
                        facts_attempted(),
                        "deadline_exceeded",
                    )
                remaining_items = query.max_items - len(documents)
                if remaining_items <= 0:
                    break
                matched_facts = tuple(fact for fact in facts if connector.matches_fact(fact))
                attempted_fact_keys.update(fact.key for fact in matched_facts)
                url = connector.build_url(matched_facts, remaining_items)
                response = self._client.fetch(
                    url,
                    headers={
                        "Accept": "application/json",
                        "User-Agent": _PUBLIC_API_USER_AGENT,
                    },
                    total_timeout=self._remaining_seconds(query),
                )
                if self._expired(query):
                    return self._result(
                        (),
                        SourceAttemptStatus.BLOCKED,
                        started,
                        facts_attempted(),
                        "deadline_exceeded",
                    )
                media_type = response.headers.get("content-type", "").split(";", 1)[0]
                if (
                    response.status != 200
                    or media_type.casefold() != "application/json"
                    or not connector.owns_url(response.final_url, url)
                ):
                    raise ValueError("registered API response rejected")
                records = tuple(connector.response_parser(response.body))
                if any(not isinstance(record, PublicApiRecord) for record in records):
                    raise ValueError("registered API parser returned an invalid record")
                if self._expired(query):
                    return self._result(
                        (),
                        SourceAttemptStatus.BLOCKED,
                        started,
                        facts_attempted(),
                        "deadline_exceeded",
                    )
                retrieved_at = _format_time(self._now())
                is_news = any(fact.category is FactCategory.NEWS_EVENT for fact in matched_facts)
                for record in records[:remaining_items]:
                    documents.append(
                        SourceDocument(
                            source_type=SourceType.PUBLIC_API,
                            source_name=connector.name,
                            source_url=response.final_url,
                            publisher=connector.publisher,
                            title=record.title,
                            retrieved_at=retrieved_at,
                            as_of=record.published_at or record.as_of or retrieved_at,
                            published_at=record.published_at,
                            coverage=(record.coverage,)
                            if isinstance(record.coverage, str)
                            else record.coverage,
                            license_note=record.license_note,
                            text=record.text,
                            quality_ceiling=connector.quality_ceiling,
                            metadata={"connector": connector.name, **dict(record.metadata)},
                        )
                    )
                    if is_news:
                        news_document_indexes.setdefault(connector.quality_ceiling, []).append(
                            len(documents) - 1
                        )
        except Exception:
            return self._result(
                (),
                SourceAttemptStatus.FAILED,
                started,
                facts_attempted(),
                "public_api_unavailable",
            )
        for indexes in news_document_indexes.values():
            ordered = sorted(
                indexes,
                key=lambda index: _parse_time(documents[index].as_of),
                reverse=True,
            )
            ordered_documents = [documents[index] for index in ordered]
            for index, document in zip(indexes, ordered_documents, strict=True):
                documents[index] = document
        return self._result(
            tuple(documents), SourceAttemptStatus.SUCCEEDED, started, facts_attempted(), None
        )

    def _expired(self, query: SourceQuery) -> bool:
        return self._now() >= _parse_time(query.deadline_at)

    def _remaining_seconds(self, query: SourceQuery) -> float:
        seconds = (_parse_time(query.deadline_at) - self._now()).total_seconds()
        if seconds <= 0:
            raise TimeoutError("deadline exceeded")
        return min(float(query.request.timeout_seconds), seconds)

    def _result(
        self,
        documents: tuple[SourceDocument, ...],
        status: SourceAttemptStatus,
        started: datetime,
        facts_attempted: tuple[str, ...],
        error: str | None,
    ) -> SourceResult:
        return SourceResult(
            documents=documents,
            attempt=SourceAttempt(
                source_type=SourceType.PUBLIC_API,
                source_name="registered_public_api",
                status=status,
                started_at=_format_time(started),
                completed_at=_format_time(self._now()),
                error=error,
                facts_attempted=facts_attempted,
            ),
        )


def _parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value[:-1] + "+00:00" if value.endswith("Z") else value)


def _format_time(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")
