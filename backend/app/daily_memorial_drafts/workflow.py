
"""Checkpointed, strictly serial generation for the 39 daily bureau units."""

from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from pathlib import Path
from typing import Any, Self

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

from app.agents.bureaus.profiles import BUREAU_PROFILES, BureauProfile
from app.agents.ministries import MINISTRIES
from app.daily_memorial_drafts.facts import ControlledFact
from app.daily_memorial_drafts.models import (
    ChancellorDailyResult,
    MinistryDailyResult,
    RunStatus,
    StageKind,
    StageStatus,
)
from app.daily_memorial_drafts.prompts import (
    build_bureau_prompt,
    build_chancellor_prompt,
    build_ministry_prompt,
)
from app.daily_memorial_drafts.storage import DailyMemorialRun, _run_from_row
from app.shiguan import db
from app.shiguan.errors import ShiguanStorageError

_CITATION = re.compile(r"\[fact:([^\]\s]+)\]")
_SENTENCE = re.compile(r"[^。！？!?\n]+[。！？!?]?")
_COMPLETED_ACTIONS = tuple(
    pattern
    for actions in (
        "调查|核查|查明",
        "执行|落实|施行",
        "批准|审批|核准",
        "归档|入档|存档",
        "下旨|降旨|颁旨|旨意",
    )
    for pattern in (
        re.compile(rf"(?:已(?:经)?|业已)(?P<link>.{{0,2}})(?:{actions})"),
        re.compile(
            rf"(?:完毕|完成|结束|办结)(?:了)?(?P<link>.{{0,2}})(?:{actions})"
        ),
        re.compile(
            rf"(?:{actions})(?P<link>.{{0,4}})"
            r"(?:完毕|完成|结束|办结|通过|生效|下达)"
        ),
    )
)
_ACTION_NEGATIONS = (
    "未能",
    "尚未",
    "并未",
    "没有",
    "不得",
    "禁止",
    "不可",
    "不能",
    "未",
)
_BACKOFF = (timedelta(minutes=1), timedelta(minutes=5), timedelta(minutes=30))
_RUNNING_LEASE = timedelta(minutes=30)
_MAX_ATTEMPTS = len(_BACKOFF) + 1


class BureauDailyStatus(StrEnum):
    READY = "READY"
    NO_MATERIAL = "NO_MATERIAL"


