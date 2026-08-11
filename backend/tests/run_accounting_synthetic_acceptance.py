"""Run the offline accounting report flow through real FastAPI and Next servers."""

from __future__ import annotations

import json
import os
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
from contextlib import closing
from http.cookiejar import CookieJar
from io import BytesIO
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import HTTPCookieProcessor, Request, build_opener, urlopen

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
ACCOUNTING_DECREE = "我想用本地数据分析出2025年的财务数据分析一下"
SHEETS = [
    "管理摘要",
    "核心财务报表",
    "科目趋势",
    "异常分析",
    "科目明细",
    "校验结果",
    "数据来源",
]

PROTECTED_PORTS = frozenset({3000, 8000, 13000, 18000, 13381, 18381})


def _free_port(excluded_ports: set[int] | frozenset[int]) -> int:
    for _attempt in range(20):
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = int(sock.getsockname()[1])
        if port not in excluded_ports:
            return port
    raise RuntimeError("unable to allocate an unprotected unique loopback port")


def _wait(url: str, process: subprocess.Popen[bytes]) -> None:
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"server exited early: {process.returncode}")
        try:
            with urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except (HTTPError, URLError, TimeoutError):
            time.sleep(0.2)
    raise RuntimeError(f"server did not become ready: {url}")


def _json_request(
    opener, url: str, payload: dict[str, object], cookie: str | None = None
):
    headers = {"content-type": "application/json"}
    if cookie is not None:
        headers["cookie"] = cookie
    request = Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode(),
        method="POST",
        headers=headers,
    )
    with opener.open(request, timeout=30) as response:
        return response.status, json.loads(response.read())


def _poll_job(opener, base: str, job_id: str, cookie: str) -> dict[str, object]:
    deadline = time.monotonic() + 60
    last: dict[str, object] | None = None
    while time.monotonic() < deadline:
        request = Request(
            f"{base}/api/decree-jobs/{job_id}",
            headers={"cookie": cookie},
        )
        with opener.open(request, timeout=30) as response:
            assert response.status == 200
            last = json.loads(response.read())
        if last.get("state") in {"SUCCEEDED", "FAILED", "CANCELLED"}:
            return last
        time.sleep(0.1)
    raise AssertionError(f"decree job did not reach a terminal state: {last}")


def _stop(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=10)


def _expect_http_error(opener, request: Request, expected: int) -> None:
    try:
        opener.open(request, timeout=30)
    except HTTPError as error:
        try:
            assert error.code == expected
        finally:
            error.close()
    else:
        raise AssertionError(f"request unexpectedly succeeded; expected HTTP {expected}")


