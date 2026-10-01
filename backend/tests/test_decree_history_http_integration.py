"""Real loopback HTTP and auth; tasks are explicit fixtures, never Agent output."""

from __future__ import annotations

import json
import socket
import time
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from threading import Thread
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import uvicorn

from app.api.decree_jobs import get_decree_job_store
from app.auth import configure_auth_db
from app.decree_jobs.models import AcceptDecreeJob
from app.decree_jobs.storage import DecreeJobStore
from app.main import app


@contextmanager
def _server(root):
    configure_auth_db(root / "auth.sqlite3")
    store = DecreeJobStore(root / "jobs.sqlite3")
    previous = dict(app.dependency_overrides)
    app.dependency_overrides[get_decree_job_store] = lambda: store
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(app, log_level="error", access_log=False))
    thread = Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
    try:
        thread.start()
        deadline = time.monotonic() + 10
        while not server.started and thread.is_alive() and time.monotonic() < deadline:
            time.sleep(0.01)
        assert server.started, "temporary HTTP server did not start"
        yield f"http://127.0.0.1:{port}", store
    finally:
        server.should_exit = True
        thread.join(timeout=10)
        sock.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        configure_auth_db(None)
        assert not thread.is_alive(), "temporary HTTP server was not shut down"


def _request(base, path, *, token=None, method="GET", payload=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(
        base + path,
        method=method,
        headers=headers,
        data=json.dumps(payload).encode() if payload is not None else None,
    )
    try:
        response = urlopen(request, timeout=5)
    except HTTPError as error:
        response = error
    with response:
        body = response.read()
        return response.status, json.loads(body) if body else None


def test_real_http_history_auth_restart_and_logout(tmp_path, monkeypatch):
    monkeypatch.setenv("CHAOTANG_DECREE_JOB_WORKER_ENABLED", "false")
    monkeypatch.setenv("JINYIWEI_EXTERNAL_NETWORK_ENABLED", "false")
    route = "/api/v1/decree-jobs"
    with _server(tmp_path) as (base, store):
        assert _request(base, route)[0] == 401
        assert _request(base, route + "/missing/history-annotation")[0] == 401
        assert (
            _request(
                base,
                route + "/missing/history-annotation",
                method="PUT",
                payload={"archived": True},
            )[0]
            == 401
        )
        users = []
        for username in ("history-a", "history-b"):
            code, registered = _request(
                base,
                "/api/v1/auth/register",
                method="POST",
                payload={
                    "username": username,
                    "email": username + "@example.com",
                    "password": "fixture-only-password",
                },
            )
            assert code == 201
            code, logged_in = _request(
                base,
                "/api/v1/auth/login",
                method="POST",
                payload={
                    "identifier": username,
                    "password": "fixture-only-password",
                },
            )
            assert code == 200
            users.append((registered["user"]["id"], logged_in["session_id"]))
        owner, token = users[0]
        other_token = users[1][1]
        now = datetime.now(UTC)
        # Fixture acceptance only; no executor, result synthesis, or model invocation.
        job_id = store.accept(
            AcceptDecreeJob(
                owner_user_id=owner,
                idempotency_key="http-fixture",
                request_hash="fixture",
                draft_fingerprint="a" * 64,
                decree_text="调查开源项目（HTTP 测试输入）",
                approved_route_json='{"route_type":"single"}',
                deadline_at=now + timedelta(minutes=10),
            ),
            now=now,
        ).job.job_id
        annotation = f"{route}/{job_id}/history-annotation"
        code, page = _request(base, route, token=token)
        assert code == 200 and page["total"] == 1
        assert _request(base, route, token=other_token)[1]["total"] == 0
        for identifier in (job_id, "missing"):
            path = f"{route}/{identifier}/history-annotation"
            assert _request(base, path, token=other_token)[0] == 404
            assert (
                _request(base, path, token=other_token, method="PUT", payload={"archived": True})[0]
                == 404
            )
        assert (
            _request(base, annotation, token=token, method="PUT", payload={"archived": True})[0]
            == 409
        )
        assert _request(base, f"{route}/{job_id}/cancel", token=token, method="POST")[0] == 200
        code, marker = _request(
            base, annotation, token=token, method="PUT", payload={"archived": True}
        )
        assert code == 200 and marker["history_archived"]
        assert _request(base, route, token=token)[1]["total"] == 0
        assert _request(base, route + "?archived=archived", token=token)[1]["total"] == 1
    # A new Uvicorn server and store use the same temporary databases.
    with _server(tmp_path) as (base, _):
        assert _request(base, annotation, token=token) == (200, marker)
        assert _request(
            base, annotation, token=token, method="PUT", payload={"archived": True}
        ) == (200, marker)
        assert (
            _request(base, annotation, token=token, method="PUT", payload={"archived": False})[0]
            == 200
        )
        assert _request(base, route, token=token)[1]["total"] == 1
        assert _request(base, "/api/v1/auth/logout", token=token, method="POST")[0] == 204
        assert _request(base, route, token=token)[0] == 401