class BureauDailyResult(BaseModel):
    """Bounded model-owned output before snapshot-aware validation."""

    model_config = ConfigDict(extra="forbid", revalidate_instances="always")

    status: BureauDailyStatus
    department: str
    bureau: str
    summary: str | None = Field(default=None, max_length=4000)
    decisions_needed: list[str] = Field(default_factory=list, max_length=20)
    fact_refs: list[str] = Field(default_factory=list, max_length=200)

    @field_validator("department", "bureau")
    @classmethod
    def _required_identity(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("unit identity must not be blank")
        return normalized

    @field_validator("summary")
    @classmethod
    def _normalize_summary(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or ""

    @field_validator("decisions_needed", "fact_refs")
    @classmethod
    def _normalize_lists(cls, value: list[str]) -> list[str]:
        normalized = [item.strip() for item in value]
        if any(not item for item in normalized):
            raise ValueError("list items must not be blank")
        return normalized

    @model_validator(mode="after")
    def _coherent_status(self) -> Self:
        if len(self.fact_refs) != len(set(self.fact_refs)):
            raise ValueError("fact references must be unique")

        if self.status is BureauDailyStatus.NO_MATERIAL:
            if self.summary not in (None, "") or self.decisions_needed or self.fact_refs:
                raise ValueError("NO_MATERIAL output must be empty")
            return self
        if not self.summary or not self.fact_refs:
            raise ValueError("READY output requires summary and fact references")
        return self


@dataclass(frozen=True, slots=True)
class StageResult:
    id: str
    run_id: str
    stage: StageKind
    unit_key: str
    status: StageStatus
    input_fingerprint: str | None
    output_json: str | None
    fact_refs: tuple[str, ...]
    attempts: int
    failure_code: str | None
    next_retry_at: datetime | None
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class StageProgress:
    run_id: str
    ready: int
    no_material: int
    retry_wait: int
    failed: int
    pending: int
    running: int

    @property
    def terminal(self) -> int:
        return self.ready + self.no_material


Invoker = Callable[[str, str, str, type[BureauDailyResult]], Any]


class _OutputFailure(ValueError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


class ConfigurationUnavailable(RuntimeError):
    """Provider configuration could not be loaded for this persisted attempt."""


def _canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _load_run_and_facts(
    conn: sqlite3.Connection, run_id: str
) -> tuple[sqlite3.Row, tuple[ControlledFact, ...]]:
    run = conn.execute(
        "SELECT * FROM daily_memorial_runs WHERE id = ?", (run_id,)
    ).fetchone()
    if run is None:
        raise ValueError("daily memorial run does not exist")
    rows = conn.execute(
        "SELECT fact_id, snapshot_json FROM daily_memorial_fact_snapshots "
        "WHERE run_id = ? ORDER BY fact_id",
        (run_id,),
    ).fetchall()
    facts: list[ControlledFact] = []
    for row in rows:
        try:
            payload = json.loads(row["snapshot_json"])
            facts.append(
                ControlledFact(
                    fact_id=row["fact_id"],
                    run_id=run_id,
                    owner_user_id=run["owner_user_id"],
                    report_date=datetime.fromisoformat(run["source_window_start"]).date(),
                    archive_id=payload["archive_id"],
                    evidence_ordinal=payload["evidence_ordinal"],
                    payload_hash=hashlib.sha256(row["snapshot_json"].encode("utf-8")).hexdigest(),
                    snapshot_json=row["snapshot_json"],
                )
            )
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
            raise ShiguanStorageError("每日奏报事实快照校验失败") from exc
    return run, tuple(facts)


def _fingerprint(profile: BureauProfile, facts: tuple[ControlledFact, ...]) -> str:
    payload = {
        "stage": StageKind.BUREAU.value,
        "unit_key": f"{profile.department}/{profile.bureau}",
        "responsibilities": profile.responsibilities,
        "facts": [
            {"fact_id": fact.fact_id, "payload_hash": fact.payload_hash}
            for fact in facts
        ],
    }
    return hashlib.sha256(_canonical_json(payload).encode("utf-8")).hexdigest()


def _initialize_units(
    conn: sqlite3.Connection,
    run_id: str,
    facts: tuple[ControlledFact, ...],
    now: datetime,
) -> None:
    timestamp = now.isoformat()
    for profile in BUREAU_PROFILES:
        unit_key = f"{profile.department}/{profile.bureau}"
        conn.execute(
            "INSERT INTO daily_memorial_stage_results "
            "(id, run_id, stage, unit_key, status, input_fingerprint, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(run_id, stage, unit_key) DO NOTHING",
            (

                uuid.uuid4().hex,
                run_id,
                StageKind.BUREAU.value,
                unit_key,
                StageStatus.PENDING.value,
                _fingerprint(profile, facts),
                timestamp,
                timestamp,
            ),
        )
    conn.execute(
        "UPDATE daily_memorial_runs SET status = ?, updated_at = ? "
        "WHERE id = ? AND status = ?",
        (RunStatus.GENERATING.value, timestamp, run_id, RunStatus.PENDING.value),
    )


def _fail_expired_exhausted_claim(
    conn: sqlite3.Connection,
    *,
    run_id: str,
    stage: StageKind,
    unit_key: str,
    fingerprint: str,
    updated_at: str,
    now: datetime,
) -> None:
    changed = conn.execute(
        "UPDATE daily_memorial_stage_results SET status = ?, failure_code = ?, "
        "next_retry_at = NULL, updated_at = ? "
        "WHERE run_id = ? AND stage = ? AND unit_key = ? AND status = ? "
        "AND input_fingerprint = ? AND updated_at = ? AND attempts >= ?",
        (
            StageStatus.FAILED.value,
            "invocation_failed",
            now.isoformat(),
            run_id,
            stage.value,
            unit_key,
            StageStatus.RUNNING.value,
            fingerprint,
            updated_at,
            _MAX_ATTEMPTS,
        ),
    ).rowcount
    if changed == 1:
        conn.execute(
            "UPDATE daily_memorial_runs SET status = ?, failure_code = ?, updated_at = ? "
            "WHERE id = ? AND status = ?",
            (
                RunStatus.FAILED.value,
                "invocation_failed",
                now.isoformat(),
                run_id,
                RunStatus.GENERATING.value,
            ),
        )


def _claim_next(
    run_id: str,
    facts: tuple[ControlledFact, ...],
    *,
    now: datetime,
    db_path: Path | None,
) -> tuple[BureauProfile, str, str] | None:
    conn = db.get_connection(db_path)
    try:
        conn.execute("BEGIN IMMEDIATE")
        _initialize_units(conn, run_id, facts, now)
        run_row = conn.execute(
            "SELECT status FROM daily_memorial_runs WHERE id = ?", (run_id,)
        ).fetchone()
        if run_row is None:
            raise sqlite3.DatabaseError("daily memorial run does not exist")
        if RunStatus(run_row["status"]) is not RunStatus.GENERATING:
            conn.commit()
            return None
        for profile in BUREAU_PROFILES:
            unit_key = f"{profile.department}/{profile.bureau}"
            row = conn.execute(
                "SELECT status, input_fingerprint, attempts, next_retry_at, updated_at "
                "FROM daily_memorial_stage_results "
                "WHERE run_id = ? AND stage = ? AND unit_key = ?",
                (run_id, StageKind.BUREAU.value, unit_key),
            ).fetchone()
            if row is None:
                raise sqlite3.DatabaseError("bureau unit was not initialized")
            status = StageStatus(row["status"])
            if status in {StageStatus.READY, StageStatus.NO_MATERIAL}:
                continue
            if status is StageStatus.FAILED:
                conn.commit()
                return None
            fingerprint = _fingerprint(profile, facts)
            if status is StageStatus.RUNNING:
                claimed_at = datetime.fromisoformat(row["updated_at"])
                if (
                    claimed_at + _RUNNING_LEASE > now
                    or row["input_fingerprint"] != fingerprint
                ):
                    conn.commit()
                    return None
                if row["attempts"] >= _MAX_ATTEMPTS:
                    _fail_expired_exhausted_claim(
                        conn,
                        run_id=run_id,
                        stage=StageKind.BUREAU,
                        unit_key=unit_key,
                        fingerprint=fingerprint,
                        updated_at=row["updated_at"],
                        now=now,
                    )
                    conn.commit()
                    return None
            if status is StageStatus.RETRY_WAIT:
                retry_at = datetime.fromisoformat(row["next_retry_at"])
                if retry_at > now:
                    conn.commit()
                    return None
            claim_token = now.isoformat()
            changed = conn.execute(
                "UPDATE daily_memorial_stage_results SET status = ?, input_fingerprint = ?, "
                "attempts = attempts + 1, failure_code = NULL, "
                "next_retry_at = NULL, updated_at = ? "
                "WHERE run_id = ? AND stage = ? AND unit_key = ? "
                "AND status = ? AND input_fingerprint = ? AND updated_at = ? "
                "AND EXISTS (SELECT 1 FROM daily_memorial_runs r "
                "WHERE r.id = daily_memorial_stage_results.run_id AND r.status = ?)",
                (
                    StageStatus.RUNNING.value,
                    fingerprint,
                    claim_token,
                    run_id,
                    StageKind.BUREAU.value,
                    unit_key,
                    status.value,
                    row["input_fingerprint"],
                    row["updated_at"],
                    RunStatus.GENERATING.value,
                ),
            ).rowcount
            conn.commit()
            return (profile, fingerprint, claim_token) if changed == 1 else None
        conn.commit()
        return None
    except (ValueError, TypeError, ShiguanStorageError):
        conn.rollback()
        raise
    except sqlite3.Error as exc:
        conn.rollback()
        raise ShiguanStorageError("每日奏报司级领取失败") from exc
    finally:
        conn.close()


def _validate_output(
    raw: object,
    *,
    profile: BureauProfile,
    facts: tuple[ControlledFact, ...],
) -> BureauDailyResult:
    if isinstance(raw, dict):
        raw_refs = raw.get("fact_refs")
        if isinstance(raw_refs, list) and all(
            isinstance(item, str) for item in raw_refs
        ):
            if len(raw_refs) != len(set(raw_refs)):
                raise _OutputFailure("duplicate_fact_ref")
    try:
        result = BureauDailyResult.model_validate(raw)
    except ValidationError as exc:
        raise _OutputFailure("invalid_structured_output") from exc
    if (result.department, result.bureau) != (profile.department, profile.bureau):

        raise _OutputFailure("unit_identity_mismatch")
    if len(result.fact_refs) != len(set(result.fact_refs)):
        raise _OutputFailure("duplicate_fact_ref")
    known_refs = {fact.fact_id for fact in facts}
    if not set(result.fact_refs) <= known_refs:
        raise _OutputFailure("unsupported_fact_ref")
    if result.status is BureauDailyStatus.NO_MATERIAL:
        return result

    texts = [result.summary or "", *result.decisions_needed]
    if any(_claims_completed_action(text) for text in texts):
        raise _OutputFailure("forbidden_action_claim")
    listed_refs = set(result.fact_refs)
    for text in texts:
        markers = set(_CITATION.findall(text))
        if not markers <= known_refs:
            raise _OutputFailure("unsupported_fact_ref")
        if not markers <= listed_refs:
            raise _OutputFailure("unsupported_factual_claim")
        for sentence_match in _SENTENCE.finditer(text):
            sentence = sentence_match.group(0).strip()
            if not sentence or sentence.startswith("判断："):
                continue
            citations = _CITATION.findall(sentence)
            if not citations:
                raise _OutputFailure("unsupported_factual_claim")
            if not set(citations) <= known_refs:
                raise _OutputFailure("unsupported_fact_ref")
            if not set(citations) <= listed_refs:
                raise _OutputFailure("unsupported_factual_claim")
    return result


def _claims_completed_action(text: str) -> bool:
    for pattern in _COMPLETED_ACTIONS:
        for match in pattern.finditer(text):
            prefix = text[: match.start()]
            directly_negated = any(
                prefix.endswith(negation) for negation in _ACTION_NEGATIONS
            )
            linked_negation = any(
                negation in match.group("link") for negation in _ACTION_NEGATIONS
            )
            if not directly_negated and not linked_negation:
                return True
    return False


def _finish_success(
    run_id: str,
    unit_key: str,
    fingerprint: str,
    claim_token: str,
    result: BureauDailyResult,
    *,
    now: datetime,
    db_path: Path | None,
) -> bool:
    conn = db.get_connection(db_path)
    try:
        conn.execute("BEGIN IMMEDIATE")
        changed = conn.execute(
            "UPDATE daily_memorial_stage_results SET status = ?, output_json = ?, "
            "fact_refs_json = ?, failure_code = NULL, next_retry_at = NULL, updated_at = ? "
            "WHERE run_id = ? AND stage = ? AND unit_key = ? AND status = ? "
            "AND input_fingerprint = ? AND updated_at = ?",
            (
                result.status.value,
                _canonical_json(result.model_dump(mode="json")),
                _canonical_json(result.fact_refs),
                now.isoformat(),
                run_id,
                StageKind.BUREAU.value,
                unit_key,
                StageStatus.RUNNING.value,
                fingerprint,
                claim_token,
            ),
        ).rowcount
        conn.commit()
        return changed == 1
    except sqlite3.Error as exc:
        conn.rollback()
        raise ShiguanStorageError("每日奏报司级提交失败") from exc
    finally:
        conn.close()


def _finish_failure(
    run_id: str,
    unit_key: str,
    fingerprint: str,
    claim_token: str,
    failure_code: str,
    *,
    now: datetime,
    db_path: Path | None,
) -> bool:
    conn = db.get_connection(db_path)
    try:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT attempts FROM daily_memorial_stage_results WHERE run_id = ? "
            "AND stage = ? AND unit_key = ? AND status = ? AND input_fingerprint = ? "
            "AND updated_at = ?",
            (
                run_id,
                StageKind.BUREAU.value,
                unit_key,
                StageStatus.RUNNING.value,
                fingerprint,
                claim_token,
            ),
        ).fetchone()
        if row is None:
            conn.commit()
            return False
        attempts = row["attempts"]
        exhausted = attempts >= _MAX_ATTEMPTS
        status = StageStatus.FAILED if exhausted else StageStatus.RETRY_WAIT

        retry_at = None if exhausted else now + _BACKOFF[attempts - 1]
        changed = conn.execute(
            "UPDATE daily_memorial_stage_results SET status = ?, output_json = 'null', "
            "fact_refs_json = '[]', failure_code = ?, next_retry_at = ?, updated_at = ? "
            "WHERE run_id = ? AND stage = ? AND unit_key = ? AND status = ? "
            "AND input_fingerprint = ? AND updated_at = ?",
            (
                status.value,
                failure_code,
                None if retry_at is None else retry_at.isoformat(),
                now.isoformat(),
                run_id,
                StageKind.BUREAU.value,
                unit_key,
                StageStatus.RUNNING.value,
                fingerprint,
                claim_token,
            ),
        ).rowcount
        if exhausted and changed == 1:
            conn.execute(
                "UPDATE daily_memorial_runs SET status = ?, failure_code = ?, "
                "updated_at = ? WHERE id = ? AND status = ? AND NOT EXISTS "
                "(SELECT 1 FROM daily_memorial_stage_results s "
                "WHERE s.run_id = daily_memorial_runs.id AND s.status = ?)",
                (
                    RunStatus.FAILED.value,
                    failure_code,
                    now.isoformat(),
                    run_id,
                    RunStatus.GENERATING.value,
                    StageStatus.RUNNING.value,
                ),
            )
        conn.commit()
        return changed == 1
    except sqlite3.Error as exc:
        conn.rollback()
        raise ShiguanStorageError("每日奏报司级失败检查点写入失败") from exc
    finally:
        conn.close()


def _stage_result_from_row(row: sqlite3.Row) -> StageResult:
    return StageResult(
        id=row["id"],
        run_id=row["run_id"],
        stage=StageKind(row["stage"]),
        unit_key=row["unit_key"],
        status=StageStatus(row["status"]),
        input_fingerprint=row["input_fingerprint"],
        output_json=None if row["output_json"] == "null" else row["output_json"],
        fact_refs=tuple(json.loads(row["fact_refs_json"])),
        attempts=row["attempts"],
        failure_code=row["failure_code"],
        next_retry_at=None
        if row["next_retry_at"] is None
        else datetime.fromisoformat(row["next_retry_at"]),
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"]),
    )


def load_stage_result(
    run_id: str,
    stage: StageKind | str,
    unit_key: str,
    *,
    db_path: Path | None = None,
) -> StageResult:
    """Load one checkpoint without exposing a write capability."""

    stage_value = StageKind(stage).value
    conn = db.get_connection(db_path)
    try:
        row = conn.execute(
            "SELECT * FROM daily_memorial_stage_results WHERE run_id = ? "
            "AND stage = ? AND unit_key = ?",
            (run_id, stage_value, unit_key),
        ).fetchone()
        if row is None:
            raise ValueError("daily memorial stage result does not exist")
        return _stage_result_from_row(row)
    finally:
        conn.close()


def _progress(run_id: str, *, db_path: Path | None) -> StageProgress:
    conn = db.get_connection(db_path)
    try:
        counts = {
            row["status"]: row["count"]
            for row in conn.execute(
                "SELECT status, COUNT(*) AS count FROM daily_memorial_stage_results "
                "WHERE run_id = ? AND stage = ? GROUP BY status",
                (run_id, StageKind.BUREAU.value),
            ).fetchall()
        }
        return StageProgress(
            run_id=run_id,
            ready=counts.get(StageStatus.READY.value, 0),
            no_material=counts.get(StageStatus.NO_MATERIAL.value, 0),
            retry_wait=counts.get(StageStatus.RETRY_WAIT.value, 0),
            failed=counts.get(StageStatus.FAILED.value, 0),
            pending=counts.get(StageStatus.PENDING.value, 0),
            running=counts.get(StageStatus.RUNNING.value, 0),
        )
    finally:
        conn.close()


def run_bureau_stage(
    run_id: str,
    *,
    invoker: Invoker,
    now: datetime,
    db_path: Path | None = None,
) -> StageProgress:
    """Run available bureau work serially, stopping at the first checkpointed failure."""


    if not isinstance(now, datetime) or now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("now must include a timezone")
    conn = db.get_connection(db_path)
    try:
        _run, facts = _load_run_and_facts(conn, run_id)
    finally:
        conn.close()
    if not facts:
        return _progress(run_id, db_path=db_path)

    while True:
        claim = _claim_next(run_id, facts, now=now, db_path=db_path)
        if claim is None:
            return _progress(run_id, db_path=db_path)
        profile, fingerprint, claim_token = claim
        unit_key = f"{profile.department}/{profile.bureau}"
        prompt = build_bureau_prompt(profile, facts)
        try:
            raw = invoker(StageKind.BUREAU.value, unit_key, prompt, BureauDailyResult)
            result = _validate_output(raw, profile=profile, facts=facts)
        except ConfigurationUnavailable:
            _finish_failure(
                run_id,
                unit_key,
                fingerprint,
                claim_token,
                "configuration_unavailable",
                now=now,
                db_path=db_path,
            )
            return _progress(run_id, db_path=db_path)
        except _OutputFailure as exc:
            _finish_failure(
                run_id,
                unit_key,
                fingerprint,
                claim_token,
                exc.code,
                now=now,
                db_path=db_path,
            )
            return _progress(run_id, db_path=db_path)
        except Exception:
            _finish_failure(
                run_id,
                unit_key,
                fingerprint,
                claim_token,
                "invocation_failed",
                now=now,
                db_path=db_path,
            )
            return _progress(run_id, db_path=db_path)
        if not _finish_success(
            run_id,
            unit_key,
            fingerprint,
            claim_token,
            result,
            now=now,
            db_path=db_path,
        ):
            return _progress(run_id, db_path=db_path)


@dataclass(frozen=True, slots=True)
class ChancellorDraftPayload:
    """Local Task 4 boundary for a future external work-product envelope."""

    content: str
    fact_refs: tuple[str, ...]
    fingerprint: str


def adapt_chancellor_result_to_draft(
    result: ChancellorDailyResult,
    *,
    input_fingerprints: tuple[str, ...],
) -> ChancellorDraftPayload:
    """Map validated aggregation output to canonical pending-draft fields."""

    validated = ChancellorDailyResult.model_validate(result)
    envelope = {
        "schema": "daily-memorial-draft/v1",
        "input_fingerprints": list(input_fingerprints),
        "response": validated.model_dump(mode="json"),
    }
    fingerprint = hashlib.sha256(
        _canonical_json(envelope).encode("utf-8")
    ).hexdigest()
    return ChancellorDraftPayload(
        content=validated.content,
        fact_refs=tuple(validated.fact_refs),
        fingerprint=fingerprint,
    )


def _load_run(run_id: str, *, db_path: Path | None) -> DailyMemorialRun:
    conn = db.get_connection(db_path)
    try:
        row = conn.execute(
            "SELECT * FROM daily_memorial_runs WHERE id = ?", (run_id,)
        ).fetchone()
        if row is None:
            raise ValueError("daily memorial run does not exist")
        return _run_from_row(row)
    finally:
        conn.close()


def _expected_bureau_keys(department: str | None = None) -> tuple[str, ...]:
    return tuple(
        f"{profile.department}/{profile.bureau}"
        for profile in BUREAU_PROFILES
        if department is None or profile.department == department
    )


def _ordered_terminal_rows(
    conn: sqlite3.Connection,

    run_id: str,
    stage: StageKind,
    expected_keys: tuple[str, ...],
) -> tuple[sqlite3.Row, ...] | None:
    rows = conn.execute(
        "SELECT * FROM daily_memorial_stage_results WHERE run_id = ? AND stage = ?",
        (run_id, stage.value),
    ).fetchall()
    by_key = {row["unit_key"]: row for row in rows}
    if len(rows) != len(expected_keys) or set(by_key) != set(expected_keys):
        return None
    ordered = tuple(by_key[key] for key in expected_keys)
    if any(
        StageStatus(row["status"])
        not in {StageStatus.READY, StageStatus.NO_MATERIAL}
        for row in ordered
    ):
        return None
    return ordered


def _aggregate_fingerprint(
    stage: StageKind,
    unit_key: str,
    run_row: sqlite3.Row,
    facts: tuple[ControlledFact, ...],
    input_rows: tuple[sqlite3.Row, ...],
) -> str:
    payload = {
        "stage": stage.value,
        "unit_key": unit_key,
        "run_identity": {
            "report_date": run_row["report_date"],
            "source_window_start": run_row["source_window_start"],
            "source_window_end": run_row["source_window_end"],
        },
        "facts": [
            {"fact_id": fact.fact_id, "payload_hash": fact.payload_hash}
            for fact in facts
        ],
        "inputs": [
            {
                "stage": row["stage"],
                "unit_key": row["unit_key"],
                "status": row["status"],
                "input_fingerprint": row["input_fingerprint"],
                "output_json": row["output_json"],
            }
            for row in input_rows
        ],
    }
    return hashlib.sha256(_canonical_json(payload).encode("utf-8")).hexdigest()


def _initialize_aggregate_units(
    conn: sqlite3.Connection,
    run_id: str,
    stage: StageKind,
    fingerprints: tuple[tuple[str, str], ...],
    now: datetime,
) -> None:
    timestamp = now.isoformat()
    for unit_key, fingerprint in fingerprints:
        conn.execute(
            "INSERT INTO daily_memorial_stage_results "
            "(id, run_id, stage, unit_key, status, input_fingerprint, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(run_id, stage, unit_key) DO NOTHING",
            (
                uuid.uuid4().hex,
                run_id,
                stage.value,
                unit_key,
                StageStatus.PENDING.value,
                fingerprint,
                timestamp,
                timestamp,
            ),
        )


def _claim_aggregate_unit(
    run_id: str,
    stage: StageKind,
    unit_key: str,
    fingerprint: str,
    *,
    now: datetime,
    db_path: Path | None,
) -> str | None:
    conn = db.get_connection(db_path)
    try:
        conn.execute("BEGIN IMMEDIATE")
        run_row = conn.execute(
            "SELECT status FROM daily_memorial_runs WHERE id = ?", (run_id,)
        ).fetchone()
        if run_row is None:
            raise sqlite3.DatabaseError("daily memorial run does not exist")
        if RunStatus(run_row["status"]) is not RunStatus.GENERATING:
            conn.commit()
            return None
        row = conn.execute(
            "SELECT status, input_fingerprint, attempts, next_retry_at, updated_at "
            "FROM daily_memorial_stage_results WHERE run_id = ? AND stage = ? "
            "AND unit_key = ?",
            (run_id, stage.value, unit_key),
        ).fetchone()
        if row is None:
            raise sqlite3.DatabaseError("aggregate unit was not initialized")
        status = StageStatus(row["status"])
        if status in {StageStatus.READY, StageStatus.NO_MATERIAL, StageStatus.FAILED}:
            conn.commit()
            return None
        if row["input_fingerprint"] != fingerprint:
            raise ShiguanStorageError("每日奏报聚合输入已变化")
        if status is StageStatus.RUNNING:
            if datetime.fromisoformat(row["updated_at"]) + _RUNNING_LEASE > now:
                conn.commit()
                return None
            if row["attempts"] >= _MAX_ATTEMPTS:
                _fail_expired_exhausted_claim(
                    conn,
                    run_id=run_id,
                    stage=stage,
                    unit_key=unit_key,
                    fingerprint=fingerprint,
                    updated_at=row["updated_at"],
                    now=now,
                )
                conn.commit()
                return None
        if status is StageStatus.RETRY_WAIT:

            if datetime.fromisoformat(row["next_retry_at"]) > now:
                conn.commit()
                return None
        claim_token = now.isoformat()
        changed = conn.execute(
            "UPDATE daily_memorial_stage_results SET status = ?, attempts = attempts + 1, "
            "failure_code = NULL, next_retry_at = NULL, updated_at = ? WHERE run_id = ? "
            "AND stage = ? AND unit_key = ? AND status = ? AND input_fingerprint = ? "
            "AND updated_at = ? AND EXISTS (SELECT 1 FROM daily_memorial_runs r "
            "WHERE r.id = daily_memorial_stage_results.run_id AND r.status = ?)",
            (
                StageStatus.RUNNING.value,
                claim_token,
                run_id,
                stage.value,
                unit_key,
                status.value,
                fingerprint,
                row["updated_at"],
                RunStatus.GENERATING.value,
            ),
        ).rowcount
        conn.commit()
        return claim_token if changed == 1 else None
    except (ValueError, TypeError, ShiguanStorageError):
        conn.rollback()
        raise
    except sqlite3.Error as exc:
        conn.rollback()
        raise ShiguanStorageError("每日奏报聚合领取失败") from exc
    finally:
        conn.close()


def _finish_aggregate_success(
    run_id: str,
    stage: StageKind,
    unit_key: str,
    fingerprint: str,
    claim_token: str,
    result: BaseModel,
    fact_refs: list[str],
    *,
    now: datetime,
    db_path: Path | None,
) -> bool:
    conn = db.get_connection(db_path)
    try:
        conn.execute("BEGIN IMMEDIATE")
        changed = conn.execute(
            "UPDATE daily_memorial_stage_results SET status = ?, output_json = ?, "
            "fact_refs_json = ?, failure_code = NULL, next_retry_at = NULL, updated_at = ? "
            "WHERE run_id = ? AND stage = ? AND unit_key = ? AND status = ? "
            "AND input_fingerprint = ? AND updated_at = ?",
            (
                StageStatus.READY.value,
                _canonical_json(result.model_dump(mode="json")),
                _canonical_json(fact_refs),
                now.isoformat(),
                run_id,
                stage.value,
                unit_key,
                StageStatus.RUNNING.value,
                fingerprint,
                claim_token,
            ),
        ).rowcount
        conn.commit()
        return changed == 1
    except sqlite3.Error as exc:
        conn.rollback()
        raise ShiguanStorageError("每日奏报聚合提交失败") from exc
    finally:
        conn.close()


def _finish_aggregate_failure(
    run_id: str,
    stage: StageKind,
    unit_key: str,
    fingerprint: str,
    claim_token: str,
    failure_code: str,
    *,
    now: datetime,
    db_path: Path | None,
) -> None:
    conn = db.get_connection(db_path)
    try:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT attempts FROM daily_memorial_stage_results WHERE run_id = ? "
            "AND stage = ? AND unit_key = ? AND status = ? AND input_fingerprint = ? "
            "AND updated_at = ?",
            (
                run_id,
                stage.value,
                unit_key,
                StageStatus.RUNNING.value,
                fingerprint,
                claim_token,
            ),
        ).fetchone()
        if row is None:
            conn.commit()
            return
        attempts = row["attempts"]
        exhausted = attempts >= _MAX_ATTEMPTS
        retry_at = None if exhausted else now + _BACKOFF[attempts - 1]
        changed = conn.execute(
            "UPDATE daily_memorial_stage_results SET status = ?, output_json = 'null', "
            "fact_refs_json = '[]', failure_code = ?, next_retry_at = ?, updated_at = ? "
            "WHERE run_id = ? AND stage = ? AND unit_key = ? AND status = ? "
            "AND input_fingerprint = ? AND updated_at = ?",
            (
                (StageStatus.FAILED if exhausted else StageStatus.RETRY_WAIT).value,
                failure_code,
                None if retry_at is None else retry_at.isoformat(),
                now.isoformat(),
                run_id,

                stage.value,
                unit_key,
                StageStatus.RUNNING.value,
                fingerprint,
                claim_token,
            ),
        ).rowcount
        if exhausted and changed == 1:
            conn.execute(
                "UPDATE daily_memorial_runs SET status = ?, failure_code = ?, "
                "updated_at = ? WHERE id = ? AND status = ? AND NOT EXISTS "
                "(SELECT 1 FROM daily_memorial_stage_results s "
                "WHERE s.run_id = daily_memorial_runs.id AND s.status = ?)",
                (
                    RunStatus.FAILED.value,
                    failure_code,
                    now.isoformat(),
                    run_id,
                    RunStatus.GENERATING.value,
                    StageStatus.RUNNING.value,
                ),
            )
        conn.commit()
    except sqlite3.Error as exc:
        conn.rollback()
        raise ShiguanStorageError("每日奏报聚合失败检查点写入失败") from exc
    finally:
        conn.close()


def _progress_for(
    run_id: str, stage: StageKind, *, db_path: Path | None
) -> StageProgress:
    conn = db.get_connection(db_path)
    try:
        counts = {
            row["status"]: row["count"]
            for row in conn.execute(
                "SELECT status, COUNT(*) AS count FROM daily_memorial_stage_results "
                "WHERE run_id = ? AND stage = ? GROUP BY status",
                (run_id, stage.value),
            ).fetchall()
        }
    finally:
        conn.close()
    return StageProgress(
        run_id=run_id,
        ready=counts.get(StageStatus.READY.value, 0),
        no_material=counts.get(StageStatus.NO_MATERIAL.value, 0),
        retry_wait=counts.get(StageStatus.RETRY_WAIT.value, 0),
        failed=counts.get(StageStatus.FAILED.value, 0),
        pending=counts.get(StageStatus.PENDING.value, 0),
        running=counts.get(StageStatus.RUNNING.value, 0),
    )


def _validate_fact_texts(
    texts: list[str], fact_refs: list[str], facts: tuple[ControlledFact, ...]
) -> None:
    known_refs = {fact.fact_id for fact in facts}
    listed_refs = set(fact_refs)
    if len(fact_refs) != len(listed_refs):
        raise _OutputFailure("duplicate_fact_ref")
    if not listed_refs <= known_refs:
        raise _OutputFailure("unsupported_fact_ref")
    if any(_claims_completed_action(text) for text in texts):
        raise _OutputFailure("forbidden_action_claim")
    for text in texts:
        markers = set(_CITATION.findall(text))
        if not markers <= known_refs:
            raise _OutputFailure("unsupported_fact_ref")
        if not markers <= listed_refs:
            raise _OutputFailure("unsupported_factual_claim")
        for sentence_match in _SENTENCE.finditer(text):
            sentence = sentence_match.group(0).strip()
            if not sentence or sentence.startswith("判断："):
                continue
            citations = set(_CITATION.findall(sentence))
            if not citations:
                raise _OutputFailure("unsupported_factual_claim")
            if not citations <= known_refs:
                raise _OutputFailure("unsupported_fact_ref")
            if not citations <= listed_refs:
                raise _OutputFailure("unsupported_factual_claim")


def _validate_ministry_output(
    raw: object,
    *,
    department: str,
    facts: tuple[ControlledFact, ...],
) -> MinistryDailyResult:
    if isinstance(raw, dict):
        raw_refs = raw.get("fact_refs")
        if isinstance(raw_refs, list) and len(raw_refs) != len(set(raw_refs)):
            raise _OutputFailure("duplicate_fact_ref")
    try:
        result = MinistryDailyResult.model_validate(raw)
    except (ValidationError, TypeError) as exc:
        raise _OutputFailure("invalid_structured_output") from exc
    if result.department != department or tuple(result.bureau_units) != _expected_bureau_keys(
        department
    ):
        raise _OutputFailure("unit_identity_mismatch")
    _validate_fact_texts(
        [result.summary, *result.risks_and_dependencies, *result.decisions_needed],
        result.fact_refs,
        facts,
    )
    return result


def run_ministry_stage(
    run_id: str,
    *,
    invoker: Invoker,
    now: datetime,
    db_path: Path | None = None,
) -> StageProgress:
    """Run six ministries only after all 39 bureau checkpoints are terminal."""


    if not isinstance(now, datetime) or now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("now must include a timezone")
    conn = db.get_connection(db_path)
    try:
        run_row, facts = _load_run_and_facts(conn, run_id)
        if RunStatus(run_row["status"]) is not RunStatus.GENERATING:
            return _progress_for(run_id, StageKind.MINISTRY, db_path=db_path)
        bureau_rows = _ordered_terminal_rows(
            conn, run_id, StageKind.BUREAU, _expected_bureau_keys()
        )
        if bureau_rows is None:
            return _progress_for(run_id, StageKind.MINISTRY, db_path=db_path)
        fingerprints = tuple(
            (
                department,
                _aggregate_fingerprint(
                    StageKind.MINISTRY,
                    department,
                    run_row,
                    facts,
                    tuple(
                        row
                        for row in bureau_rows
                        if row["unit_key"].startswith(f"{department}/")
                    ),
                ),
            )
            for department in MINISTRIES
        )
        conn.execute("BEGIN IMMEDIATE")
        _initialize_aggregate_units(
            conn, run_id, StageKind.MINISTRY, fingerprints, now
        )
        conn.commit()
    finally:
        conn.close()
    fingerprint_by_department = dict(fingerprints)
    for department in MINISTRIES:
        fingerprint = fingerprint_by_department[department]
        claim_token = _claim_aggregate_unit(
            run_id,
            StageKind.MINISTRY,
            department,
            fingerprint,
            now=now,
            db_path=db_path,
        )
        if claim_token is None:
            progress = _progress_for(run_id, StageKind.MINISTRY, db_path=db_path)
            if progress.terminal == len(MINISTRIES):
                continue
            return progress
        own_rows = tuple(
            row
            for row in bureau_rows
            if row["unit_key"].startswith(f"{department}/")
        )
        bureau_payload = tuple(
            {
                "unit_key": row["unit_key"],
                "status": row["status"],
                "output": None
                if row["output_json"] in (None, "null")
                else json.loads(row["output_json"]),
            }
            for row in own_rows
        )
        try:
            raw = invoker(
                StageKind.MINISTRY.value,
                department,
                build_ministry_prompt(department, bureau_payload, facts),
                MinistryDailyResult,
            )
            result = _validate_ministry_output(
                raw, department=department, facts=facts
            )
        except ConfigurationUnavailable:
            _finish_aggregate_failure(
                run_id,
                StageKind.MINISTRY,
                department,
                fingerprint,
                claim_token,
                "configuration_unavailable",
                now=now,
                db_path=db_path,
            )
            return _progress_for(run_id, StageKind.MINISTRY, db_path=db_path)
        except _OutputFailure as exc:
            _finish_aggregate_failure(
                run_id,
                StageKind.MINISTRY,
                department,
                fingerprint,
                claim_token,
                exc.code,
                now=now,
                db_path=db_path,
            )
            return _progress_for(run_id, StageKind.MINISTRY, db_path=db_path)
        except Exception:
            _finish_aggregate_failure(
                run_id,
                StageKind.MINISTRY,
                department,
                fingerprint,
                claim_token,
                "invocation_failed",
                now=now,
                db_path=db_path,
            )
            return _progress_for(run_id, StageKind.MINISTRY, db_path=db_path)
        if not _finish_aggregate_success(
            run_id,
            StageKind.MINISTRY,
            department,
            fingerprint,
            claim_token,

            result,
            result.fact_refs,
            now=now,
            db_path=db_path,
        ):
            return _progress_for(run_id, StageKind.MINISTRY, db_path=db_path)
    return _progress_for(run_id, StageKind.MINISTRY, db_path=db_path)


def _validate_chancellor_output(
    raw: object,
    *,
    run: DailyMemorialRun,
    ministry_results: tuple[MinistryDailyResult, ...],
    facts: tuple[ControlledFact, ...],
) -> ChancellorDailyResult:
    if isinstance(raw, dict):
        raw_refs = raw.get("fact_refs")
        if isinstance(raw_refs, list) and len(raw_refs) != len(set(raw_refs)):
            raise _OutputFailure("duplicate_fact_ref")
    try:
        result = ChancellorDailyResult.model_validate(raw)
    except (ValidationError, TypeError) as exc:
        raise _OutputFailure("invalid_structured_output") from exc
    if (
        result.report_date != run.report_date
        or result.fact_cutoff != run.source_window_end.isoformat()
        or tuple(result.ministry_sections) != ministry_results
        or tuple(section.department for section in result.ministry_sections) != MINISTRIES
    ):
        raise _OutputFailure("unit_identity_mismatch")
    _validate_fact_texts(
        [result.content, *result.cross_ministry_risks, *result.decisions_needed],
        result.fact_refs,
        facts,
    )
    return result


def _finalize_chancellor(
    run_id: str,
    fingerprint: str,
    claim_token: str,
    claimed_run: DailyMemorialRun,
    result: ChancellorDailyResult,
    input_fingerprints: tuple[str, ...],
    *,
    now: datetime,
    db_path: Path | None,
) -> bool:
    draft = adapt_chancellor_result_to_draft(
        result, input_fingerprints=input_fingerprints
    )
    conn = db.get_connection(db_path)
    try:
        conn.execute("BEGIN IMMEDIATE")
        ministry_rows = _ordered_terminal_rows(
            conn, run_id, StageKind.MINISTRY, MINISTRIES
        )
        if ministry_rows is None:
            conn.rollback()
            return False
        current_run_row, facts = _load_run_and_facts(conn, run_id)
        current_fingerprint = _aggregate_fingerprint(
            StageKind.CHANCELLOR,
            "chancellor",
            current_run_row,
            facts,
            ministry_rows,
        )
        if current_fingerprint != fingerprint:
            conn.rollback()
            return False
        stage_changed = conn.execute(
            "UPDATE daily_memorial_stage_results SET status = ?, output_json = ?, "
            "fact_refs_json = ?, failure_code = NULL, next_retry_at = NULL, updated_at = ? "
            "WHERE run_id = ? AND stage = ? AND unit_key = ? AND status = ? "
            "AND input_fingerprint = ? AND updated_at = ?",
            (
                StageStatus.READY.value,
                _canonical_json(result.model_dump(mode="json")),
                _canonical_json(result.fact_refs),
                now.isoformat(),
                run_id,
                StageKind.CHANCELLOR.value,
                "chancellor",
                StageStatus.RUNNING.value,
                fingerprint,
                claim_token,
            ),
        ).rowcount
        run_changed = conn.execute(
            "UPDATE daily_memorial_runs SET content = ?, fact_refs_json = ?, version = 1, "
            "fingerprint = ?, status = ?, updated_at = ? WHERE id = ? AND status = ? "
            "AND report_date = ? AND source_window_start = ? AND source_window_end = ? "
            "AND version = 0 AND content IS NULL AND fingerprint IS NULL",
            (
                draft.content,
                _canonical_json(draft.fact_refs),
                draft.fingerprint,
                RunStatus.READY_FOR_REVIEW.value,
                now.isoformat(),
                run_id,
                RunStatus.GENERATING.value,
                claimed_run.report_date.isoformat(),
                claimed_run.source_window_start.isoformat(),
                claimed_run.source_window_end.isoformat(),
            ),
        ).rowcount
        if stage_changed != 1 or run_changed != 1:
            conn.rollback()
            return False
        conn.commit()
        return True
    except sqlite3.Error as exc:
        conn.rollback()
        raise ShiguanStorageError("每日奏报丞相草稿提交失败") from exc
    finally:
        conn.close()



def run_chancellor_stage(
    run_id: str,
    *,
    invoker: Invoker,
    now: datetime,
    db_path: Path | None = None,
) -> DailyMemorialRun:
    """Create the sole pending Chancellor draft after all ministries finish."""

    if not isinstance(now, datetime) or now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("now must include a timezone")
    run = _load_run(run_id, db_path=db_path)
    if run.status is not RunStatus.GENERATING:
        return run
    conn = db.get_connection(db_path)
    try:
        run_row, facts = _load_run_and_facts(conn, run_id)
        ministry_rows = _ordered_terminal_rows(
            conn, run_id, StageKind.MINISTRY, MINISTRIES
        )
        if ministry_rows is None:
            return run
        try:
            ministry_results = tuple(
                MinistryDailyResult.model_validate_json(row["output_json"])
                for row in ministry_rows
            )
        except (ValidationError, TypeError) as exc:
            raise ShiguanStorageError("每日奏报六部检查点校验失败") from exc
        if tuple(item.department for item in ministry_results) != MINISTRIES:
            raise ShiguanStorageError("每日奏报六部名录校验失败")
        fingerprint = _aggregate_fingerprint(
            StageKind.CHANCELLOR, "chancellor", run_row, facts, ministry_rows
        )
        conn.execute("BEGIN IMMEDIATE")
        _initialize_aggregate_units(
            conn,
            run_id,
            StageKind.CHANCELLOR,
            (("chancellor", fingerprint),),
            now,
        )
        conn.commit()
    finally:
        conn.close()
    claim_token = _claim_aggregate_unit(
        run_id,
        StageKind.CHANCELLOR,
        "chancellor",
        fingerprint,
        now=now,
        db_path=db_path,
    )
    if claim_token is None:
        return _load_run(run_id, db_path=db_path)
    try:
        raw = invoker(
            StageKind.CHANCELLOR.value,
            "chancellor",
            build_chancellor_prompt(
                report_date=run.report_date.isoformat(),
                fact_cutoff=run.source_window_end.isoformat(),
                ministry_results=ministry_results,
                fact_refs=tuple(fact.fact_id for fact in facts),
            ),
            ChancellorDailyResult,
        )
        result = _validate_chancellor_output(
            raw, run=run, ministry_results=ministry_results, facts=facts
        )
    except ConfigurationUnavailable:
        _finish_aggregate_failure(
            run_id,
            StageKind.CHANCELLOR,
            "chancellor",
            fingerprint,
            claim_token,
            "configuration_unavailable",
            now=now,
            db_path=db_path,
        )
        return _load_run(run_id, db_path=db_path)
    except _OutputFailure as exc:
        _finish_aggregate_failure(
            run_id,
            StageKind.CHANCELLOR,
            "chancellor",
            fingerprint,
            claim_token,
            exc.code,
            now=now,
            db_path=db_path,
        )
        return _load_run(run_id, db_path=db_path)
    except Exception:
        _finish_aggregate_failure(
            run_id,
            StageKind.CHANCELLOR,
            "chancellor",
            fingerprint,
            claim_token,
            "invocation_failed",
            now=now,
            db_path=db_path,
        )
        return _load_run(run_id, db_path=db_path)
    input_fingerprints = tuple(row["input_fingerprint"] for row in ministry_rows)
    _finalize_chancellor(
        run_id,
        fingerprint,
        claim_token,
        run,
        result,
        input_fingerprints,
        now=now,
        db_path=db_path,
    )
    return _load_run(run_id, db_path=db_path)



def advance_run(
    run_id: str,
    *,
    invoker: Invoker,
    now: datetime,
    db_path: Path | None = None,
) -> DailyMemorialRun:
    """Advance synchronously across 39 -> 6 -> 1 without crossing a barrier."""

    run = _load_run(run_id, db_path=db_path)
    if run.status not in {RunStatus.PENDING, RunStatus.GENERATING}:
        return run
    bureau_progress = run_bureau_stage(
        run_id, invoker=invoker, now=now, db_path=db_path
    )
    if bureau_progress.terminal != len(BUREAU_PROFILES):
        return _load_run(run_id, db_path=db_path)
    ministry_progress = run_ministry_stage(
        run_id, invoker=invoker, now=now, db_path=db_path
    )
    if ministry_progress.terminal != len(MINISTRIES):
        return _load_run(run_id, db_path=db_path)
    return run_chancellor_stage(run_id, invoker=invoker, now=now, db_path=db_path)


__all__ = [
    "ChancellorDraftPayload",
    "BureauDailyResult",
    "BureauDailyStatus",
    "ConfigurationUnavailable",
    "StageProgress",
    "StageResult",
    "adapt_chancellor_result_to_draft",
    "advance_run",
    "load_stage_result",
    "run_bureau_stage",
    "run_chancellor_stage",
    "run_ministry_stage",
]
