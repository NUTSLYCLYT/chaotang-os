"""ModelTiering: 差异化模型策略 — Harness L5。

从 flow_engine.py 提取，独立模块化，便于单元测试和维护。

职责:
  - 从 providers.yaml 加载 model_tiers 配置
  - 将 step 的 tier 字段解析为具体的 model/api_base/api_key
  - 当 active provider 覆盖 default_model 时，同步覆盖所有 tier 配置

YAML 配置示例（providers.yaml）:
  model_tiers:
    director:
      model: deepseek-reasoner
      api_base: http://127.0.0.1:4000/v1
      api_key_env: LITELLM_PROXY_KEY
    worker:
      model: deepseek-chat
      api_base: http://127.0.0.1:4000/v1
      api_key_env: LITELLM_PROXY_KEY
    fast:
      model: deepseek-chat
      api_base: http://127.0.0.1:4000/v1
      api_key_env: LITELLM_PROXY_KEY

flow YAML step 中使用:
  steps:
    - id: my_step
      tier: director    # 使用 director tier 的模型，无需硬编码 model 名
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)


class ModelTiering:
    """差异化模型策略管理器。

    用法:
        tiering = ModelTiering(config_path, flow_config)
        resolved = tiering.resolve(step_config)
        # resolved 可能包含 model / api_base / api_key
    """

    def __init__(self, config_path: str, flow_config: dict) -> None:
        self._config_path = config_path
        self._flow_config = flow_config
        self._tiers: dict = self._load()

    def _load(self) -> dict:
        """从 providers.yaml 加载 model_tiers，并处理 provider 覆盖场景。"""
        providers_path = Path(self._config_path).resolve().parent / "providers.yaml"
        if not providers_path.exists():
            return {}
        try:
            data = yaml.safe_load(providers_path.read_text(encoding="utf-8")) or {}
            tiers: dict = data.get("model_tiers", {})
            if not tiers:
                return {}

            flow_default_model = self._flow_config.get("default_model", "")
            flow_default_api_base = self._flow_config.get("default_api_base", "")

            # 若 active provider 覆盖了 default_model，统一将所有 tier 映射到当前模型
            # 避免 tier 硬编码的 DeepSeek 配置在本地 provider（如 ollama）下失败
            #
            # 2026-07-06 真实事故修复:api_key_env 曾硬编码成 LITELLM_PROXY_KEY,
            # 与同时被覆盖的 api_base(可能是 deepseek 官方地址)来源不一致 ——
            # 拿着 litellm 代理的 key 去敲 deepseek 官方的门,鉴权必败,导致
            # flow_pack_rd 跑到用该 tier 的步骤(bms_summary)时全链级联中断,
            # 一份完整 PACK 方案被腰斩。api_key_env 必须跟 api_base 同源:
            # apply_provider_to_flow_config 已经把 default_api_key_env 设成
            # 跟 default_api_base 配套的正确值,直接用它;没有才退回代理 key。
            if flow_default_model and tiers:
                tier_models = {t.get("model") for t in tiers.values() if t.get("model")}
                if flow_default_model not in tier_models:
                    flow_default_api_key_env = (
                        self._flow_config.get("default_api_key_env")
                        or "LITELLM_PROXY_KEY"
                    )
                    tiers = {
                        name: {
                            **tier,
                            "model": flow_default_model,
                            "api_base": flow_default_api_base
                            or tier.get("api_base", ""),
                            "api_key_env": flow_default_api_key_env,
                        }
                        for name, tier in tiers.items()
                    }
            return tiers
        except Exception as e:  # noqa: BLE001
            logger.warning("加载 model_tiers 失败: %s", e)
            return {}

    def resolve(self, step_config: dict) -> dict:
        """将 step 的 tier 字段解析为具体的 model/api_base/api_key。

        step 自带的 model 字段优先于 tier（step 显式指定模型时 tier 不生效）。
        返回空 dict 表示不覆盖（使用 flow 的 default_model）。
        """
        if step_config.get("model"):
            return {}

        tier_name = step_config.get("tier")
        if not tier_name or tier_name not in self._tiers:
            return {}

        tier = self._tiers[tier_name]
        result: dict = {}
        if tier.get("model"):
            result["model"] = tier["model"]
        if tier.get("api_base"):
            result["api_base"] = tier["api_base"]
        if tier.get("api_key_env"):
            result["api_key"] = os.environ.get(tier["api_key_env"], "")
        return result

    @property
    def tier_names(self) -> list[str]:
        return list(self._tiers.keys())

    def __repr__(self) -> str:
        return f"ModelTiering(tiers={self.tier_names})"
