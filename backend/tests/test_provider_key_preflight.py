"""#1 provider 启动 key 校验冒烟 — 无网络、确定性。

守住"没 key 早失败"这道反脆弱护栏:active provider 缺 key 时 check 返回 False,
启动会 loud 告警(web/main.py lifespan),而不是跑到第一次 LLM 调用才哑。
本地 provider(localhost)免 key。fallback 兜底本身已由 FlowEngine 自动挂(实跑验证)。
"""

from src import provider


def test_missing_key_flagged(monkeypatch):
    monkeypatch.delenv("__T_PREFLIGHT_KEY__", raising=False)
    cfg = {
        "active": "deepseek",
        "providers": {
            "deepseek": {
                "api_key_env": "__T_PREFLIGHT_KEY__",
                "api_base": "https://api.deepseek.com/v1",
            }
        },
    }
    ok, msg = provider.check_active_provider_key(cfg)
    assert ok is False
    assert "未加载" in msg


def test_present_key_ok(monkeypatch):
    monkeypatch.setenv("__T_PREFLIGHT_KEY__", "sk-xxx")
    cfg = {
        "active": "deepseek",
        "providers": {
            "deepseek": {
                "api_key_env": "__T_PREFLIGHT_KEY__",
                "api_base": "https://api.deepseek.com/v1",
            }
        },
    }
    ok, msg = provider.check_active_provider_key(cfg)
    assert ok is True
    assert "已加载" in msg


def test_local_provider_exempt_from_key():
    cfg = {
        "active": "ollama_local",
        "providers": {
            "ollama_local": {
                "api_key_env": "OLLAMA_API_KEY",
                "api_base": "http://localhost:11434/v1",
            }
        },
    }
    ok, msg = provider.check_active_provider_key(cfg)
    assert ok is True
    assert "免 key" in msg


def test_no_active_provider_flagged():
    ok, msg = provider.check_active_provider_key({"providers": {}})
    assert ok is False
