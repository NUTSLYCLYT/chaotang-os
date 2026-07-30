"""Run the offline accounting report flow through real FastAPI and Next servers."""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
from http.cookiejar import CookieJar
from io import BytesIO
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import HTTPCookieProcessor, Request, build_opener, urlopen

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
SHEETS = [
    "管理摘要",
    "核心财务报表",
    "科目趋势",
    "异常分析",
    "科目明细",
    "校验结果",
    "数据来源",
]


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


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


def _stop(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=10)


def main() -> int:
    backend_port, frontend_port = _free_port(), _free_port()
    with tempfile.TemporaryDirectory(prefix="chaotang-accounting-acceptance-") as tmp:
        environment = os.environ.copy()
        environment["CHAOTANG_SYNTHETIC_ACCEPTANCE_TMP"] = tmp
        backend = subprocess.Popen(
            [
                str(BACKEND / ".venv" / "Scripts" / "python.exe"),
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
        try:
            _wait(f"http://127.0.0.1:{backend_port}/health", backend)
            _wait(f"http://127.0.0.1:{frontend_port}/study", frontend)
            base = f"http://127.0.0.1:{frontend_port}"
            owner_jar, other_jar = CookieJar(), CookieJar()
            owner = build_opener(HTTPCookieProcessor(owner_jar))
            other = build_opener(HTTPCookieProcessor(other_jar))
            session_cookies: dict[str, str] = {}
            for opener, jar, username in (
                (owner, owner_jar, "synthetic-owner"),
                (other, other_jar, "synthetic-other"),
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
                cookie = next(iter(jar))
                session_cookies[username] = f"{cookie.name}={cookie.value}"

            status, decree = _json_request(
                owner,
                f"{base}/api/decrees/chancellor",
                {
                    "decreeText": "请生成2025年财务报表",
                    "draftVersion": 1,
                    "draftFingerprint": "a" * 64,
                },
                session_cookies["synthetic-owner"],
            )
            assert status == 200
            assert decree["routeType"] == "single"
            assert decree["departments"] == ["户部"]
            assert len(decree["artifacts"]) == 1
            artifact_id = decree["artifacts"][0]["artifactId"]
            download_url = f"{base}/api/report-artifacts/{artifact_id}"
            owner_request = Request(
                download_url,
                headers={"cookie": session_cookies["synthetic-owner"]},
            )
            with owner.open(owner_request, timeout=30) as response:
                assert response.status == 200
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
                assert error.code == 404
            else:
                raise AssertionError("second owner unexpectedly downloaded the artifact")

            workbook = load_workbook(BytesIO(workbook_bytes), data_only=False)
            try:
                assert workbook.sheetnames == SHEETS
                details = workbook["科目明细"]
                assets = sum(
                    int(str(details.cell(row, 12).value).lstrip("="))
                    for row in range(2, details.max_row + 1)
                    if details.cell(row, 14).value == "assets"
                )
                assert assets == 1000
            finally:
                workbook.close()
            print(
                "synthetic-accounting-acceptance: PASS "
                "(Next BFF decree/download, owner 200, owner2 404, seven sheets, assets=1000)"
            )
            return 0
        finally:
            _stop(frontend)
            _stop(backend)


if __name__ == "__main__":
    sys.exit(main())
