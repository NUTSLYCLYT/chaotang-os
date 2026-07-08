"""Tests for OpenClaw integration step in FlowEngine."""

from unittest.mock import MagicMock, patch

import httpx
import pytest

from src.flow_engine import FlowEngine


def _make_engine():
    """Minimal FlowEngine with openclaw step config."""
    engine = FlowEngine.__new__(FlowEngine)
    return engine


class TestExecuteOpenclawStep:
    def setup_method(self):
        self.engine = _make_engine()
        self.step_config = {"step_type": "openclaw", "id": "openclaw_test"}
        self.rendered = "上游内容：需求分析结论"

    def test_success(self):
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {"response": "可行性分析结果"}

        with patch("httpx.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value.__enter__ = MagicMock(return_value=mock_client)
            mock_client_cls.return_value.__exit__ = MagicMock(return_value=False)
            mock_client.post.return_value = mock_resp

            result = self.engine._execute_openclaw_step(self.step_config, self.rendered)

        assert result["status"] == "success"
        assert "可行性分析结果" in result["output"]

    def test_timeout(self):
        with patch("httpx.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value.__enter__ = MagicMock(return_value=mock_client)
            mock_client_cls.return_value.__exit__ = MagicMock(return_value=False)
            mock_client.post.side_effect = httpx.TimeoutException("timeout")

            result = self.engine._execute_openclaw_step(self.step_config, self.rendered)

        assert result["status"] == "error"
        assert "超时" in result["output"]

    def test_non_json_response(self):
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {"content": "plain text result"}

        with patch("httpx.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value.__enter__ = MagicMock(return_value=mock_client)
            mock_client_cls.return_value.__exit__ = MagicMock(return_value=False)
            mock_client.post.return_value = mock_resp

            result = self.engine._execute_openclaw_step(self.step_config, self.rendered)

        assert result["status"] == "success"
        assert result["output"] == "plain text result"
