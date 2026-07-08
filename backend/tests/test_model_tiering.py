"""ModelTiering 回归 — 复现并守住"provider 覆盖 tier 时 api_key_env 必须跟 api_base
同源"这条铁律。

真实事故(2026-07-06,flow_pack_rd 全新任务跑到第 8 步 bms_summary 时全链中断):
providers.yaml active=deepseek 覆盖 flow_config 后,ModelTiering._load() 把 tier
的 api_base 换成了 deepseek 官方地址(https://api.deepseek.com/v1),却把
api_key_env 硬编码成 LITELLM_PROXY_KEY(litellm 代理的 master key,不是 deepseek
官方 key)。结果:拿着 litellm 代理的 key 去敲 deepseek 官方的门,鉴权失败
("Authentication Fails, Your api key: ****9eeb is invalid"),bms_summary 这步
连同后续 10 步(含两道确定性闸)全部级联失败,一份完整 PACK 方案直接腰斩成 8 步。
"""

from src.model_tiering import ModelTiering


def test_provider_override_keeps_api_key_env_in_sync_with_api_base(tmp_path):
    # tier 原配置是豆包(ARK_API_KEY),flow_config 被 active provider(deepseek)
    # 覆盖成 deepseek 官方 —— api_key_env 必须跟着换成 DEEPSEEK_API_KEY,不能停在
    # 硬编码的 LITELLM_PROXY_KEY(那是给另一个 api_base 用的 key,牛头不对马嘴)。
    providers_yaml = tmp_path / "providers.yaml"
    providers_yaml.write_text(
        """
model_tiers:
  lite:
    model: openai/doubao-1-5-lite-32k
    api_base: https://ark.cn-beijing.volces.com/api/v3
    api_key_env: ARK_API_KEY
""",
        encoding="utf-8",
    )
    flow_config = {
        "default_model": "openai/deepseek-chat",
        "default_api_base": "https://api.deepseek.com/v1",
        "default_api_key_env": "DEEPSEEK_API_KEY",
    }
    tiering = ModelTiering(str(providers_yaml.parent / "flow.yaml"), flow_config)
    resolved = tiering.resolve({"tier": "lite"})

    assert resolved["model"] == "openai/deepseek-chat"
    assert resolved["api_base"] == "https://api.deepseek.com/v1"
    # 核心断言:api_key 必须从 DEEPSEEK_API_KEY 取,不能是 LITELLM_PROXY_KEY。
    # resolve() 直接读环境变量,这里改用 tier_names 反证:_tiers 内部存的
    # api_key_env 字段本身必须已经同步。
    assert tiering._tiers["lite"]["api_key_env"] == "DEEPSEEK_API_KEY"


def test_no_provider_override_falls_back_to_litellm_proxy_key(tmp_path):
    # 没有 flow_config 携带 default_api_key_env 时(向后兼容旧调用点),
    # 保持原有退回行为,不因这次修复破坏未覆盖场景。
    providers_yaml = tmp_path / "providers.yaml"
    providers_yaml.write_text(
        """
model_tiers:
  lite:
    model: openai/doubao-1-5-lite-32k
    api_base: https://ark.cn-beijing.volces.com/api/v3
    api_key_env: ARK_API_KEY
""",
        encoding="utf-8",
    )
    flow_config = {
        "default_model": "openai/deepseek-chat",
        "default_api_base": "https://api.deepseek.com/v1",
    }
    tiering = ModelTiering(str(providers_yaml.parent / "flow.yaml"), flow_config)
    assert tiering._tiers["lite"]["api_key_env"] == "LITELLM_PROXY_KEY"


def test_flow_default_model_matches_tier_no_override():
    # flow 顶层模型本就在 tier 集合里(没有 provider 覆盖发生)→ tier 原样保留。
    import tempfile, pathlib

    with tempfile.TemporaryDirectory() as d:
        providers_yaml = pathlib.Path(d) / "providers.yaml"
        providers_yaml.write_text(
            """
model_tiers:
  lite:
    model: openai/doubao-1-5-lite-32k
    api_base: https://ark.cn-beijing.volces.com/api/v3
    api_key_env: ARK_API_KEY
""",
            encoding="utf-8",
        )
        flow_config = {
            "default_model": "openai/doubao-1-5-lite-32k",
            "default_api_base": "https://ark.cn-beijing.volces.com/api/v3",
            "default_api_key_env": "ARK_API_KEY",
        }
        tiering = ModelTiering(str(providers_yaml.parent / "flow.yaml"), flow_config)
        assert tiering._tiers["lite"]["api_key_env"] == "ARK_API_KEY"