def _start_servers(
    backend_port: int,
    frontend_port: int,
    environment: dict[str, str],
) -> tuple[subprocess.Popen[bytes], subprocess.Popen[bytes]]:
    backend: subprocess.Popen[bytes] | None = None
    frontend: subprocess.Popen[bytes] | None = None
    try:
        backend = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "tests.synthetic_accounting_acceptance_app:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(backend_port),
            ],
            cwd=BACKEND,
            env=environment,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        next_environment = environment.copy()
        next_environment["BACKEND_BASE_URL"] = f"http://127.0.0.1:{backend_port}"
        frontend = subprocess.Popen(
            [
                "node",
                "node_modules/next/dist/bin/next",
                "start",
                "--hostname",
                "127.0.0.1",
                "--port",
                str(frontend_port),
            ],
            cwd=FRONTEND,
            env=next_environment,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return backend, frontend
    except Exception:
        if frontend is not None:
            _stop(frontend)
        if backend is not None:
            _stop(backend)
        raise


def main() -> int:
    used_ports = set(PROTECTED_PORTS)
    backend_port = _free_port(used_ports)
    used_ports.add(backend_port)
    frontend_port = _free_port(used_ports)
    with tempfile.TemporaryDirectory(prefix="chaotang-accounting-acceptance-") as tmp:
        environment = os.environ.copy()
        environment["CHAOTANG_SYNTHETIC_ACCEPTANCE_TMP"] = tmp
        environment["CHAOTANG_DECREE_JOB_WORKER_ENABLED"] = "1"
        environment["DEEPSEEK_API_KEY"] = ""
        environment["JINYIWEI_EXTERNAL_NETWORK_ENABLED"] = ""
        environment["JINYIWEI_MCP_CREDENTIAL_SOURCE"] = "env"
        backend, frontend = _start_servers(
            backend_port, frontend_port, environment
        )
        try:
            _wait(f"http://127.0.0.1:{backend_port}/health", backend)
            _wait(f"http://127.0.0.1:{frontend_port}/study", frontend)
            base = f"http://127.0.0.1:{frontend_port}"
            owner_jar, other_jar, failure_jar = CookieJar(), CookieJar(), CookieJar()
            owner = build_opener(HTTPCookieProcessor(owner_jar))
            other = build_opener(HTTPCookieProcessor(other_jar))
            failure_owner = build_opener(HTTPCookieProcessor(failure_jar))
            session_cookies: dict[str, str] = {}
            for opener, jar, username in (
                (owner, owner_jar, "synthetic-owner"),
                (other, other_jar, "synthetic-other"),
                (failure_owner, failure_jar, "synthetic-failure"),
            ):
                status, _body = _json_request(
                    opener,
                    f"{base}/api/auth/register",
                    {
                        "username": username,
                        "email": f"{username}@example.test",
                        "password": "six-or-more",
                    },
                )
                assert status == 201
                status, _body = _json_request(
                    opener,
                    f"{base}/api/auth/login",
                    {"identifier": username, "password": "six-or-more"},
                )
                assert status == 200
                cookie = next(iter(jar))
                session_cookies[username] = f"{cookie.name}={cookie.value}"

            status, draft = _json_request(
                owner,
                f"{base}/api/drafts/chancellor",
                {
                    "messages": [{"role": "user", "content": ACCOUNTING_DECREE}],
                    "version": 1,
                },
                session_cookies["synthetic-owner"],
            )
            assert status == 200
            assert draft["status"] == "DRAFT_READY"
            assert "2025" in draft["expert_example"]
            assert "2025" in draft["decree_text"]
            assert "2025" in ACCOUNTING_DECREE
            assert draft["draft"]["departments"] == [
                {
                    "department": "户部",
                    "bureaus": ["会计司"],
                    "role": "主审",
                    "reason": "负责财务报表。",
                    "responsibility": "生成并校验报表。",
                    "expected_output": "可下载的 Excel 文件。",
                }
            ]

            replacement = Request(
                f"{base}/api/decrees/chancellor",
                data=json.dumps({
                    "decreeText": "客户端替换的 2024 年财务报表",
                    "draftVersion": draft["version"],
                    "draftFingerprint": draft["fingerprint"],
                    "idempotencyKey": "synthetic-owner-replacement",
                }, ensure_ascii=False).encode(),
                method="POST",
                headers={
                    "content-type": "application/json",
                    "cookie": session_cookies["synthetic-owner"],
                },
            )
            _expect_http_error(owner, replacement, 409)

            status, decree = _json_request(
                owner,
                f"{base}/api/decrees/chancellor",
                {
                    "decreeText": draft["decree_text"],
                    "draftVersion": draft["version"],
                    "draftFingerprint": draft["fingerprint"],
                    "idempotencyKey": "synthetic-owner-success",
                },
                session_cookies["synthetic-owner"],
            )
            assert status == 202
            assert decree["state"] == "QUEUED"
            job = _poll_job(
                owner,
                base,
                decree["jobId"],
                session_cookies["synthetic-owner"],
            )
            with closing(
                sqlite3.connect(Path(tmp) / "decree_jobs.sqlite3")
            ) as connection:
                job_diagnostic = connection.execute(
                    "SELECT state, error_code, error_stage, error_category "
                    "FROM decree_jobs WHERE job_id = ?",
                    (decree["jobId"],),
                ).fetchone()
            assert job["state"] == "SUCCEEDED", (
                job,
                job_diagnostic,
            )
            assert job["error"] is None
            decree = job["result"]
            assert isinstance(decree, dict)
            assert decree["routeType"] == "single"
            assert decree["departments"] == ["户部"]
            assert decree["processingPath"] == [
                "上书房",
                "丞相（首次分流）",
                "户部",
                "户部·会计司",
                "户部（部级补充）",
                "丞相（最终汇总）",
            ]
            assert decree["councilVerdict"] is None
            assert decree["deliveryKind"] == "accounting_analysis"
            assert len(decree["artifacts"]) == 1
            artifact = decree["artifacts"][0]
            assert artifact["periodStart"] == artifact["periodEnd"] == 2025
            assert artifact["kind"] == "ACCOUNTING_MANAGEMENT_REPORT_XLSX"
            assert artifact["displayName"].endswith(".xlsx")
            artifact_id = artifact["artifactId"]
            download_url = f"{base}/api/report-artifacts/{artifact_id}"
            owner_request = Request(
                download_url,
                headers={"cookie": session_cookies["synthetic-owner"]},
            )
            with owner.open(owner_request, timeout=30) as response:
                assert response.status == 200
                assert response.headers.get_content_type() == (
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                )
                assert response.headers["content-disposition"].startswith(
                    "attachment; filename*=UTF-8''"
                )
                assert response.headers["content-disposition"].endswith(".xlsx")
                workbook_bytes = response.read()
            try:
                other.open(
                    Request(
                        download_url,
                        headers={"cookie": session_cookies["synthetic-other"]},
                    ),
                    timeout=30,
                )
            except HTTPError as error:
                try:
                    assert error.code == 404
                finally:
                    error.close()
            else:
                raise AssertionError("second owner unexpectedly downloaded the artifact")

            unsafe_url = f"{base}/api/report-artifacts/{quote('../secret', safe='')}"
            _expect_http_error(
                owner,
                Request(unsafe_url, headers={"cookie": session_cookies["synthetic-owner"]}),
                400,
            )

            workbook = load_workbook(BytesIO(workbook_bytes), data_only=False)
            try:
                assert workbook.sheetnames == SHEETS
                details = workbook["科目明细"]
                assert {
                    details.cell(row, 1).value
                    for row in range(2, details.max_row + 1)
                } == {2025}
                assets = sum(
                    int(str(details.cell(row, 12).value).lstrip("="))
                    for row in range(2, details.max_row + 1)
                    if details.cell(row, 14).value == "assets"
                )
                assert assets == 1000
                checks = workbook["校验结果"]
                assert checks.cell(1, 1).value == "校验项"
                sources = workbook["数据来源"]
                assert {sources.cell(row, 1).value for row in range(1, sources.max_row + 1)} >= {
                    "报告期间",
                    "来源哈希",
                }
                assert next(
                    sources.cell(row, 2).value
                    for row in range(1, sources.max_row + 1)
                    if sources.cell(row, 1).value == "报告期间"
                ) == "2025-2025"
            finally:
                workbook.close()

            with closing(sqlite3.connect(Path(tmp) / "artifacts.sqlite3")) as connection:
                report_row = connection.execute(
                    "SELECT artifact_id, reply_id, state, period_start, period_end "
                    "FROM report_artifacts"
                ).fetchone()
            assert report_row is not None
            assert report_row[0] == artifact_id
            assert report_row[1]
            assert report_row[2:] == ("PUBLISHED", 2025, 2025)
            with closing(sqlite3.connect(Path(tmp) / "shiguan.sqlite3")) as connection:
                reply = connection.execute(
                    "SELECT id, type, source_kind, source_text FROM archives WHERE id = ?",
                    (report_row[1],),
                ).fetchone()
            assert reply == (report_row[1], "REPLY", "DECREE", draft["decree_text"])
            assert {path.name for path in (Path(tmp) / "report_artifacts").iterdir()} == {
                f"{artifact_id}.xlsx"
            }

            toggle = Request(
                f"http://127.0.0.1:{backend_port}/__synthetic__/fail-next",
                data=b"",
                method="POST",
            )
            try:
                with urlopen(toggle, timeout=30) as response:
                    assert response.status == 204
            except HTTPError as error:
                try:
                    raise AssertionError(
                        f"failure injection endpoint returned HTTP {error.code}"
                    ) from error
                finally:
                    error.close()

            status, failed_draft = _json_request(
                failure_owner,
                f"{base}/api/drafts/chancellor",
                {
                    "messages": [{"role": "user", "content": ACCOUNTING_DECREE}],
                    "version": 1,
                },
                session_cookies["synthetic-failure"],
            )
            assert status == 200
            assert failed_draft["status"] == "DRAFT_READY"
            failed_request = Request(
                f"{base}/api/decrees/chancellor",
                data=json.dumps({
                    "decreeText": failed_draft["decree_text"],
                    "draftVersion": failed_draft["version"],
                    "draftFingerprint": failed_draft["fingerprint"],
                    "idempotencyKey": "synthetic-failure",
                }, ensure_ascii=False).encode(),
                method="POST",
                headers={
                    "content-type": "application/json",
                    "cookie": session_cookies["synthetic-failure"],
                },
            )
            with failure_owner.open(failed_request, timeout=30) as response:
                assert response.status == 202
                failed_acceptance = json.loads(response.read())
            failed_job = _poll_job(
                failure_owner,
                base,
                failed_acceptance["jobId"],
                session_cookies["synthetic-failure"],
            )
            assert failed_job["state"] == "FAILED"
            assert failed_job["result"] is None
            assert failed_job["error"] == {
                "code": "job_failed",
                "stage": "execution",
                "category": "internal",
            }
            with closing(sqlite3.connect(Path(tmp) / "artifacts.sqlite3")) as connection:
                states = [
                    row[0]
                    for row in connection.execute(
                        "SELECT state FROM report_artifacts ORDER BY created_at"
                    )
                ]
            assert states == ["PUBLISHED", "ABORTED"]
            assert {path.name for path in (Path(tmp) / "report_artifacts").iterdir()} == {
                f"{artifact_id}.xlsx"
            }
            print(
                "synthetic-accounting-acceptance: PASS "
                "(explicit-analysis-2025, canonical authority, published identity, "
                "owner isolation, "
                "unsafe ID rejection, seven sheets, source/check disclosures)"
            )
            return 0
        finally:
            _stop(frontend)
            _stop(backend)


if __name__ == "__main__":
    sys.exit(main())
