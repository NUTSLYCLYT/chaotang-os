"""FlowEngine: 顺序执行 Flow，管理累积上下文，支持重跑。

Harness Engineering 增强（6层架构）：
- L1 信息边界:    ContextBudget 上下文利用率监控 (40%/60%/75% 阈值)
- L3 执行编排:    StepAssertions 步间断言（语义/依赖约束）
- L4 记忆与状态:  RunState 结构化状态 + artifacts 提取
- L5 评估与观测:  Model Tiering 差异化模型策略 + 步级 metrics
- L6 约束/验证/恢复: OutputLinter 输出结构校验 + 自愈循环
                      GuardRails 预/后执行拦截器（注入检测/压缩/拒绝）
"""

from __future__ import annotations

import json
import logging
import os
import re
import subprocess
import time
from datetime import datetime
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)

from src.agent import Agent
from src.context_budget import ContextBudget
from src.guard_rails import _STEP_HEADER_RE, GuardRails, _semantic_extract_step
from src.model_adapter import BudgetExceeded, LLMCallBudget, ModelAdapter
from src.model_tiering import ModelTiering
from src.output_linter import OutputLinter
from src.prompts import PROMPT_MAP
from src.prompts_qa_v2 import build_qa_prompt
from src.prompts_versioned import get_prompt_version
from src.run_state import RunState
from src.schema import validate_output, validate_quality_score
from src.step_assertions import StepAssertions
from src.tenant import get_current_tenant, with_tenant
from src.step_log import (
    RunLog,
    StepLog,
    load_run,
    save_final_output,
    save_run_meta,
    save_step,
)

# 加载 .env（如果存在）
_env_path = Path(__file__).resolve().parent.parent / ".env"
if _env_path.exists():
    for line in _env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())

# 代理策略（2026-06-10 修正·井出水连通性钥匙）：
# 旧逻辑无脑清空所有代理（假设外网直连）。但本机网络已翻转——外网(api.deepseek.com)现在
# 必须走代理 7880 才出得去（实测：带代理 200/3s，绕代理 25s 超时）。无脑清代理 = 蜂群连不上
# DeepSeek → 塌成空/超时（干井的连通性半因）。改为 env-aware：
#   保留外网代理（让蜂群出得了宫门），只把本地回环（LiteLLM 网关/后端 8081）加进 NO_PROXY 直连，
#   不被代理劫持成 502/"No connected db."。FLOW_FORCE_DIRECT=1 可恢复旧的全清行为（无代理环境用）。
_LOCAL_NOPROXY = "127.0.0.1,localhost,::1"
_existing_noproxy = os.environ.get("NO_PROXY") or os.environ.get("no_proxy") or ""
_merged_noproxy = ",".join(p for p in (_LOCAL_NOPROXY, _existing_noproxy) if p)
os.environ["NO_PROXY"] = _merged_noproxy
os.environ["no_proxy"] = _merged_noproxy
if os.environ.get("FLOW_FORCE_DIRECT") == "1":
    for _pvar in (
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "http_proxy",
        "https_proxy",
        "ALL_PROXY",
        "all_proxy",
    ):
        os.environ.pop(_pvar, None)


# V2-01 井出水：lint 自愈"择优"的非空保底下限(字符,stripped)。低于此视作"基本空"。
# 业务分析步骤产出低于此长度等于没产出,不该被当成"最优"喂下游。
MIN_SUBSTANTIVE_LEN = 16


def lint_candidate_better(
    cur_out: str, cur_errors: int, best_out: str, best_errors: int
) -> bool:
    """lint 自愈循环：当前结果是否比迄今最优更好。

    干井根治(H1-B)：**有料输出永远优于空输出**——空输出常 trivially 过多数规则、错误更少,
    旧逻辑会把它选成"最优"→回奏塌成空。这里先按"是否实质性(非空)"分层,杜绝空输出靠错误少上位;
    同实质性层级内,再比错误数、长度(原逻辑)。
    """
    cur_sub = len((cur_out or "").strip()) >= MIN_SUBSTANTIVE_LEN
    best_sub = len((best_out or "").strip()) >= MIN_SUBSTANTIVE_LEN
    if cur_sub != best_sub:
        return cur_sub  # 有料胜过空,无视错误数
    # 同层(都实质 或 都基本空):错误更少胜;错误相同则更长胜(原逻辑)
    if cur_errors < best_errors:
        return True
    if cur_errors == best_errors and len(cur_out or "") > len(best_out or ""):
        return True
    return False


class FlowEngine:
    """加载 Flow 配置，创建 Agent，顺序执行并记录日志。

    支持多模型切换：每个 step 可以单独指定 model、api_base、api_key。
    支持Prompt版本管理：记录每个step使用的prompt版本。
    支持质量评分：QA步骤输出6维度评分。
    """

    def __init__(
        self,
        config_path: str,
        qa_version: str | None = None,
        provider: str | None = None,
        execution_modes: dict[str, str] | None = None,
    ):
        with open(config_path, encoding="utf-8") as f:
            config = yaml.safe_load(f)

        # 注入 provider 配置：
        # - provider 显式传入时使用该 provider
        # - provider=None 时自动取 providers.yaml 的 active 字段
        # - 当 active provider 配置无效（如 api_base 为空）时回退到 flow yaml 原值，
        #   保证向后兼容
        self._merge_system_to_user = False
        try:
            from src.provider import apply_provider_to_flow_config, get_provider_env

            env_preview = get_provider_env(provider)
            if env_preview.get("api_base") and env_preview.get("model"):
                config = apply_provider_to_flow_config(config, provider)
                self._merge_system_to_user = env_preview.get(
                    "merge_system_to_user", False
                )
            elif provider:
                # 用户显式指定了 provider 却拿不到配置，告警但不中断
                logger.warning("provider=%s 配置不完整，使用 flow yaml 原值", provider)
        except Exception as _prov_exc:  # noqa: BLE001
            logger.warning("provider 注入失败，使用 flow yaml 原值: %s", _prov_exc)

        self.config_path: str = config_path
        self._execution_modes: dict[str, str] = execution_modes or {}
        self.qa_version: str = qa_version or config.get("qa_version", "v2")
        self._init_from_config(config)

    @classmethod
    def from_dict(
        cls,
        config_dict: dict,
        qa_version: str | None = None,
        execution_modes: dict | None = None,
    ) -> "FlowEngine":
        """从 config dict 构建 FlowEngine（不读文件，用于单步测试）。"""
        obj = cls.__new__(cls)
        obj._merge_system_to_user = False
        obj.config_path = "<in-memory>"
        obj._execution_modes = execution_modes or {}
        obj.qa_version = qa_version or config_dict.get("qa_version", "v2")
        obj._init_from_config(config_dict)
        return obj

    def _load_model_tiers(self) -> dict:
        """Backward-compatible hook for older tests and integrations.

        Model tier loading now lives in ModelTiering; this read-only adapter
        keeps callers that patched or inspected the former method working.
        """
        tiering = getattr(self, "_model_tiering", None)
        if tiering is None:
            return {}
        return getattr(tiering, "_tiers", {}) or {}

    def _init_from_config(self, config: dict) -> None:
        """从已解析的 config dict 初始化引擎内部状态。"""
        self.config = config
        self.flow_name: str = self.config["flow_name"]

        # 读取默认模型配置
        self.default_model: str = self.config.get(
            "default_model", self.config.get("model", "anthropic/MiniMax-M2.7")
        )
        self.default_api_base: str | None = self.config.get(
            "default_api_base", self.config.get("api_base")
        )
        default_api_key_env = self.config.get(
            "default_api_key_env", self.config.get("api_key_env")
        )
        self.default_api_key: str | None = (
            os.environ.get(default_api_key_env, "") if default_api_key_env else None
        )

        self.step_configs: list[dict] = self.config["steps"]
        # 展开 preset：把 step.preset 引用的 tools / knowledge 合并进来
        try:
            from src.preset_loader import apply_preset

            self.step_configs = [apply_preset(sc) for sc in self.step_configs]
        except Exception as _ps_exc:  # noqa: BLE001
            logger.warning("preset 展开失败（不影响主流程）: %s", _ps_exc)
        self.output_fields: list[str] = self.config.get("output_fields", [])

        self.default_temperature: float | None = self.config.get("default_temperature")
        self.default_max_tokens: int | None = self.config.get("default_max_tokens")
        self.max_context_chars: int = self.config.get("max_context_chars", 0)

        # 创建默认 ModelAdapter（用于没有单独配置模型的 step）
        self.default_adapter = ModelAdapter(
            model=self.default_model,
            api_base=self.default_api_base,
            api_key=self.default_api_key,
            merge_system_to_user=self._merge_system_to_user,
            temperature=self.default_temperature,
            max_tokens=self.default_max_tokens,
        )

        # ── Harness L5: 差异化模型策略（ModelTiering 模块） ──
        self._model_tiering = ModelTiering(self.config_path, self.config)

        # 初始化 ToolRouter（如果有任何工具配置：global/flow/step 级）
        self._tool_router = None
        has_tools = any(sc.get("tools") for sc in self.step_configs) or self.config.get(
            "flow_tools"
        )
        if has_tools:
            # in-memory 模式下 config_path 是 "<in-memory>"，mcp_servers.yaml 可能不存在
            mcp_config = str(
                Path(self.config_path).resolve().parent / "mcp_servers.yaml"
            )
            if Path(mcp_config).exists():
                from src.tool_router import ToolRouter

                self._tool_router = ToolRouter(mcp_config)
            else:
                logger.warning(
                    "ToolRouter 初始化跳过：mcp_servers.yaml 不存在（config_path=%s）",
                    self.config_path,
                )

        # 创建 Agent 列表，每个 Agent 可以有独立的模型配置
        from src.prompt_composer import compose_prompt

        self.agents: list[Agent] = []
        for sc in self.step_configs:
            # 集成节点（openclaw）+ 动态并行节点（spawn，prompt 来自 dispatcher 输出）
            # 不需要静态 prompt，用占位符跳过构造
            if sc.get("step_type") in (
                "openclaw",
                "spawn",
                "openclaw_dispatch",
                "cost_validation",
                "sizing",
            ):
                system_prompt = ""
            # prompt_inline 优先：直接使用内联 prompt，跳过文件/模块查找
            elif sc.get("prompt_inline", "").strip():
                system_prompt = sc["prompt_inline"]
            else:
                prompt_key = sc.get("prompt_key")
                # QA步骤根据配置选择版本（QA prompt 是动态生成的，不走文件）。
                # 但领域专属 QA（如 opc_qa）通过 prompt_module 显式声明时，必须走模块解析；
                # 否则会退回通用 QA，丢失领域硬核查。
                if prompt_key == "qa_tech_support":
                    step_ids = [s["id"] for s in self.step_configs]
                    step_names = [s["name"] for s in self.step_configs]
                    system_prompt = build_qa_prompt(
                        output_fields=self.output_fields,
                        step_ids=step_ids,
                        step_names=step_names,
                        qa_version=self.qa_version,
                    )
                elif prompt_key:
                    # 优先从 runtime_prompts/ 组装（4文件模式）
                    # no_tools: true → 跳过 TOOLS.md，防止模型输出工具调用 XML
                    system_prompt = compose_prompt(
                        prompt_key, skip_tools=sc.get("no_tools", False)
                    )
                    if system_prompt is None:
                        # fallback: 代码中注册的 prompt
                        if prompt_key in PROMPT_MAP:
                            system_prompt = PROMPT_MAP[prompt_key]
                        else:
                            system_prompt = _load_prompt_from_module(
                                sc.get("prompt_module"), prompt_key
                            )
                else:
                    raise ValueError(
                        f"Step '{sc['id']}' has no prompt source: set prompt_inline, prompt_key, or prompt_module"
                    )

            # 读取 step 级别的模型配置（可选）
            # Harness L5: tier 字段可引用 providers.yaml 中的 model_tiers
            tier_overrides = self._model_tiering.resolve(sc)
            step_model = sc.get("model") or tier_overrides.get("model")
            step_api_base = sc.get("api_base") or tier_overrides.get("api_base")
            step_api_key = None
            if sc.get("api_key_env"):
                step_api_key = os.environ.get(sc["api_key_env"], "")
            elif tier_overrides.get("api_key"):
                step_api_key = tier_overrides["api_key"]
            step_temperature = sc.get("temperature")
            step_max_tokens = sc.get("max_tokens")

            # 解析工具配置（三级合并：global + flow + step）
            step_tools = None  # 传入 Agent API 的正式工具定义
            global_tools_text = None  # 仅注入 prompt 文字说明，不走 API tool_calls
            # 只有步骤自身显式配置了 tools 才走正式 API tool_calls；
            # flow_tools / global_tools 仅作文字说明注入 prompt，避免 DeepSeek 等
            # 模型把分析内容塞进工具参数而非直接输出。
            has_explicit_tools = bool(sc.get("tools"))
            if has_explicit_tools and self._tool_router:
                # 步骤显式配置了工具 → 正式 API tool_calls 模式
                step_tools = self._tool_router.get_tools_for_step(
                    sc, flow_config=self.config
                )
            elif (
                self._tool_router
                and self._tool_router.get_global_tools()
                and not sc.get("no_tools")
            ):
                # 全局工具：只把说明文字追加到 prompt，不走 API tool_calls
                # 避免 DeepSeek 等模型把分析内容塞进工具参数而非直接输出
                # 步骤设置 no_tools: true 可跳过工具注入（适用于汇总类步骤）
                global_tools_text = self._tool_router.get_tools_for_step(
                    sc, flow_config=self.config
                )

            # 有工具时自动生成 TOOLS.md 内容追加到 prompt
            tools_for_md = step_tools or global_tools_text
            if tools_for_md:
                from src.prompt_composer import generate_tools_md

                tools_md = generate_tools_md(tools_for_md)
                if tools_md:
                    system_prompt = system_prompt + "\n\n" + tools_md

            # 全局约束注入：防止 R1 等强推理模型擅自修改客户明确规格
            _GLOBAL_CONSTRAINT = (
                "\n\n## 执行铁律（高优先级）\n"
                "1. 客户原始需求中的明确技术规格（型号/容量/工艺/材料/交期等）**不得修改或替换**，"
                "如有疑虑须在输出中标注原始要求并说明差异。\n"
                "2. 无法确认的信息必须显式标注为【推测】或【待确认】，不得当成事实陈述。\n"
                "3. 不同步骤间的数字/假设必须引用来源，不得自行创造新数据。"
            )
            if system_prompt and sc.get("id") not in (
                "qa_tech_support",
                "qa_check",
                "qa_tester",
                "qa_reviewer",
            ):
                system_prompt = system_prompt + _GLOBAL_CONSTRAINT

            # 读取 step 级别的 fallback_models 配置（可选）
            step_fallback_models = sc.get("fallback_models") or None

            agent = Agent(
                step_id=sc["id"],
                name=sc["name"],
                system_prompt=system_prompt,
                adapter=self.default_adapter,
                model=step_model,
                api_base=step_api_base,
                api_key=step_api_key,
                tools=step_tools or None,  # 只有显式配置时才传
                tool_router=self._tool_router if step_tools else None,
                temperature=step_temperature,
                max_tokens=step_max_tokens,
                fallback_models=step_fallback_models,
            )
            self.agents.append(agent)

        # ── Harness: 初始化所有 Harness 组件 ──
        self._linter = OutputLinter()
        self._budget = ContextBudget()
        self._assertions = StepAssertions()
        self._guard = GuardRails()

        # Reflexion: 失败记忆（延迟初始化，首次需要时才创建 ChromaDB 连接）
        self._failure_memory = None

        # 加载知识注入（静态 YAML 数据）
        self._knowledge_text = self._load_knowledge_inject()
        # 电芯真值库动态注入：指向 cell_library.json 时，run() 按本次任务需求筛合格子集
        _ki = self.config.get("knowledge_inject") or {}
        self._knowledge_dynamic_cells = str(_ki.get("file", "")).endswith(
            "cell_library.json"
        ) and _ki.get("dynamic", True)

        # 预检索配置（RAG 文档检索）
        self._pre_retrieval_cfg = self.config.get("knowledge_pre_retrieval", {})
        # IMA 知识库预检索配置
        self._ima_pre_retrieval_cfg = self.config.get("ima_pre_retrieval", {})

        # ── Step 级生命周期钩子 ──
        self._hooks: dict = {
            "before_step": [],  # fn(step_config, context) -> None
            "after_step": [],  # fn(step_config, result, elapsed_ms) -> None
            "on_step_error": [],  # fn(step_config, error) -> None
        }

    def register_hook(self, event: str, fn) -> None:
        """注册 Step 级生命周期钩子。

        Args:
            event: 钩子事件名，支持 before_step | after_step | on_step_error
            fn:    回调函数。签名：
                   - before_step(step_config: dict, context: dict) -> None
                   - after_step(step_config: dict, result: dict, elapsed_ms: float) -> None
                   - on_step_error(step_config: dict, error: Exception) -> None

        Raises:
            ValueError: 未知的 event 名称
        """
        if event not in self._hooks:
            raise ValueError(
                f"Unknown hook event: {event!r}. Valid events: {list(self._hooks.keys())}"
            )
        self._hooks[event].append(fn)

    def _fire_hook(self, event: str, *args) -> None:
        """触发指定事件的所有钩子，单个钩子抛异常不影响主流程。"""
        for fn in self._hooks.get(event, []):
            try:
                fn(*args)
            except Exception as hook_exc:  # noqa: BLE001
                logger.warning(
                    "生命周期钩子 [%s] 执行异常（已忽略）: %s", event, hook_exc
                )

    def _load_knowledge_inject(self) -> str | None:
        """读取 knowledge_inject 配置，返回渲染后的知识文本（含时效性检查）。

        配置示例（flow_opc.yaml）：
            knowledge_inject:
              file: "knowledge/battery_prices.yaml"
              max_tokens: 2000
        """
        ki_cfg = self.config.get("knowledge_inject")
        if not ki_cfg:
            return None

        file_path = ki_cfg.get("file", "")
        if not file_path:
            return None

        # 解析路径（相对于项目根目录）
        project_root = Path(__file__).resolve().parent.parent
        knowledge_path = Path(file_path)
        if not knowledge_path.is_absolute():
            knowledge_path = project_root / knowledge_path

        if not knowledge_path.exists():
            logger.warning("知识文件不存在: %s", knowledge_path)
            return None

        data = yaml.safe_load(knowledge_path.read_text(encoding="utf-8"))
        if not data:
            return None
        # 兼容 cell_library.json（JSON 数组 = 电芯真值库单一来源）：包成 {"cells": [...]}
        if isinstance(data, list):
            data = {"cells": data}

        # 时效性检查
        freshness_warning = ""
        meta = data.get("meta", {})
        updated_at = meta.get("updated_at", "")
        if updated_at:
            try:
                from datetime import date

                last_update = date.fromisoformat(str(updated_at))
                days_ago = (date.today() - last_update).days
                if days_ago > 30:
                    freshness_warning = (
                        f"\n⚠️ 以下数据最后更新于 {days_ago} 天前（{updated_at}），"
                        "报价和参数仅供参考，请建议客户与产品部确认最新价格。\n"
                    )
                    logger.warning(
                        "知识文件 %s 已 %d 天未更新", knowledge_path.name, days_ago
                    )
            except (ValueError, TypeError):
                pass

        # 渲染为文本
        rendered = self._render_knowledge_data(data)

        # Token 硬限制（粗估：1 中文字 ≈ 1.5 token）
        max_tokens = ki_cfg.get("max_tokens", 2000)
        max_chars = int(max_tokens / 1.5)
        if len(rendered) > max_chars:
            rendered = (
                rendered[:max_chars] + "\n\n... (数据已截断，完整数据请查阅产品参数库)"
            )
            logger.warning(
                "知识注入超过 %d token 限制，已截断（原始 %d 字符 → %d 字符）",
                max_tokens,
                len(rendered),
                max_chars,
            )

        return freshness_warning + rendered

    @staticmethod
    def _render_knowledge_data(data: dict) -> str:
        """将知识 YAML 数据渲染为 Agent 可读的文本格式。"""
        if not data:
            return ""

        parts = []

        # 电芯真值库（cell_library.json：公司实测一手数据，选型唯一真值源）
        cells = data.get("cells", [])
        if cells:
            parts.append(
                "### 可用电芯库（公司实测真值·选型只能从此表选，不得使用表外或臆造型号）"
            )
            # 最冷优先：低温芯是差异化卖点，排前面避免 token 截断时被切掉
            cells = sorted(
                cells,
                key=lambda c: (
                    c.get("discharge_temp_min_c") is None,
                    c.get("discharge_temp_min_c", 0),
                ),
            )
            for c in cells:
                parts.append(
                    f"- **{c.get('model', '?')}**: 容量{c.get('capacity_mah', '?')}mAh, "
                    f"电压{c.get('voltage_v', '?')}V, 循环{c.get('cycle_life', '?')}, "
                    f"能量密度{c.get('energy_density_whkg', '?')}Wh/kg, "
                    f"放电温度{c.get('discharge_temp', '?')}"
                )

        # 产品参数
        products = data.get("products", [])
        if products:
            parts.append("### 产品参数与价格（公司内部数据）")
            for p in products:
                line = (
                    f"- **{p.get('model', '?')}** ({p.get('category', '')}): "
                    f"容量{p.get('capacity', '?')}, "
                    f"温度范围{p.get('temp_range', '?')}, "
                    f"循环寿命{p.get('cycle_life', '?')}, "
                    f"能��密度{p.get('energy_density', '?')}, "
                    f"价格{p.get('price_range', '?')}, "
                    f"交期{p.get('lead_time', '?')}"
                )
                if p.get("note"):
                    line += f" — {p['note']}"
                parts.append(line)

        # PACK方案
        packs = data.get("pack_solutions", [])
        if packs:
            parts.append("\n### PACK 方案与报价")
            for pk in packs:
                line = (
                    f"- **{pk.get('name', '?')}**: "
                    f"{pk.get('config', '?')}, "
                    f"容量{pk.get('capacity', '?')}, "
                    f"BMS: {pk.get('bms', '?')}, "
                    f"价格{pk.get('price_range', '?')}"
                )
                if pk.get("note"):
                    line += f" �� {pk['note']}"
                parts.append(line)

        # 竞品参考
        competitors = data.get("competitor_reference", [])
        if competitors:
            parts.append("\n### 竞品参考（公开信息）")
            for c in competitors:
                parts.append(
                    f"- **{c.get('brand', '?')}**: "
                    f"{c.get('low_temp_product', '?')}, "
                    f"温度{c.get('temp_range', '?')}, "
                    f"价格水平: {c.get('price_level', '?')}, "
                    f"优势: {c.get('advantage', '?')}"
                )

        if not parts:
            parts.append("### 注入知识数据（只读）")
            parts.append(
                yaml.safe_dump(
                    data,
                    allow_unicode=True,
                    sort_keys=True,
                )
            )

        return "\n".join(parts)

    def _do_pre_retrieval(self, task_input: str, scope: list | None = None) -> str:
        """执行 RAG 预检索，返回格式化文本。

        Args:
            task_input: 检索查询（通常为任务描述）
            scope: 知识域列表；非空时只检索指定知识域（knowledge_domain metadata）；
                   None 表示全量检索（向后兼容）
        """
        # 冻结快照优先：run(context_override=...) 提供 rag_docs 时短路实时检索，
        # 使 eval 的 input 可复现（同一 task 永远等于同一份检索结果）。覆盖本方法的全部调用点。
        _frozen = getattr(self, "_frozen_context", None) or {}
        if "rag_docs" in _frozen:
            return _frozen["rag_docs"]
        top_k = self._pre_retrieval_cfg.get("top_k", 3)
        max_tokens = self._pre_retrieval_cfg.get("max_tokens", 1500)
        # 从 flow 配置读取知识库 ID，支持环境变量引用（如 ${RAGFLOW_DS_INDUSTRY}）
        raw_ids = self._pre_retrieval_cfg.get("dataset_ids", "")
        dataset_ids: list[str] | None = None
        if raw_ids:
            expanded = os.path.expandvars(str(raw_ids))
            dataset_ids = [i.strip() for i in expanded.split(",") if i.strip()]
        try:
            from src.knowledge_rag import pre_retrieve

            text = pre_retrieve(
                task_input,
                top_k=top_k,
                max_tokens=max_tokens,
                dataset_ids=dataset_ids,
                scope=scope,
            )
            if text:
                logger.info(
                    "RAG 预检索命中 %d 字符 scope=%s",
                    len(text),
                    scope or "全量",
                )
            return text
        except Exception as e:
            logger.warning("RAG 预检索失败: %s", e)
            return ""

    def _do_ima_pre_retrieval(self, task_input: str) -> str:
        """执行 IMA 知识库预检索，返回格式化文本注入 context。"""
        # 冻结快照优先：与 _do_pre_retrieval 同理，eval 复现时短路实时 IMA 检索。
        _frozen = getattr(self, "_frozen_context", None) or {}
        if "ima_docs" in _frozen:
            return _frozen["ima_docs"]
        cfg = self._ima_pre_retrieval_cfg
        kb_id = cfg.get("knowledge_base_id", "")
        top_k = cfg.get("top_k", 5)
        queries_tpl = cfg.get("queries", ["{task_input}"])
        if not kb_id:
            return ""
        try:
            import sys
            from pathlib import Path as _Path

            sys.path.insert(0, str(_Path(__file__).resolve().parent.parent))
            from mcp_servers.ima_server import IMAServer

            server = IMAServer()
            seen, results = set(), []
            for tpl in queries_tpl:
                q = tpl.replace("{task_input}", task_input)
                data = server.search_knowledge(q, kb_id, limit=top_k)
                for item in data.get("results", []):
                    title = item.get("title", "")
                    if title and title not in seen:
                        seen.add(title)
                        results.append(item)
            if not results:
                return ""
            lines = ["## IMA 知识库相关资料\n"]
            for i, item in enumerate(results[: top_k * 2], 1):
                lines.append(f"{i}. **{item['title']}**")
                hl = item.get("highlight", "")
                if hl:
                    lines.append(f"   {hl[:150]}")
            text = "\n".join(lines)
            logger.info("IMA 预检索命中 %d 条，%d 字符", len(results), len(text))
            return text
        except Exception as e:
            logger.warning("IMA 预检索失败: %s", e)
            return ""

    def _load_repair_config(self):
        """从 Flow 配置文件中读取 repair 配置段。"""
        from src.repair import RepairConfig

        repair_cfg = self.config.get("repair", {})
        if not repair_cfg:
            return None
        return RepairConfig(
            enabled=repair_cfg.get("enabled", False),
            max_retries=repair_cfg.get("max_retries", 3),
            min_score=repair_cfg.get("min_score", 3.5),
            min_delta=repair_cfg.get("min_delta", 0.2),
            min_dimension_score=repair_cfg.get("min_dimension_score", 3.0),
            regression_tolerance=repair_cfg.get("regression_tolerance", -0.1),
        )

    def run_with_repair(
        self,
        task_input: str,
        repair_config=None,
        on_step_done=None,
        on_round_done=None,
    ) -> tuple[RunLog, object | None]:
        """执行完整 Flow，QA 不达标时自动修复循环。

        也处理 output_pattern_repair：步骤输出匹配 pattern 时，从指定步骤重跑。

        Returns:
            (最终 RunLog, RepairHistory | None)
        """
        from src.repair import needs_repair, repair_cycle

        # ── output_pattern_repair：步骤级输出模式触发重跑（如门下封驳→退回中书）──
        _opr_configs = {
            sc.get("id"): sc.get("output_pattern_repair", {})
            for sc in self.step_configs
            if sc.get("output_pattern_repair")
        }
        _opr_counts: dict[str, int] = {}

        run_log = self.run(task_input, on_step_done=on_step_done)

        if _opr_configs:
            for _opr_attempt in range(
                max(v.get("max_restarts", 2) for v in _opr_configs.values())
            ):
                _triggered_step = None
                for step_log in run_log.steps:
                    opr = _opr_configs.get(step_log.step_id, {})
                    if not opr:
                        continue
                    pattern = opr.get("pattern", "")
                    restart_from_id = opr.get("restart_from_id")
                    max_r = opr.get("max_restarts", 2)
                    if (
                        pattern
                        and restart_from_id
                        and step_log.status == "success"
                        and re.search(pattern, step_log.output or "")
                        and _opr_counts.get(step_log.step_id, 0) < max_r
                    ):
                        _triggered_step = step_log
                        _restart_id = restart_from_id
                        _opr_counts[step_log.step_id] = (
                            _opr_counts.get(step_log.step_id, 0) + 1
                        )
                        break
                if not _triggered_step:
                    break
                restart_idx = next(
                    (
                        i
                        for i, sc in enumerate(self.step_configs)
                        if sc.get("id") == _restart_id
                    ),
                    None,
                )
                if restart_idx is None:
                    logger.warning(
                        "output_pattern_repair: restart_from_id '%s' 未找到",
                        _restart_id,
                    )
                    break
                logger.info(
                    "output_pattern_repair: %s 匹配 '%s'，从 %s(step %d) 重跑（第 %d 次）",
                    _triggered_step.step_id,
                    opr.get("pattern"),
                    _restart_id,
                    restart_idx,
                    _opr_counts[_triggered_step.step_id],
                )
                feedback = f"\n\n【门下省修订意见】\n{_triggered_step.output}"
                run_log = self.rerun_from(
                    run_id=run_log.run_id,
                    from_step=restart_idx,
                    step_id=_restart_id,
                    context_overlay=feedback,
                    on_step_done=on_step_done,
                )

        config = repair_config or self._load_repair_config()
        if not config or not config.enabled:
            return run_log, None

        if not needs_repair(run_log, config):
            return run_log, None

        history = repair_cycle(
            engine=self,
            run_log=run_log,
            config=config,
            on_round_done=on_round_done,
        )

        final_run = load_run(history.final_run_id) if history.final_run_id else run_log

        # Reflexion：修复循环结束后尝试写入失败记忆
        repair_count = len(history.rounds)
        self._maybe_record_failure(final_run, repair_count)

        return final_run, history

    def _get_failure_memory(self):
        """延迟初始化并返回 FailureMemory 实例。ChromaDB 不可用时返回 None。"""
        if self._failure_memory is None:
            try:
                from src.failure_memory import FailureMemory

                self._failure_memory = FailureMemory()
            except Exception as e:
                logger.warning("FailureMemory 初始化失败，Reflexion 功能不可用: %s", e)
                self._failure_memory = False  # False 表示"已尝试但失败"，避免反复重试
        return self._failure_memory if self._failure_memory else None

    def _maybe_record_failure(self, run_log, repair_count: int) -> None:
        """尝试将此次 run 的失败模式写入 FailureMemory。

        调用时机：run_with_repair() 修复循环结束后。
        异常全部吞掉：反思写入失败不应影响主流程。
        """
        try:
            fm = self._get_failure_memory()
            if fm is None:
                return

            from src.failure_memory import (
                _extract_score,
                SCORE_THRESHOLD,
                MIN_REPAIR_COUNT,
            )

            # 快速预检：不满足基本条件直接跳过，避免触发 ChromaDB 查询
            score = _extract_score(run_log.quality_score)
            if (
                score <= 0
                or score >= SCORE_THRESHOLD
                or repair_count < MIN_REPAIR_COUNT
            ):
                return
            if run_log.run_status not in ("normal", "completed", ""):
                return

            # 生成自然语言失败分析（skip_budget=True：元任务，不计入当前预算）
            qa_scores_str = (
                str(run_log.quality_score) if run_log.quality_score else "未知"
            )
            analysis_prompt = (
                f"你是一个专业的质量分析师。以下是一次{self.flow_name}任务的失败记录：\n\n"
                f"任务输入（前300字）：{run_log.task_input[:300]}\n"
                f"QA评分：{qa_scores_str}\n"
                f"修复次数：{repair_count}\n\n"
                "请用2-3句话分析：这次失败的根本原因是什么？下次执行同类任务时应该注意什么？\n"
                "格式：[失败原因] + [改进建议]，不超过150字，不要列表，直接写段落。"
            )
            result = self.default_adapter.call(
                system_prompt="你是质量分析专家，擅长归纳任务失败模式，输出简洁精准。",
                user_prompt=analysis_prompt,
                max_tokens=200,
                skip_budget=True,
            )
            if result.get("status") != "success" or not result.get("output"):
                logger.warning(
                    "_maybe_record_failure: 失败分析 LLM 调用未成功，跳过记录"
                )
                return
            failure_analysis = result["output"].strip()

            # 先尝试冷启动路径（首条记录），再走常规三段漏斗
            recorded = fm.record_first_failure(run_log, failure_analysis, repair_count)
            if not recorded:
                if fm.should_record(run_log, repair_count):
                    fm.record(run_log, failure_analysis, repair_count)
        except Exception as e:
            logger.warning("_maybe_record_failure 失败（不影响主流程）: %s", e)

    # ─── 共用执行逻辑 ─────────────────────────────────

    def _execute_step(
        self,
        agent: Agent,
        i: int,
        run_id: str,
        context: dict,
        task_input: str,
        rendered_override: str | None = None,
        on_token=None,
        on_step_save=None,
        on_guard_event=None,
        on_step_start=None,
    ) -> tuple[StepLog, float]:
        """执行单个 step，返回 (StepLog, elapsed_seconds)。

        run() 和 rerun_from() 共用此方法，消除代码重复。

        Harness 增强：
        - L1/L5: ContextBudget 追踪 token 利用率和成本
        - L6: OutputLinter 校验输出 + 自愈循环
        """
        rendered = rendered_override or _render_context(context)
        step_config = self.step_configs[i]

        prompt_key = step_config.get("prompt_key") or step_config.get("id", "")
        prompt_version = get_prompt_version(prompt_key)

        # ── Harness L1/L5: 上下文预算预检查 ──
        actual_model = agent.model or self.default_model
        budget_report = self._budget.pre_check(
            agent.system_prompt,
            rendered,
            actual_model,
        )

        # ── WorkingMemory: 预算感知步骤压缩（warning/danger zone 触发）──
        # 在 GuardRails 之前压缩，让 GuardRails 看到已压缩的上下文
        if budget_report.zone in ("warning", "danger") and context.get("steps"):
            try:
                from src.working_memory import WorkingMemory

                _wm = WorkingMemory()
                _compressed_ctx = _wm.compress_if_needed(context, budget_report.zone)
                if _compressed_ctx is not context:
                    _ctx_steps_filter = step_config.get("context_steps")
                    if _ctx_steps_filter:
                        _filtered = dict(_compressed_ctx)
                        _filtered["steps"] = [
                            s
                            for s in _compressed_ctx["steps"]
                            if s["step"] in set(_ctx_steps_filter)
                        ]
                        rendered = _render_context(_filtered, self.max_context_chars)
                    else:
                        rendered = _render_context(
                            _compressed_ctx, self.max_context_chars
                        )
                    logger.info(
                        "WorkingMemory [%s]: zone=%s，已对步骤输出进行重要度压缩",
                        agent.step_id,
                        budget_report.zone,
                    )
            except ImportError:
                pass

        # ── Harness L6: GuardRails 预执行检查 ──
        guard_pre = self._guard.pre_check(
            agent.step_id,
            step_config,
            rendered,
            agent.system_prompt,
        )
        if not guard_pre.passed:
            # hard block：返回错误 StepLog
            step_metadata = {"guard_block": guard_pre.issues}
            step_log = StepLog(
                run_id=run_id,
                step_index=i,
                step_id=agent.step_id,
                agent_name=agent.name,
                timestamp=datetime.now().astimezone().isoformat(),
                input=(
                    task_input
                    if i == 0
                    else (
                        context["steps"][-1]["output"]
                        if context["steps"]
                        else task_input
                    )
                ),
                rendered_context=rendered,
                system_prompt=agent.system_prompt,
                model=actual_model,
                output=f"[GUARD_BLOCK] {'; '.join(guard_pre.issues)}",
                status="error",
                metadata=step_metadata,
            )
            if on_step_save:
                on_step_save(i, "start")
            save_step(step_log)
            if on_step_save:
                on_step_save(i, "done")
            return step_log, 0.0
        if guard_pre.action == "compress" and guard_pre.compressed_context:
            rendered = guard_pre.compressed_context
            logger.info("GuardRails [%s]: 已应用上下文压缩", agent.step_id)
            if on_guard_event:
                on_guard_event(
                    i,
                    "compress",
                    guard_pre.issues[0] if guard_pre.issues else "上下文超限压缩",
                )

        # ── Hermes 记忆检索（memory_search: true 时注入相关历史） ──
        if step_config.get("memory_search"):
            try:
                from src.memory_store import MemoryStore

                _mem_store = MemoryStore()
                _mem_query = context.get("task_input", "")
                _mem_person = step_config.get("person_id")
                _mem_hits = _mem_store.search_similar(
                    query=_mem_query,
                    person_id=_mem_person,
                    limit=3,
                )
                if _mem_hits:
                    context["memory_context"] = _format_memory_hits(_mem_hits)
                    # 重新渲染以包含记忆上下文
                    rendered = _render_context(
                        context,
                        (
                            self.max_context_chars
                            if hasattr(self, "max_context_chars")
                            else 0
                        ),
                    )
                    logger.info(
                        "Step %s: 注入 %d 条历史记忆", agent.step_id, len(_mem_hits)
                    )
            except Exception as _mem_exc:
                logger.warning("记忆检索失败（不影响主流程）: %s", _mem_exc)

        # ── 销售成交飞轮（sales_memory: true 时注入真实成交价锚点，干净燃料·零LLM） ──
        if step_config.get("sales_memory"):
            try:
                from src.sales_memory import recall_real_deals

                _deals_text, _deals_hit = recall_real_deals(
                    context.get("task_input", "")
                )
                # flywheel_health: 命中真实成交 prior 数（看得见转吗）记进 context,可被 trace/控制图读取
                context["sales_memory_hits"] = _deals_hit
                if _deals_text:
                    context["real_deals"] = _deals_text
                    rendered = _render_context(
                        context,
                        (
                            self.max_context_chars
                            if hasattr(self, "max_context_chars")
                            else 0
                        ),
                    )
                    logger.info(
                        "Step %s: 注入 %d 笔真实成交价锚点（飞轮命中）",
                        agent.step_id,
                        _deals_hit,
                    )
                else:
                    logger.info(
                        "Step %s: 销售飞轮本次空转（无匹配真实成交）", agent.step_id
                    )
            except Exception as _sm_exc:
                logger.warning("销售成交召回失败（不影响主流程）: %s", _sm_exc)

        # ── Few-Shot 案例注入（few_shot_from_cases: true 时从 case_archive 检索） ──
        if step_config.get("few_shot_from_cases"):
            try:
                from src.knowledge_rag import get_rag

                _rag = get_rag()
                _few_shot_query = context.get("task_input", task_input)
                _few_shot_hits = _rag.search(
                    query=_few_shot_query,
                    top_k=step_config.get("few_shot_top_k", 2),
                    scope=["case_archive"],
                )
                if _few_shot_hits:
                    context["few_shot_cases"] = _format_few_shot_cases(_few_shot_hits)
                    rendered = _render_context(
                        context,
                        (
                            self.max_context_chars
                            if hasattr(self, "max_context_chars")
                            else 0
                        ),
                    )
                    logger.info(
                        "Step %s: 注入 %d 条 few-shot 案例",
                        agent.step_id,
                        len(_few_shot_hits),
                    )
            except Exception as _fs_exc:
                logger.warning("Few-shot 案例检索失败（不影响主流程）: %s", _fs_exc)

        # ── 生命周期钩子: before_step ──
        self._fire_hook("before_step", step_config, context)

        # 通知前端步骤即将开始 LLM 调用（消除 TTFT 沉默期）
        if on_step_start:
            on_step_start(i, agent.name, actual_model)

        # Merge flow-level default_retry with step-level retry (step takes precedence)
        flow_retry = self.config.get("default_retry", {})
        step_retry = step_config.get("retry", {})
        retry_cfg = {**flow_retry, **step_retry}
        max_retries = retry_cfg.get("max_retries", 0)
        retry_delay = retry_cfg.get("delay", 2.0)
        retry_backoff = retry_cfg.get("backoff", 2.0)
        retry_on = retry_cfg.get("retry_on", ["error"])

        current_delay = retry_delay
        retry_count = 0
        last_result = None
        elapsed = 0.0
        _step_error: Exception | None = None
        # ── OpenClaw 集成节点（step_type: openclaw）直接路由，不走模型 ──
        if step_config.get("step_type") == "openclaw":
            t0 = time.monotonic()
            last_result = self._execute_openclaw_step(
                step_config, rendered, on_token=on_token
            )
            elapsed = time.monotonic() - t0
        # ── 成本确定性闸（step_type: cost_validation）no-LLM，算术不许 LLM 自评 ──
        elif step_config.get("step_type") == "cost_validation":
            t0 = time.monotonic()
            last_result = self._execute_cost_validation_step(
                step_config, rendered, task_input
            )
            elapsed = time.monotonic() - t0
        # ── PACK sizing 确定性闸（step_type: sizing）no-LLM，串并非 LLM 自评 ──
        elif step_config.get("step_type") == "sizing":
            t0 = time.monotonic()
            last_result = self._execute_sizing_step(step_config, rendered, task_input)
            elapsed = time.monotonic() - t0
        elif step_config.get("reasoning_strategy") == "react":
            # ── ReAct 推理模式：Thought/Action/Observation 循环，Observe 直读 StepLog ──
            try:
                from src.reasoning import ReActEngine

                t0 = time.monotonic()
                _react_max = step_config.get("max_react_steps", 5)
                _react_engine = ReActEngine()
                _react_trace = _react_engine.run(
                    agent=agent,
                    rendered_context=rendered,
                    run_id=run_id,
                    context_steps=context.get("steps", []),
                    max_steps=_react_max,
                    model=agent.model,
                    api_base=agent.api_base,
                    api_key=agent.api_key,
                    failure_memory=self._get_failure_memory(),
                    task_input=task_input,
                    flow_name=self.flow_name,
                )
                elapsed = time.monotonic() - t0
                _fa = _react_trace.final_answer
                last_result = {
                    "model": agent.model or self.default_model,
                    "prompt": agent.system_prompt,
                    "output": _fa or "",
                    "status": "success" if _fa else "error",
                    "raw_response": {
                        "react_stop_reason": _react_trace.stop_reason,
                        "react_turns": len(_react_trace.turns),
                    },
                    "react_trace": _react_trace.to_dict(),
                }
                logger.info(
                    "ReAct [%s] 完成：%d 轮, stop_reason=%s, 输出 %s",
                    agent.step_id,
                    len(_react_trace.turns),
                    _react_trace.stop_reason,
                    f"{len(_fa)} 字" if _fa else "None（触发 linter）",
                )
            except BudgetExceeded as _budget_exc:
                logger.warning(
                    "ReAct [%s] 触发 LLM 调用预算上限: %s", agent.step_id, _budget_exc
                )
                _ts = datetime.now().astimezone().isoformat()
                _step_input = task_input if i == 0 else context["steps"][-1]["output"]
                step_log = StepLog(
                    run_id=run_id,
                    step_index=i,
                    step_id=agent.step_id,
                    agent_name=agent.name,
                    timestamp=_ts,
                    input=_step_input,
                    rendered_context=rendered,
                    system_prompt=agent.system_prompt,
                    model=actual_model,
                    output=f"[BUDGET_EXCEEDED] {_budget_exc}",
                    status="budget_exceeded",
                    metadata={"budget_exceeded": True, "react_mode": True},
                )
                save_step(step_log)
                return step_log, 0.0
            except ImportError:
                # 降级到普通 agent.run()
                logger.warning("reasoning.py 未找到，降级到普通执行模式")
                t0 = time.monotonic()
                last_result = agent.run(rendered, on_token=on_token)
                elapsed = time.monotonic() - t0
        else:
            try:
                for attempt in range(max_retries + 1):
                    t0 = time.monotonic()
                    _exec_mode = self._execution_modes.get(agent.step_id, "B")
                    if _exec_mode == "A":
                        result = self._execute_subprocess_step(
                            agent, step_config, rendered, on_token, step_index=i
                        )
                    else:
                        result = agent.run(rendered, on_token=on_token)
                    elapsed = time.monotonic() - t0
                    last_result = result
                    if result["status"] not in retry_on or attempt >= max_retries:
                        break
                    retry_count += 1
                    logger.warning(
                        "Step %s 第%d次失败(status=%s)，%.1fs后重试...",
                        agent.step_id,
                        attempt + 1,
                        result["status"],
                        current_delay,
                    )
                    time.sleep(current_delay)
                    current_delay *= retry_backoff
            except BudgetExceeded as _budget_exc:
                # 调用预算耗尽：转为 budget_exceeded step_log，让外层终止 run
                logger.warning(
                    "Step %s 触发 LLM 调用预算上限: %s", agent.step_id, _budget_exc
                )
                _ts = datetime.now().astimezone().isoformat()
                _step_input = task_input if i == 0 else context["steps"][-1]["output"]
                step_log = StepLog(
                    run_id=run_id,
                    step_index=i,
                    step_id=agent.step_id,
                    agent_name=agent.name,
                    timestamp=_ts,
                    input=_step_input,
                    rendered_context=rendered,
                    system_prompt=agent.system_prompt,
                    model=actual_model,
                    output=f"[BUDGET_EXCEEDED] {_budget_exc}",
                    status="budget_exceeded",
                    metadata={"budget_exceeded": True},
                )
                save_step(step_log)
                return step_log, 0.0
            except Exception as _exc:
                _step_error = _exc
                # ── 生命周期钩子: on_step_error ──
                self._fire_hook("on_step_error", step_config, _exc)
                raise
        result = last_result

        # ── 生命周期钩子: after_step ──
        self._fire_hook("after_step", step_config, result, elapsed * 1000)

        # ── Harness L6: OutputLinter 校验 + 自愈循环 ──
        output_rules = step_config.get("output_rules", [])
        lint_max_retries = step_config.get("lint_max_retries", 2)
        lint_retries = 0
        lint_passed = True

        if output_rules and result["status"] == "success":
            lint_result = self._linter.lint(result["output"], output_rules, rendered)
            lint_passed = lint_result.passed

            # 保留迄今最优结果（错误最少且输出最长），防止修复重试反而破坏输出
            best_result = result
            best_lint_errors = len(lint_result.errors)

            while not lint_result.passed and lint_retries < lint_max_retries:
                lint_retries += 1
                fix_prompt = self._linter.build_fix_prompt(
                    result["output"], lint_result
                )
                logger.warning(
                    "Step %s lint 失败 (%d errors)，第%d次自愈重试...",
                    agent.step_id,
                    len(lint_result.errors),
                    lint_retries,
                )
                # 将修复提示追加到上下文，让 Agent 重新生成
                fix_rendered = rendered + "\n\n---\n\n" + fix_prompt
                t0 = time.time()
                result = agent.run(fix_rendered, on_token=on_token)
                elapsed += time.time() - t0

                if result["status"] != "success":
                    break
                lint_result = self._linter.lint(
                    result["output"], output_rules, rendered
                )
                lint_passed = lint_result.passed

                # 更新最优：非空保底(有料永远优于空) → 同层再比错误数/长度。
                # 干井根治(V2-01/H1-B)：杜绝空输出靠"trivially 错误少"被选成最优 → 回奏塌空。
                cur_errors = len(lint_result.errors)
                if lint_candidate_better(
                    result.get("output", ""),
                    cur_errors,
                    best_result.get("output", ""),
                    best_lint_errors,
                ):
                    best_result = result
                    best_lint_errors = cur_errors

            if not lint_passed:
                logger.warning(
                    "Step %s lint 最终未通过 (重试 %d 次后仍有 %d 个错误)，使用最优输出",
                    agent.step_id,
                    lint_retries,
                    best_lint_errors,
                )
                # 回退到最优输出，而非最后一次可能更差的修复尝试
                result = best_result

        # ── Harness L6: GuardRails 后执行检查 ──
        guard_post = self._guard.post_check(
            agent.step_id, result["output"], step_config
        )
        if not guard_post.passed:
            # 后置检查失败（空输出、ERROR）：覆盖状态
            result["status"] = "error"
        guard_warnings = guard_post.issues if guard_post.action == "warn" else []

        # ── Harness L3: StepAssertions 断言检查 ──
        assertions_cfg = step_config.get("assertions", {})
        post_assertions = assertions_cfg.get("post", []) if assertions_cfg else []
        propagation_cfg = (
            assertions_cfg.get("propagation", []) if assertions_cfg else []
        )
        assertion_report = self._assertions.check_post(
            agent.step_id, result["output"], post_assertions, context
        )
        prop_report = self._assertions.check_propagation(
            agent.step_id, result["output"], propagation_cfg
        )
        if assertion_report.hard_failures:
            errs = [r.message for r in assertion_report.hard_failures]
            logger.warning("Step %s 断言失败 (hard_fail): %s", agent.step_id, errs)
        if prop_report.warnings:
            for w in prop_report.warnings:
                logger.info("Step %s 传播警告: %s", agent.step_id, w.message)

        # ── Harness L5: 记录实际 token 用量和成本 ──
        budget_report = self._budget.post_record(
            budget_report,
            result.get("raw_response", {}),
            actual_model,
        )

        # 提取工具调用日志（如果有）
        step_metadata = {}
        if result.get("tool_calls_log"):
            step_metadata["tool_calls_log"] = result["tool_calls_log"]
        if retry_count > 0:
            step_metadata["retry_count"] = retry_count
        if result.get("react_trace"):
            step_metadata["react_trace"] = result["react_trace"]

        # 方向A→B fallback 通知：将 fallback 原因写入 metadata，供前端展示
        _fallback_reason = step_config.get("_fallback_reason")
        if _fallback_reason:
            step_metadata["mode_fallback"] = True
            step_metadata["fallback_reason"] = _fallback_reason

        # Harness metrics 注入 metadata
        step_metadata["context_metrics"] = budget_report.to_dict()
        step_metadata["lint"] = {
            "rules_count": len(output_rules),
            "passed": lint_passed,
            "retries": lint_retries,
        }
        step_metadata["assertions"] = {
            "post_count": len(post_assertions),
            "all_passed": assertion_report.all_passed,
            "hard_failures": [r.message for r in assertion_report.hard_failures],
            "warnings": guard_warnings + [w.message for w in prop_report.warnings],
        }

        step_log = StepLog(
            run_id=run_id,
            step_index=i,
            step_id=agent.step_id,
            agent_name=agent.name,
            timestamp=datetime.now().astimezone().isoformat(),
            input=(
                task_input
                if i == 0
                else (
                    context["steps"][-1]["output"] if context["steps"] else task_input
                )
            ),
            rendered_context=rendered,
            system_prompt=result.get("prompt", ""),
            model=result.get("model", step_config.get("step_type", "integration")),
            output=result["output"],
            status=result["status"],
            raw_response=result.get("raw_response", {}),
            prompt_version=prompt_version,
            input_tokens=budget_report.actual_prompt_tokens,
            output_tokens=budget_report.actual_completion_tokens,
            duration_seconds=round(elapsed, 1),
            metadata=step_metadata,
        )

        # ── 质量门控：min_quality_score ──────────────────────────────
        min_quality_score = step_config.get("min_quality_score")
        if min_quality_score is not None:
            qs = step_log.quality_score
            # quality_score 为 None/空时视为 0 分（确保门控触发）
            if qs is None or qs == {} or qs == 0:
                _actual_score = 0.0
            elif isinstance(qs, dict):
                _actual_score = float(
                    qs.get("total_score", qs.get("score", qs.get("overall_score", 0.0)))
                    or 0.0
                )
            else:
                _actual_score = float(qs)
            if _actual_score < float(min_quality_score):
                logger.warning(
                    "Step %s 质量门控阻断（得分 %.1f < %.1f），标记为 blocked",
                    agent.step_id,
                    _actual_score,
                    float(min_quality_score),
                )
                step_log.status = "blocked"
                step_log.metadata = {
                    **(step_log.metadata or {}),
                    "quality_gate_blocked": True,
                    "quality_gate_threshold": float(min_quality_score),
                    "quality_gate_actual": _actual_score,
                }

        if on_step_save:
            on_step_save(i, "start")
        save_step(step_log)
        if on_step_save:
            on_step_save(i, "done")
        return step_log, elapsed

    def _curate_run_to_chroma(self, run_log: RunLog) -> None:
        """QA 高分(>=auto_curate_threshold, 默认 4.0)时把每个 step 的输出
        批量写入 chroma:auto_curated, 供后续 Flow 的 KnowledgeRouter 挂载复用。

        批量化: 一次拼好所有 (text, metadata) 后调 KnowledgeRAG.add_texts,
        避免逐 step 触发 N 次同步 embedding HTTP + chroma upsert(原先 5-step
        flow 在 finalize 阶段会阻塞 2-5s)。
        """
        qs = run_log.quality_score
        score = (
            float(qs.get("overall_score", qs.get("score", 0.0)))
            if isinstance(qs, dict)
            else float(qs or 0)
        )
        threshold = float(self.config.get("auto_curate_threshold", 4.0))
        if score < threshold:
            return

        items: list[tuple[str, str, dict]] = []
        for s in run_log.steps:
            if not s.output or s.status != "success" or len(s.output) < 200:
                continue
            text = f"# {s.agent_name}\n\n## 任务\n{run_log.task_input[:500]}\n\n## 输出\n{s.output}"
            source = f"auto_curated:{run_log.run_id}:{s.step_id}"
            meta = {
                "knowledge_domain": "auto_curated",
                "flow_name": self.flow_name,
                "step_id": s.step_id,
                "agent_name": s.agent_name,
                "quality_score": score,
                "run_id": run_log.run_id,
                # 自动策展的真实运行内容含租户业务(客户诉求/方案),必须打 tenant_id,
                # 否则 tenant_doc_visible(None) 当共享 → 全租户可读(会审 HIGH)。
                "tenant_id": get_current_tenant(),
            }
            items.append((text, source, meta))

        if not items:
            return

        from src.knowledge_rag import get_rag

        added = get_rag().add_texts(items)
        logger.info(
            "知识回流: run %s 高分(%.2f), 已批量写入 %d 个 step 到 chroma:auto_curated",
            run_log.run_id,
            score,
            added,
        )

    def _finalize_run(
        self,
        run_log: RunLog,
        prompt_versions: dict,
        run_type: str = "normal",
        source_run_id: str | None = None,
        from_step: int | None = None,
        from_step_id: str | None = None,
    ) -> RunLog:
        """解析 QA 输出、保存 final_output 和 run_meta。

        run() 和 rerun_from() 共用此方法。
        from_step_id: DAG rerun 时目标节点的 step_id（写入元数据，供前端展示）。
        """
        # 优先从 qa_tech_support 步骤解析 QA（有些 flow 最后一步不是 QA）
        _qa_step = next(
            (
                s
                for s in reversed(run_log.steps)
                if s.step_id in ("qa_tech_support", "qa_check")
            ),
            run_log.steps[-1],
        )
        final_output, qa_result = _parse_qa_output(
            _qa_step.output,
            self.output_fields,
            qa_domain=self.config.get("qa_domain", "product"),
        )
        final_output, _business_step_fallback_report = (
            _build_business_step_final_output_with_report(
                run_log.steps,
                self.output_fields,
                final_output,
            )
        )
        final_output, _safety_floor_report = _apply_opc_safety_floor_with_report(
            self.flow_name,
            self.config_path,
            run_log.task_input,
            final_output,
        )
        final_output, _ai_ops_fallback_report = _build_ai_ops_final_output_with_report(
            self.flow_name,
            self.config_path,
            run_log.task_input,
            final_output,
        )
        final_output, _haolong_fallback_report = (
            _build_haolong_final_output_with_report(
                self.flow_name,
                self.config_path,
                run_log.task_input,
                final_output,
            )
        )
        final_output, _ima_fallback_report = _build_ima_final_output_with_report(
            self.flow_name,
            self.config_path,
            run_log.task_input,
            final_output,
        )
        final_output, _release_fallback_report = (
            _build_release_final_output_with_report(
                self.flow_name,
                self.config_path,
                run_log.task_input,
                final_output,
            )
        )
        final_output, _product_redline_report = (
            _apply_product_redline_final_output_with_report(
                self.flow_name,
                self.config_path,
                run_log.task_input,
                final_output,
            )
        )
        final_output, _shiguan_archive_report = (
            _apply_shiguan_archive_final_output_with_report(
                self.flow_name,
                self.config_path,
                run_log.task_input,
                final_output,
            )
        )
        final_output, _pack_rd_cost_gate_report = _apply_pack_rd_cost_gate_with_report(
            self.flow_name,
            self.config_path,
            run_log.steps,
            final_output,
        )
        if _safety_floor_report["applicable"]:
            run_log.metadata = {
                **(run_log.metadata or {}),
                "opc_safety_floor": _safety_floor_report,
            }
        if _ai_ops_fallback_report["applicable"]:
            run_log.metadata = {
                **(run_log.metadata or {}),
                "ai_ops_final_output_fallback": _ai_ops_fallback_report,
            }
        if _haolong_fallback_report["applicable"]:
            run_log.metadata = {
                **(run_log.metadata or {}),
                "haolong_final_output_fallback": _haolong_fallback_report,
            }
        if _ima_fallback_report["applicable"]:
            run_log.metadata = {
                **(run_log.metadata or {}),
                "ima_final_output_fallback": _ima_fallback_report,
            }
        if _release_fallback_report["applicable"]:
            run_log.metadata = {
                **(run_log.metadata or {}),
                "release_final_output_fallback": _release_fallback_report,
            }
        if _product_redline_report["applicable"]:
            run_log.metadata = {
                **(run_log.metadata or {}),
                "product_redline_final_output": _product_redline_report,
            }
        if _shiguan_archive_report["applicable"]:
            run_log.metadata = {
                **(run_log.metadata or {}),
                "shiguan_archive_final_output": _shiguan_archive_report,
            }
        if _business_step_fallback_report["applicable"]:
            run_log.metadata = {
                **(run_log.metadata or {}),
                "business_step_final_output_fallback": _business_step_fallback_report,
            }
        if _pack_rd_cost_gate_report["applicable"]:
            run_log.metadata = {
                **(run_log.metadata or {}),
                "pack_rd_cost_gate": _pack_rd_cost_gate_report,
            }
        run_log.final_output = final_output
        run_log.qa_result = qa_result
        run_log.prompt_versions = prompt_versions
        run_log.config_path = self.config_path

        if qa_result and qa_result.get("quality_score"):
            run_log.quality_score = qa_result.get("quality_score")
            run_log.steps[-1].quality_score = qa_result.get("quality_score")
            save_step(run_log.steps[-1])

        # Harness L5: 将预算汇总写入 qa_result
        if qa_result is not None:
            _harness = self._budget.get_run_summary()
            _llm_budget = getattr(self, "_llm_budget", None)
            if _llm_budget is not None:
                _harness["llm_calls_used"] = _llm_budget.used
                _harness["llm_calls_max"] = _llm_budget.max_calls
            qa_result["harness_metrics"] = _harness

        if final_output:
            save_final_output(run_log.run_id, final_output, qa_result)

        save_run_meta(
            run_log,
            run_type=run_type,
            source_run_id=source_run_id,
            from_step=from_step,
            from_step_id=from_step_id,
            config_path=self.config_path,
        )

        # 第3层知识库：高质量结果自动归档（blocked run 不归档，避免污染知识库）。
        # OPC safety floor 触发时，最终结果含护栏补丁，不代表模型自身已学会；
        # 保存给人看，但不进入自动归档/知识回流，避免污染 few-shot 记忆。
        if (
            final_output
            and run_log.quality_score
            and run_log.run_status != "blocked"
            and not _is_opc_safety_floor_triggered(run_log)
        ):
            try:
                from src.case_archive import auto_archive

                auto_archive(
                    run_id=run_log.run_id,
                    task_input=run_log.task_input,
                    final_output=final_output,
                    quality_score=run_log.quality_score,
                    flow_name=self.flow_name,
                    config_path=self.config_path,
                    # 洞C 最后一公里:flow 配置声明 dept/si 即给归档打标,司档案自动积累(无需内容分类器)
                    dept=self.config.get("dept", ""),
                    si=self.config.get("si", ""),
                )
            except Exception as e:
                logger.warning("自动归档失败（不影响运行结果）: %s", e)

            try:
                self._curate_run_to_chroma(run_log)
            except Exception as e:  # noqa: BLE001
                logger.warning("知识回流失败（不影响运行结果）: %s", e)

        # Hermes 记忆层：将本次 run 写入 SQLite 记忆存储
        try:
            from src.memory_store import MemoryStore

            _quality_val = 0.0
            _qs = run_log.quality_score
            if isinstance(_qs, dict):
                _quality_val = float(
                    _qs.get("overall_score", _qs.get("score", 0.0)) or 0.0
                )
            elif isinstance(_qs, (int, float)):
                _quality_val = float(_qs)

            _final_str = (
                json.dumps(run_log.final_output, ensure_ascii=False)
                if run_log.final_output
                else ""
            )
            MemoryStore().save_run(
                run_id=run_log.run_id,
                flow_name=self.flow_name,
                task_input=run_log.task_input,
                final_output=_final_str,
                quality_score=_quality_val,
            )
            logger.info(
                "已将 run %s 写入记忆存储（quality=%.2f）", run_log.run_id, _quality_val
            )

            # 高分触发：quality_score >= 4.0 时提取人格信号（需要 person_id）
            # person_id 从 flow config 的第一个 step 的 person_id 字段读取（可选）
            _person_id = None
            for sc in self.step_configs:
                if sc.get("person_id"):
                    _person_id = sc["person_id"]
                    break
            if _quality_val >= 4.0 and _person_id:
                _extract_and_update_profile(
                    person_id=_person_id,
                    flow_name=self.flow_name,
                    quality_score=_quality_val,
                    task_input=run_log.task_input,
                )
        except Exception as e:
            logger.warning("记忆存储写入失败（不影响运行结果）: %s", e)

        return run_log

    # ─── OpenClaw 集成执行 ─────────────────────────

    def _execute_openclaw_step(
        self,
        step_config: dict,
        rendered_context: str,
        messages: list | None = None,
        on_token=None,
    ) -> dict:
        """调用 OpenClaw Gateway（OpenAI-compatible /v1/chat/completions）。

        优先级：step_config 中的字段 > 环境变量 > 默认值。
        messages: 多轮对话历史，传入时直接使用；为 None 时从 rendered_context 构建单轮。
        on_token: 有回调时使用 stream=True，逐 token 推送给前端；无则非流式一次性返回。
        """
        import httpx
        import json as _json

        base_url = (
            step_config.get("openclaw_base_url")
            or os.environ.get("OPENCLAW_BASE_URL", "http://127.0.0.1:18789")
        ).rstrip("/")
        token = step_config.get("openclaw_token") or os.environ.get(
            "OPENCLAW_TOKEN", ""
        )
        agent_id = step_config.get("openclaw_agent_id") or os.environ.get(
            "OPENCLAW_DEFAULT_AGENT", "main"
        )
        timeout = step_config.get("openclaw_timeout", 120)

        url = f"{base_url}/v1/chat/completions"
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        # 首轮调用（messages is None）且配置了 done_signal 时，自动注入完成指令
        # 让模型无需用户手动在 prompt 里加说明就能触发停止机制
        _done_signal = step_config.get("openclaw_done_signal", "")
        if messages is None:
            _user_content = rendered_context
            if _done_signal:
                _user_content += f"\n\n[系统提示] 完成所有任务后，请在回复的最后一行单独输出：{_done_signal}"
            _initial_messages = [{"role": "user", "content": _user_content}]
        else:
            _initial_messages = messages

        use_stream = on_token is not None
        payload = {
            "model": f"openclaw/{agent_id}",
            "messages": _initial_messages,
            "stream": use_stream,
        }

        try:
            if use_stream:
                # 流式模式：逐 token 推送，累积完整输出
                full_output = ""
                with httpx.Client(timeout=timeout) as client:
                    with client.stream(
                        "POST", url, json=payload, headers=headers
                    ) as resp:
                        resp.raise_for_status()
                        for line in resp.iter_lines():
                            if not line or not line.startswith("data: "):
                                continue
                            data_str = line[6:]
                            if data_str.strip() == "[DONE]":
                                break
                            try:
                                chunk = _json.loads(data_str)
                                piece = (
                                    chunk.get("choices", [{}])[0]
                                    .get("delta", {})
                                    .get("content", "")
                                )
                                if piece:
                                    full_output += piece
                                    on_token(piece)
                            except (_json.JSONDecodeError, KeyError, IndexError):
                                pass
                return {"status": "success", "output": full_output}
            else:
                # 非流式模式：一次性返回
                with httpx.Client(timeout=timeout) as client:
                    resp = client.post(url, json=payload, headers=headers)
                    resp.raise_for_status()
                    data = resp.json()
                    output = (
                        (
                            data.get("choices", [{}])[0]
                            .get("message", {})
                            .get("content", "")
                        )
                        or data.get("content", "")
                        or str(data)
                    )
                    return {"status": "success", "output": output}
        except httpx.TimeoutException:
            msg = f"[OpenClaw] 请求超时（>{timeout}s），跳过此步骤"
            logger.warning(msg)
            return {"status": "error", "output": msg}
        except httpx.HTTPStatusError as exc:
            # 流式响应在 raise_for_status 时抛错，response.text 需要先 .read()
            try:
                exc.response.read()
                body_preview = exc.response.text[:200]
            except Exception:
                body_preview = "<unreadable response body>"
            msg = f"[OpenClaw] HTTP {exc.response.status_code}：{body_preview}"
            logger.warning(msg)
            return {"status": "error", "output": msg}
        except Exception as exc:
            msg = f"[OpenClaw] 调用失败：{exc}"
            logger.warning(msg)
            return {"status": "error", "output": msg}

    def _execute_cost_validation_step(
        self,
        step_config: dict,
        rendered_context: str,
        task_input: str,
    ) -> dict:
        """no-LLM 成本确定性闸：抽精算 fenced JSON → validate_bom → verdict。

        算术不许 LLM 自评（会审铁律）。verdict 既进 step_log.output（供 expert_review_gate
        维度④/QA C1 读），又塞进 raw_response.cost_gate_verdict（供 _finalize_run 写 run_meta
        + 追加 final_output["系统BOM汇总"]）。
        """
        try:
            from src.pack_rd_cost_validator import run_cost_gate
        except ImportError as exc:  # noqa: BLE001
            msg = f"[成本确定性闸] 校验器不可用：{exc}"
            logger.warning(msg)
            return {"status": "error", "output": msg, "model": "cost_validation"}

        # 精算输出已由 context_steps 白名单注入 rendered_context；直接从中抽 fenced JSON。
        try:
            verdict, text = run_cost_gate(rendered_context, task_input)
        except Exception as exc:  # noqa: BLE001
            msg = f"[成本确定性闸] 校验异常：{exc}"
            logger.warning(msg)
            return {"status": "error", "output": msg, "model": "cost_validation"}

        logger.info(
            "成本确定性闸: green=%s extracted=%s c1=%s priceTruth=%s specTruth=%s",
            verdict.get("green"),
            verdict.get("extracted"),
            verdict.get("c1"),
            verdict.get("priceTruth"),
            verdict.get("specTruth"),
        )
        return {
            "status": "success",
            "output": text.strip() or "[成本确定性闸] 无可渲染 verdict",
            "model": "cost_validation",
            "raw_response": {"cost_gate_verdict": verdict},
        }

    def _execute_sizing_step(
        self,
        step_config: dict,
        rendered_context: str,
        task_input: str,
    ) -> dict:
        """no-LLM PACK sizing 确定性闸：抽精算 fenced JSON → 确定性 sizing + 反作弊核对。

        给确定性基线（串并/电流/热/冷却），并把精算 agent 自报的 series_S/parallel_P
        与确定性结果核对（偏差超带宽 FAIL），同 cost_validation 范式：算术不许 LLM 自评。
        verdict 进 step_log.output（供成本闸/expert_review_gate 读），又塞
        raw_response.sizing_gate_verdict（供 _finalize_run）。
        """
        try:
            from src.pack_rd_sizing import run_sizing_gate
        except ImportError as exc:  # noqa: BLE001
            msg = f"[sizing 确定性闸] 求解器不可用：{exc}"
            logger.warning(msg)
            return {"status": "error", "output": msg, "model": "sizing"}

        try:
            verdict, text = run_sizing_gate(rendered_context, task_input)
        except Exception as exc:  # noqa: BLE001
            msg = f"[sizing 确定性闸] 校验异常：{exc}"
            logger.warning(msg)
            return {"status": "error", "output": msg, "model": "sizing"}

        logger.info(
            "sizing 确定性闸: green=%s extracted=%s seriesTruth=%s parallelTruth=%s",
            verdict.get("green"),
            verdict.get("extracted"),
            verdict.get("seriesTruth"),
            verdict.get("parallelTruth"),
        )
        return {
            "status": "success",
            "output": text.strip() or "[sizing 确定性闸] 无可渲染 verdict",
            "model": "sizing",
            "raw_response": {"sizing_gate_verdict": verdict},
        }

    # ─── 方向A：subprocess 执行 ─────────────────────────

    def _execute_subprocess_step(
        self,
        agent,
        step_config: dict,
        rendered_context: str,
        on_token=None,
        step_index: int = 0,
    ) -> dict:
        """方向A：通过 subprocess 调用 claude -p 执行 gstack skill。

        从 step_config 读取 skill_name 字段，定位 SKILL.md 文件。
        若 skill 文件不存在或 claude CLI 不可用，自动 fallback 到方向B。
        """
        skill_name = step_config.get("skill_name")

        # 检测 claude CLI 是否可用
        _claude_available = False
        try:
            _check = subprocess.run(
                ["claude", "--version"],
                capture_output=True,
                timeout=5,
            )
            _claude_available = _check.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass

        if not _claude_available:
            logger.warning(
                "方向A: claude CLI 不可用，step %s fallback 到方向B",
                agent.step_id,
            )
            step_config["_fallback_reason"] = "claude CLI 不可用，已 fallback 到方向B"
            return agent.run(rendered_context, on_token=on_token)

        # 定位 skill_path
        skill_path: Path | None = None
        if skill_name:
            # 禁止路径分隔符防止目录穿越
            if "/" in skill_name or "\\" in skill_name:
                logger.warning(
                    "方向A: skill_name '%s' 包含路径分隔符，拒绝，step %s fallback 到方向B",
                    skill_name,
                    agent.step_id,
                )
                step_config["_fallback_reason"] = (
                    f"skill_name '{skill_name}' 包含路径分隔符，已 fallback 到方向B"
                )
                return agent.run(rendered_context, on_token=on_token)
            candidates = [
                Path.home() / ".claude" / "skills" / "gstack" / skill_name / "SKILL.md",
                Path.home() / ".claude" / "skills" / skill_name / "SKILL.md",
            ]
            for c in candidates:
                if c.exists():
                    skill_path = c
                    break

        if skill_path is None:
            logger.warning(
                "方向A: skill '%s' 文件不存在，step %s fallback 到方向B",
                skill_name,
                agent.step_id,
            )
            step_config["_fallback_reason"] = (
                f"skill '{skill_name}' 文件不存在，已 fallback 到方向B"
            )
            return agent.run(rendered_context, on_token=on_token)

        skill_content = skill_path.read_text(encoding="utf-8")

        # 将 skill_content 拼接到 rendered_context 开头，作为系统提示
        full_prompt = f"{skill_content}\n\n---\n\n{rendered_context}"

        try:
            # 通过 stdin 管道传入 prompt，规避 ARG_MAX 限制
            cmd = [
                "claude",
                "-p",
                "-",
                "--output-format",
                "stream-json",
                "--verbose",
            ]

            proc = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            # 将 prompt 写入 stdin 并关闭，让 claude CLI 开始处理
            try:
                proc.stdin.write(full_prompt)
                proc.stdin.close()
            except BrokenPipeError:
                pass

            output_parts: list[str] = []
            final_result: str | None = None
            usage: dict = {}

            try:
                import select as _select

                deadline = time.monotonic() + 120  # 120秒超时
                while True:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        proc.kill()
                        logger.warning(
                            "方向A: step %s subprocess 超时（120s）", agent.step_id
                        )
                        return {
                            "status": "error",
                            "output": "subprocess timeout (120s)",
                            "usage": {},
                        }
                    # 以最多1秒为单位等待可读
                    rlist, _, _ = _select.select(
                        [proc.stdout], [], [], min(remaining, 1.0)
                    )
                    if rlist:
                        line = proc.stdout.readline()
                        if not line:
                            break
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            evt = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        evt_type = evt.get("type", "")
                        if evt_type == "text":
                            token = evt.get("text", "")
                            output_parts.append(token)
                            if on_token and token:
                                try:
                                    on_token(step_index, token)
                                except Exception:
                                    pass
                        elif evt_type == "result":
                            final_result = evt.get("result", "")
                            usage = evt.get("usage", {})
                        elif evt_type in ("error",):
                            err_msg = evt.get("error", evt.get("message", str(evt)))
                            return {
                                "status": "error",
                                "output": err_msg,
                                "usage": {},
                            }
                    else:
                        # 检查进程是否已结束
                        if proc.poll() is not None:
                            # 读完剩余内容
                            for line in proc.stdout:
                                line = line.strip()
                                if not line:
                                    continue
                                try:
                                    evt = json.loads(line)
                                except json.JSONDecodeError:
                                    continue
                                evt_type = evt.get("type", "")
                                if evt_type == "text":
                                    token = evt.get("text", "")
                                    output_parts.append(token)
                                    if on_token and token:
                                        try:
                                            on_token(step_index, token)
                                        except Exception:
                                            pass
                                elif evt_type == "result":
                                    final_result = evt.get("result", "")
                                    usage = evt.get("usage", {})
                            break
            except Exception as _read_exc:
                proc.kill()
                raise _read_exc

            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()

            if proc.returncode != 0:
                stderr_text = proc.stderr.read() if proc.stderr else ""
                logger.warning(
                    "方向A: step %s subprocess 退出码 %d，stderr=%s",
                    agent.step_id,
                    proc.returncode,
                    stderr_text[:200],
                )
                return {
                    "status": "error",
                    "output": stderr_text
                    or f"process exited with code {proc.returncode}",
                    "usage": {},
                }

            combined_output = (
                final_result if final_result is not None else "".join(output_parts)
            )
            return {
                "status": "success",
                "output": combined_output,
                "usage": usage,
            }

        finally:
            pass

    def _execute_spawn_step(
        self,
        step_config: dict,
        idx: int,
        run_id: str,
        context: dict,
        task_input: str,
    ) -> tuple["StepLog", float]:
        """动态并行：解析上游 JSON 子任务列表，并发执行 N 个子 Agent，合并结果。

        spawn 专属 step_config 字段：
          spawn_from_field:  从上游输出 JSON 中提取的字段名（默认 "subtasks"）
          spawn_agent_id:    模板 Agent 的 step_id（默认使用本步骤自身 Agent）
          spawn_max_workers: 最大并发线程数（默认 4）
          spawn_merge:       合并策略 "numbered"（默认）或 "concat"
        """
        import concurrent.futures

        t0 = time.monotonic()

        spawn_from_field = step_config.get("spawn_from_field", "subtasks")
        spawn_agent_id = step_config.get("spawn_agent_id", "")
        spawn_max_workers = step_config.get("spawn_max_workers", 4)
        spawn_merge = step_config.get("spawn_merge", "numbered")

        # 从上一步输出提取子任务列表
        prev_steps = context.get("steps", [])
        last_output = prev_steps[-1]["output"] if prev_steps else task_input
        subtasks = _extract_spawn_subtasks(last_output, spawn_from_field)

        if not subtasks:
            # 无子任务：降级为普通步骤
            agent = self.agents[idx]
            return self._execute_step(agent, idx, run_id, context, task_input)

        # 找模板 Agent（spawn_agent_id 对应的 agent，找不到则用本步骤 agent）
        template_agent = next(
            (a for a in self.agents if a.step_id == spawn_agent_id),
            self.agents[idx],
        )

        # 并发执行子任务
        spawn_context_snapshot = dict(context)
        spawn_results: dict[int, dict] = {}

        def _run_one(i: int, subtask_text: str) -> tuple[int, dict]:
            rendered = _render_context(spawn_context_snapshot, self.max_context_chars)
            full_input = (
                f"{rendered}\n\n## 当前子任务\n{subtask_text}"
                if rendered
                else subtask_text
            )
            # Agent.run 接受单一 user_input；把 context 与子任务文本拼成一段送入
            result = template_agent.run(user_input=full_input)
            return i, (
                result
                if isinstance(result, dict)
                else {"output": str(result), "status": "success"}
            )

        max_w = min(spawn_max_workers, len(subtasks))
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_w) as executor:
            # with_tenant:池 worker 不继承 threading.local 租户,必须携带父线程租户,
            # 否则并行步的 RAG 检索/truth_ledger 落到 default,跨租户串味(会审 CRITICAL 第0步a补)。
            futures = {
                executor.submit(with_tenant(_run_one), i, st): i
                for i, st in enumerate(subtasks)
            }
            for fut in concurrent.futures.as_completed(futures):
                i, result = fut.result()
                spawn_results[i] = result

        merged_output = _merge_spawn_outputs(spawn_results, subtasks, spawn_merge)
        elapsed = time.monotonic() - t0

        step_log = StepLog(
            run_id=run_id,
            step_index=idx,
            step_id=self.agents[idx].step_id,
            agent_name=self.agents[idx].name,
            timestamp=datetime.now().astimezone().isoformat(),
            input=task_input,
            rendered_context=f"[spawn × {len(subtasks)}]",
            system_prompt="",
            model=template_agent.model or self.default_model,
            output=merged_output,
            status="success",
            source="executed",
            prompt_version="spawn_v1",
            duration_seconds=round(elapsed, 1),
            metadata={
                "spawn_count": len(subtasks),
                "spawn_agent": spawn_agent_id,
                "spawn_merge": spawn_merge,
            },
        )
        save_step(step_log)
        return step_log, elapsed

    def _execute_openclaw_dispatch_step(
        self,
        step_config: dict,
        idx: int,
        run_id: str,
        context: dict,
        task_input: str,
    ) -> tuple["StepLog", float]:
        """openclaw 子任务派发:把 dispatch 输出的 subtasks POST 到 openclaw 网关。

        step_config 专属字段:
          openclaw_base_url:  openclaw 服务根 URL(由 assemble_flow 写入)
          openclaw_timeout:   HTTP 超时秒数(默认 30.0)
          spawn_from_field:   subtasks 字段名(默认 "subtasks")
          spawn_agent_id:     上游 dispatch step 的 id
          spawn_merge:        合并策略(默认 "numbered")

        成功 → 结果合并为 numbered 文本写入 step_log.output
        失败(OpenclawError / TimeoutException) → warning + fallback spawn
        """
        import warnings

        t0 = time.monotonic()

        base_url = step_config.get("openclaw_base_url", "")
        oc_timeout = float(step_config.get("openclaw_timeout", 30.0))
        spawn_from_field = step_config.get("spawn_from_field", "subtasks")
        spawn_merge = step_config.get("spawn_merge", "numbered")

        # 从上游 dispatch 步骤输出中提取 subtasks
        prev_steps = context.get("steps", [])
        last_output = prev_steps[-1]["output"] if prev_steps else task_input
        subtasks = _extract_spawn_subtasks(last_output, spawn_from_field)

        if not subtasks:
            # 无子任务:降级普通步骤
            agent = self.agents[idx]
            return self._execute_step(agent, idx, run_id, context, task_input)

        try:
            from src import openclaw_client
            import httpx as _httpx

            results = openclaw_client.post_tasks(base_url, subtasks, timeout=oc_timeout)
            # 合并为 numbered 格式(与 spawn merge=numbered 一致)
            if spawn_merge == "numbered":
                merged_output = "\n\n".join(
                    f"### {i + 1}. {subtasks[i]}\n{r}" for i, r in enumerate(results)
                )
            else:
                merged_output = "\n\n".join(results)
            elapsed = time.monotonic() - t0
            step_log = StepLog(
                run_id=run_id,
                step_index=idx,
                step_id=self.agents[idx].step_id,
                agent_name=self.agents[idx].name,
                timestamp=datetime.now().astimezone().isoformat(),
                input=task_input,
                rendered_context=f"[openclaw_dispatch × {len(subtasks)}]",
                system_prompt="",
                model=f"openclaw@{base_url}",
                output=merged_output,
                status="success",
                source="executed",
                prompt_version="openclaw_dispatch_v1",
                duration_seconds=round(elapsed, 1),
                metadata={
                    "openclaw_dispatch": True,
                    "subtask_count": len(subtasks),
                    "base_url": base_url,
                },
            )
            save_step(step_log)
            return step_log, elapsed
        except (Exception,) as exc:
            # 捕获 OpenclawError 和 httpx.TimeoutException,以及其他连接失败
            warnings.warn(
                f"openclaw_dispatch fallback→spawn: {exc}",
                stacklevel=2,
            )
            logger.warning(
                "openclaw_dispatch fallback→spawn [step=%s]: %s",
                self.agents[idx].step_id,
                exc,
            )
            # fallback: 走 spawn 路径,不影响朝堂 flow 运行
            return self._execute_spawn_step(
                step_config, idx, run_id, context, task_input
            )

    def _inject_verified_facts(self, context: dict) -> None:
        """户部真数据主路:配置了 verified_facts_store 且文件存在 → 注入 ctx.verified_facts,
        让 number_provenance 硬闸对真数据咬合(不再空转)。缺文件 → 不注入(闸继续跳过,行为不变)。
        env HUBU_VERIFIED_FACTS 可覆盖路径;未显式指定时 pytest 下不读默认路径(测试隔离)。"""
        store = self.config.get("verified_facts_store")
        if not store or "verified_facts" in context:
            return
        path = os.environ.get("HUBU_VERIFIED_FACTS")
        if not path:
            path = None if "PYTEST_CURRENT_TEST" in os.environ else store
        if not path or not os.path.exists(path):
            return
        try:
            with open(path, encoding="utf-8") as f:
                context["verified_facts"] = json.load(f)
        except Exception:
            pass  # 载入失败不阻断 flow,闸退回跳过

    # ─── 公开方法 ─────────────────────────────────────

    def run(
        self,
        task_input: str,
        on_step_done=None,
        on_token=None,
        context_extra: dict | None = None,
        on_step_metrics=None,
        on_approval_required=None,
        on_openclaw_turn=None,
        on_step_save=None,
        on_guard_event=None,
        on_step_start=None,
        on_flow_start=None,
        run_id: str | None = None,
        context_override: dict | None = None,
    ) -> RunLog:
        """执行完整 Flow。

        on_token: 可选回调 (step_idx: int, token: str) → None，流式输出时逐 token 调用。
        context_extra: 额外注入 context 的键值（如多轮对话历史）。
        on_step_metrics: 可选回调 (step_idx: int, metrics: dict) → None，
                         每步完成后推送 Harness metrics（token/成本/利用率/lint/断言）。
        context_override: 冻结检索快照（eval 复现专用）。提供 rag_docs / ima_docs /
                          knowledge 任一键时，对应的实时检索被短路、直接用冻结值，使带 RAG
                          的蜂群 input 可复现、质量分 before/after delta 可归因（短路逻辑在
                          _do_pre_retrieval / _do_ima_pre_retrieval 顶部）。
        """
        import concurrent.futures

        # 冻结检索快照：每次 run 重置（不提供则为空 dict → 一律走实时检索）。
        # 在 _do_pre_retrieval / _do_ima_pre_retrieval 顶部按键短路，一处设值覆盖全部调用点。
        self._frozen_context = context_override or {}

        # Harness: 每次 run 重置预算追踪器
        self._budget = ContextBudget()

        # LLM 调用预算（含 repair cycle，跨越整个 run 生命周期）
        _max_llm_calls = self.config.get("max_llm_calls", 200)
        self._llm_budget = LLMCallBudget.set(_max_llm_calls)

        if run_id is None:
            run_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        run_log = RunLog(run_id=run_id, task_input=task_input, flow_name=self.flow_name)
        prompt_versions = {}
        # per-task 动态注入：按本次任务的温度/循环需求筛出"这次真选得了的电芯"子集
        if self._knowledge_dynamic_cells:
            if "knowledge" in self._frozen_context:
                # 冻结快照优先：eval 复现时直接用冻结的电芯子集，不走动态筛选
                self._knowledge_text = self._frozen_context["knowledge"]
            else:
                try:
                    from src.cell_library import format_for_swarm

                    self._knowledge_text = format_for_swarm(task_input)
                except Exception as e:  # 失败回退静态全库注入，不阻断任务
                    logger.warning("动态电芯注入失败，回退静态注入: %s", e)
        context: dict = {"task_input": task_input, "steps": []}
        if self._knowledge_text:
            context["knowledge"] = self._knowledge_text
        if context_extra:
            context.update(context_extra)
        self._inject_verified_facts(context)

        # Harness L4: 初始化 RunState（结构化状态）
        run_state = RunState(
            task_input=task_input,
            knowledge=self._knowledge_text,
        )

        # RAG 预检索（在 Flow 开始前，根据任务描述检索相关文档）
        if self._pre_retrieval_cfg.get("enabled"):
            rag_text = self._do_pre_retrieval(task_input)
            context["rag_docs"] = rag_text
            run_state.rag_docs = rag_text

        # IMA 知识库预检索
        if self._ima_pre_retrieval_cfg.get("enabled"):
            ima_text = self._do_ima_pre_retrieval(task_input)
            if ima_text:
                context["ima_docs"] = ima_text

        max_chars = self.max_context_chars
        prev_step_log = None

        # 通知前端 Flow 开始，传入总步骤数和步骤名称列表
        if on_flow_start:
            on_flow_start(
                len(self.step_configs),
                self.flow_name,
                [sc.get("id", "") for sc in self.step_configs],
            )

        # 构建执行组
        # 优先：如果任意步骤带 depends_on，使用 DAG 拓扑排序
        # 回退：使用原有 parallel_group 逻辑（向后兼容）
        _has_dag = any(sc.get("depends_on") for sc in self.step_configs)
        if _has_dag:
            groups = _dag_topo_sort(self.step_configs)
        else:
            groups = []
            i = 0
            while i < len(self.agents):
                pg = self.step_configs[i].get("parallel_group")
                if pg:
                    group = [i]
                    j = i + 1
                    while (
                        j < len(self.agents)
                        and self.step_configs[j].get("parallel_group") == pg
                    ):
                        group.append(j)
                        j += 1
                    groups.append(group)
                    i = j
                else:
                    groups.append([i])
                    i += 1

        for group in groups:
            if len(group) == 1:
                # ── 顺序执行 ───────────────────────────────────────────
                idx = group[0]
                agent = self.agents[idx]
                prompt_key = self.step_configs[idx].get(
                    "prompt_key"
                ) or self.step_configs[idx].get("id", "")
                run_if = self.step_configs[idx].get("run_if", "")

                if run_if and not _eval_run_if(run_if, context, prev_step_log):
                    # 跳过此步骤
                    skipped = StepLog(
                        run_id=run_id,
                        step_index=idx,
                        step_id=agent.step_id,
                        agent_name=agent.name,
                        timestamp=datetime.now().astimezone().isoformat(),
                        input="",
                        rendered_context="",
                        system_prompt="",
                        model=agent.model or self.default_model,
                        output="[已跳过]",
                        status="skipped",
                        source="executed",
                        prompt_version=prompt_key,
                    )
                    run_log.steps.append(skipped)
                    if on_step_done:
                        on_step_done(
                            idx,
                            len(self.agents),
                            agent.name,
                            0.0,
                            "skipped",
                            "[已跳过]",
                        )
                    prev_step_log = skipped
                    continue

                # ── Knowledge Scope：per-step 按需 RAG 检索 ──
                # 如果 step 配置了 knowledge_scope，用指定域重新检索，
                # 覆盖 context["rag_docs"]；无配置时沿用全局预检索结果（向后兼容）
                step_scope = self.step_configs[idx].get("knowledge_scope")
                if step_scope and self._pre_retrieval_cfg.get("enabled"):
                    context["rag_docs"] = self._do_pre_retrieval(
                        task_input, scope=list(step_scope)
                    )

                # ── KnowledgeRouter：step 级多源知识库（chroma/ragflow/ima 联邦）──
                # YAML schema：steps[i].knowledge: [{source, dataset, top_k}]
                _step_kn = self.step_configs[idx].get("knowledge")
                if _step_kn:
                    try:
                        from src.knowledge import KnowledgeRouter

                        _kn_router = KnowledgeRouter(self.config)
                        _kn_text, _kn_cites = _kn_router.retrieve_for_step(
                            self.step_configs[idx],
                            query=task_input,
                        )
                        if _kn_text:
                            context["knowledge_docs"] = _kn_text
                            context["_knowledge_citations"] = _kn_cites
                    except Exception as _kn_exc:
                        logger.warning(
                            "KnowledgeRouter 检索失败（不影响主流程）: %s", _kn_exc
                        )

                # 人工审批门控：requires_approval: true 时暂停等待用户确认
                _requires = self.step_configs[idx].get("requires_approval")
                _completion_signal = self.step_configs[idx].get("completion_signal", "")
                if _requires and on_approval_required:
                    # 只有当上一步输出包含 completion_signal 时才弹审批框
                    # 否则说明 idea_analyst 还在收集需求，跳过后续步骤等待下一轮对话
                    if _completion_signal:
                        prev_steps = context.get("steps", [])
                        prev_output = prev_steps[-1]["output"] if prev_steps else ""
                        if _completion_signal not in prev_output:
                            logger.info(
                                "[APPROVAL GATE] skip: no completion signal in prev output"
                            )
                            return self._finalize_run(run_log, prompt_versions)

                    logger.info(
                        "[APPROVAL GATE] waiting for user approval on step %s",
                        agent.step_id,
                    )
                    approved = on_approval_required(idx, agent.name, context)
                    if not approved:
                        # 用户取消：静默停止，不向前端发 step 事件（避免误显示为"执行中"）
                        run_log.run_status = "cancelled"
                        return self._finalize_run(run_log, prompt_versions)

                # 传入 max_chars 用于渲染（支持 context_steps 白名单过滤）
                _ctx_steps_filter = self.step_configs[idx].get("context_steps")
                if _ctx_steps_filter:
                    _filtered = dict(context)
                    _filtered["steps"] = [
                        s
                        for s in context["steps"]
                        if s["step"] in set(_ctx_steps_filter)
                    ]
                    rendered = _render_context(_filtered, max_chars)
                else:
                    rendered = _render_context(context, max_chars)
                step_on_token = (
                    (lambda i2: lambda t: on_token(i2, t))(idx) if on_token else None
                )
                if self.step_configs[idx].get("step_type") == "spawn":
                    step_log, elapsed = self._execute_spawn_step(
                        self.step_configs[idx], idx, run_id, context, task_input
                    )
                elif self.step_configs[idx].get("step_type") == "openclaw_dispatch":
                    step_log, elapsed = self._execute_openclaw_dispatch_step(
                        self.step_configs[idx], idx, run_id, context, task_input
                    )
                else:
                    step_log, elapsed = self._execute_step(
                        agent,
                        idx,
                        run_id,
                        context,
                        task_input,
                        rendered_override=rendered,
                        on_token=step_on_token,
                        on_step_save=on_step_save,
                        on_guard_event=on_guard_event,
                        on_step_start=on_step_start,
                    )
                run_log.steps.append(step_log)
                prompt_versions[prompt_key] = step_log.prompt_version
                context["steps"].append(
                    {
                        "step": agent.step_id,
                        "agent_name": agent.name,
                        "output": step_log.output,
                    }
                )
                # Harness L4: 更新 RunState
                run_state.add_step(
                    agent.step_id, agent.name, step_log.output, step_log.status
                )
                artifacts_extract = self.step_configs[idx].get("artifacts_extract", [])
                if artifacts_extract:
                    run_state.extract_artifacts(
                        agent.step_id, step_log.output, artifacts_extract
                    )

                prev_step_log = step_log
                # Harness L5: 推送 step_metrics 给可观测性仪表盘（先推 metrics，后推 done 标记）
                if on_step_metrics:
                    on_step_metrics(idx, _build_step_metrics(step_log))
                if on_step_done:
                    on_step_done(
                        idx,
                        len(self.agents),
                        agent.name,
                        elapsed,
                        step_log.status,
                        step_log.output,
                    )

                # LLM 调用预算耗尽：立即终止 run
                if step_log.status == "budget_exceeded":
                    run_log.run_status = "budget_exceeded"
                    logger.warning("Run %s 触发 LLM 调用预算上限，终止执行", run_id)
                    return self._finalize_run(run_log, prompt_versions)

                if step_log.status == "error":
                    run_log.run_status = "error"
                    logger.warning(
                        "Run %s step %s 失败，终止执行", run_id, agent.step_id
                    )
                    return self._finalize_run(run_log, prompt_versions)

                # ── OpenClaw 交互式多轮对话 ──────────────────────────────
                # openclaw_interactive: true 时，OpenClaw 输出后暂停，允许用户继续对话
                if (
                    self.step_configs[idx].get("step_type") == "openclaw"
                    and self.step_configs[idx].get("openclaw_interactive")
                    and on_openclaw_turn is not None
                ):
                    oc_messages = [
                        {"role": "user", "content": rendered},
                        {"role": "assistant", "content": step_log.output},
                    ]
                    while True:
                        user_reply = on_openclaw_turn(idx, agent.name, step_log.output)
                        if user_reply is None:
                            break
                        oc_messages.append({"role": "user", "content": user_reply})
                        t0_oc = time.monotonic()
                        oc_result = self._execute_openclaw_step(
                            self.step_configs[idx], rendered, messages=oc_messages
                        )
                        oc_elapsed = time.monotonic() - t0_oc
                        new_output = oc_result.get("output", "")
                        oc_messages.append({"role": "assistant", "content": new_output})
                        step_log.output = new_output
                        context["steps"][-1]["output"] = new_output
                        if on_step_done:
                            on_step_done(
                                idx,
                                len(self.agents),
                                agent.name,
                                oc_elapsed,
                                "success",
                                new_output,
                            )

                # ── OpenClaw 自动循环模式 ────────────────────────────────
                # openclaw_auto_loop: true 时，OpenClaw 自动迭代，无需用户每轮确认。
                # 用户可随时注入一条消息（注入下一轮上下文），或点"满意了"停止循环。
                elif (
                    self.step_configs[idx].get("step_type") == "openclaw"
                    and self.step_configs[idx].get("openclaw_auto_loop")
                    and on_openclaw_turn is not None
                ):
                    done_signal = self.step_configs[idx].get("openclaw_done_signal", "")
                    max_turns = self.step_configs[idx].get("openclaw_max_turns", 10)
                    oc_messages = [
                        {"role": "user", "content": rendered},
                        {"role": "assistant", "content": step_log.output},
                    ]
                    for _ in range(max_turns):
                        # 非阻塞回调：立即返回 None（停止）、""（自动继续）或用户注入的消息
                        user_reply = on_openclaw_turn(idx, agent.name, step_log.output)
                        if user_reply is None:  # 用户点击"满意了，继续下一步"
                            break
                        if done_signal and done_signal in step_log.output:
                            break
                        continue_msg = user_reply if user_reply else "请继续"
                        oc_messages.append({"role": "user", "content": continue_msg})
                        t0_oc = time.monotonic()
                        oc_result = self._execute_openclaw_step(
                            self.step_configs[idx],
                            rendered,
                            messages=oc_messages,
                            on_token=step_on_token,
                        )
                        oc_elapsed = time.monotonic() - t0_oc
                        new_output = oc_result.get("output", "")
                        oc_messages.append({"role": "assistant", "content": new_output})
                        step_log.output = new_output
                        context["steps"][-1]["output"] = new_output
                        if on_step_done:
                            on_step_done(
                                idx,
                                len(self.agents),
                                agent.name,
                                oc_elapsed,
                                "running",
                                new_output,
                            )

                # 质量门控：blocked 状态时终止后续步骤
                if step_log.status == "blocked":
                    _gate_meta = step_log.metadata or {}
                    logger.warning(
                        "Step %s 质量门控阻断（得分 %.1f < %.1f），终止后续步骤",
                        agent.step_id,
                        _gate_meta.get("quality_gate_actual", 0.0),
                        _gate_meta.get("quality_gate_threshold", 0.0),
                    )
                    run_log.run_status = "blocked"
                    return self._finalize_run(run_log, prompt_versions)

            else:
                # ── 并行执行 ───────────────────────────────────────────
                # 所有并行步骤共享同一上下文快照
                results: dict[int, tuple] = {}

                def _run_parallel_step(idx: int) -> tuple:
                    a = self.agents[idx]
                    tok_cb = (
                        (lambda i2: lambda t: on_token(i2, t))(idx)
                        if on_token
                        else None
                    )
                    # DAG 模式：每个并行步骤只看自己祖先的输出，防止并发步骤互相看到对方
                    # context_steps 白名单进一步限制可见步骤（优先级高于祖先过滤）
                    if _has_dag:
                        ancestor_ids = _get_ancestor_ids(a.step_id, self.step_configs)
                        ctx_steps_filter = self.step_configs[idx].get("context_steps")
                        allowed_ids = (
                            set(ctx_steps_filter) if ctx_steps_filter else ancestor_ids
                        )
                        anc_context = dict(context)
                        anc_context["steps"] = [
                            s for s in context["steps"] if s["step"] in allowed_ids
                        ]
                        rendered = _render_context(anc_context, max_chars)
                    else:
                        rendered = _render_context(context, max_chars)
                    if self.step_configs[idx].get("step_type") == "spawn":
                        spawn_ctx = anc_context if _has_dag else context
                        return idx, *self._execute_spawn_step(
                            self.step_configs[idx], idx, run_id, spawn_ctx, task_input
                        )
                    if self.step_configs[idx].get("step_type") == "openclaw_dispatch":
                        oc_ctx = anc_context if _has_dag else context
                        return idx, *self._execute_openclaw_dispatch_step(
                            self.step_configs[idx], idx, run_id, oc_ctx, task_input
                        )
                    return idx, *self._execute_step(
                        a,
                        idx,
                        run_id,
                        context,
                        task_input,
                        rendered_override=rendered,
                        on_token=tok_cb,
                        on_step_save=on_step_save,
                        on_guard_event=on_guard_event,
                        on_step_start=on_step_start,
                    )

                with concurrent.futures.ThreadPoolExecutor(
                    max_workers=len(group)
                ) as executor:
                    futures = {
                        executor.submit(with_tenant(_run_parallel_step), idx): idx
                        for idx in group
                    }
                    for fut in concurrent.futures.as_completed(futures):
                        res = fut.result()
                        results[res[0]] = (res[1], res[2])  # step_log, elapsed

                # 按原始顺序合并结果
                for idx in group:
                    step_log, elapsed = results[idx]
                    agent = self.agents[idx]
                    prompt_key = self.step_configs[idx].get(
                        "prompt_key"
                    ) or self.step_configs[idx].get("id", "")
                    run_log.steps.append(step_log)
                    prompt_versions[prompt_key] = step_log.prompt_version
                    context["steps"].append(
                        {
                            "step": agent.step_id,
                            "agent_name": agent.name,
                            "output": step_log.output,
                        }
                    )
                    # Harness L4: 更新 RunState（并行步骤）
                    run_state.add_step(
                        agent.step_id, agent.name, step_log.output, step_log.status
                    )
                    artifacts_extract = self.step_configs[idx].get(
                        "artifacts_extract", []
                    )
                    if artifacts_extract:
                        run_state.extract_artifacts(
                            agent.step_id, step_log.output, artifacts_extract
                        )

                    prev_step_log = step_log
                    # Harness L5: 推送 step_metrics 给可观测性仪表盘（先推 metrics，后推 done 标记）
                    if on_step_metrics:
                        on_step_metrics(idx, _build_step_metrics(step_log))
                    if on_step_done:
                        on_step_done(
                            idx,
                            len(self.agents),
                            agent.name,
                            elapsed,
                            step_log.status,
                            step_log.output,
                        )

                # 并行分支预算耗尽：有任意步骤 budget_exceeded 则终止
                budget_step = next(
                    (
                        results[i][0]
                        for i in group
                        if results[i][0].status == "budget_exceeded"
                    ),
                    None,
                )
                if budget_step is not None:
                    run_log.run_status = "budget_exceeded"
                    logger.warning(
                        "并行 Step %s 触发 LLM 调用预算上限，终止执行",
                        budget_step.step_id,
                    )
                    return self._finalize_run(run_log, prompt_versions)

                # 并行分支错误：有任意步骤 error 则终止
                error_step = next(
                    (results[i][0] for i in group if results[i][0].status == "error"),
                    None,
                )
                if error_step is not None:
                    run_log.run_status = "error"
                    logger.warning(
                        "并行 Step %s 执行失败，终止后续步骤", error_step.step_id
                    )
                    return self._finalize_run(run_log, prompt_versions)

                # 并行分支质量门控：有任意步骤 blocked 则终止
                blocked_step = next(
                    (results[i][0] for i in group if results[i][0].status == "blocked"),
                    None,
                )
                if blocked_step is not None:
                    _gate_meta = blocked_step.metadata or {}
                    logger.warning(
                        "并行 Step %s 质量门控阻断（得分 %.1f < %.1f），终止后续步骤",
                        blocked_step.step_id,
                        _gate_meta.get("quality_gate_actual", 0.0),
                        _gate_meta.get("quality_gate_threshold", 0.0),
                    )
                    run_log.run_status = "blocked"
                    return self._finalize_run(run_log, prompt_versions)

        # Harness L4: 将 artifacts 写入 run_meta（供后续查询）
        if run_state.artifacts:
            logger.info("RunState artifacts: %s", list(run_state.artifacts.keys()))

        return self._finalize_run(run_log, prompt_versions)

    def rerun_from(
        self,
        run_id: str,
        from_step: int = 0,
        prompt_override: str | None = None,
        context_overlay: str | None = None,
        on_step_done=None,
        step_id: str | None = None,
        step_overrides: dict | None = None,
        new_run_id: str | None = None,
    ) -> RunLog:
        """从某一步重跑。用旧 step 的 output 重建 context。

        线性模式（无 depends_on）：用 from_step（int）指定从第几步开始重跑。
        DAG 模式（任意步骤带 depends_on）：用 step_id（str）指定目标节点。
          - 祖先步骤的输出直接从原始日志继承（source='inherited'），不重新执行。
          - 目标步骤及其所有后继按拓扑顺序重新执行。

        Args:
            run_id:          原始运行的 run_id。
            from_step:       线性模式下从第几步开始（0-based 下标）。
                             DAG 模式下此参数被忽略，请使用 step_id。
            prompt_override: 仅对目标步骤（from_step 或 step_id 对应的步骤）替换 prompt。
            context_overlay: 附加到目标步骤渲染上下文末尾的额外文本。
            on_step_done:    每步完成后的回调。
            step_id:         DAG 模式下目标节点的 step_id（str）。
                             若提供此参数且 flow 有 depends_on，则进入 DAG 模式。
        """
        # 调试重跑：临时覆盖 step 的 tools / knowledge / model（不改写 YAML）
        # step_overrides shape: {step_id: {tools?, knowledge?, model?}}
        if step_overrides:
            for sc in self.step_configs:
                ov = step_overrides.get(sc.get("id"))
                if not ov:
                    continue
                if "tools" in ov:
                    sc["tools"] = ov["tools"]
                if "knowledge" in ov:
                    sc["knowledge"] = ov["knowledge"]
                if "model" in ov:
                    sc["model"] = ov["model"]
                sc["_debug_override"] = True
            logger.info("调试重跑: 应用 %d 个 step 临时覆盖", len(step_overrides))

        _has_dag = any(sc.get("depends_on") for sc in self.step_configs)

        if _has_dag:
            return self._rerun_from_dag(
                run_id=run_id,
                step_id=step_id,
                prompt_override=prompt_override,
                context_overlay=context_overlay,
                on_step_done=on_step_done,
                new_run_id=new_run_id,
            )

        # ── 线性模式（向后兼容）──────────────────────────────────────────────
        # Harness: 每次 rerun 重置预算追踪器
        self._budget = ContextBudget()

        old_run = load_run(run_id)
        if old_run is None:
            raise ValueError(f"Run {run_id} not found")
        if from_step < 0 or from_step >= len(self.agents):
            raise ValueError(f"from_step must be 0..{len(self.agents) - 1}")

        new_run_id = new_run_id or (
            datetime.now().strftime("%Y%m%d_%H%M%S_%f") + f"_rerun_from_{from_step}"
        )
        new_run_log = RunLog(
            run_id=new_run_id,
            task_input=old_run.task_input,
            flow_name=self.flow_name,
        )
        context = {"task_input": old_run.task_input, "steps": []}
        if self._knowledge_text:
            context["knowledge"] = self._knowledge_text
        if self._pre_retrieval_cfg.get("enabled"):
            context["rag_docs"] = self._do_pre_retrieval(old_run.task_input)
        prompt_versions = {}

        # 复制旧 step（继承 metadata，修复数据丢失）
        for old_step in old_run.steps[:from_step]:
            copied = StepLog(
                run_id=new_run_id,
                step_index=old_step.step_index,
                step_id=old_step.step_id,
                agent_name=old_step.agent_name,
                timestamp=old_step.timestamp,
                input=old_step.input,
                rendered_context=old_step.rendered_context,
                system_prompt=old_step.system_prompt,
                model=old_step.model,
                output=old_step.output,
                status=old_step.status,
                source="inherited",
                raw_response=old_step.raw_response,
                prompt_version=old_step.prompt_version,
                metadata=old_step.metadata,  # 继承 tool_calls_log 等
            )
            save_step(copied)
            new_run_log.steps.append(copied)

            prompt_key = self.step_configs[old_step.step_index].get(
                "prompt_key"
            ) or self.step_configs[old_step.step_index].get("id", "")
            prompt_versions[prompt_key] = old_step.prompt_version

            context["steps"].append(
                {
                    "step": old_step.step_id,
                    "agent_name": old_step.agent_name,
                    "output": old_step.output,
                }
            )

        # 从 from_step 开始重新执行
        for i in range(from_step, len(self.agents)):
            agent = self.agents[i]
            prompt_key = self.step_configs[i].get("prompt_key") or self.step_configs[
                i
            ].get("id", "")

            # 仅对 from_step 本身应用 prompt_override
            if i == from_step and prompt_override:
                agent_to_run = Agent(
                    step_id=agent.step_id,
                    name=agent.name,
                    system_prompt=prompt_override,
                    adapter=self.default_adapter,
                    model=agent.model,
                    api_base=agent.api_base,
                    api_key=agent.api_key,
                )
            else:
                agent_to_run = agent

            rendered = _render_context(context, self.max_context_chars)
            if context_overlay and i == from_step:
                rendered = rendered + "\n\n---\n\n" + context_overlay

            step_log, elapsed = self._execute_step(
                agent_to_run,
                i,
                new_run_id,
                context,
                old_run.task_input,
                rendered_override=rendered,
            )
            new_run_log.steps.append(step_log)
            prompt_versions[prompt_key] = step_log.prompt_version

            context["steps"].append(
                {
                    "step": agent_to_run.step_id,
                    "agent_name": agent_to_run.name,
                    "output": step_log.output,
                }
            )

            if on_step_done:
                on_step_done(
                    i,
                    len(self.agents),
                    agent_to_run.name,
                    elapsed,
                    step_log.status,
                    step_log.output,
                )

        return self._finalize_run(
            new_run_log,
            prompt_versions,
            run_type="rerun",
            source_run_id=run_id,
            from_step=from_step,
        )

    def _rerun_from_dag(
        self,
        run_id: str,
        step_id: str | None,
        prompt_override: str | None = None,
        context_overlay: str | None = None,
        on_step_done=None,
        new_run_id: str | None = None,
    ) -> RunLog:
        """DAG flow 的重跑实现。

        逻辑：
        1. 定位目标 step_id（必须在 step_configs 中存在）。
        2. 用 _get_ancestor_ids 找出所有祖先。
        3. 祖先步骤：从原始 run 日志中继承输出（source='inherited'），不重新执行。
        4. 目标步骤及其后继：按拓扑顺序重新执行。

        Args:
            run_id:    原始运行的 run_id。
            step_id:   目标节点的 step_id（str）。若为 None 则从第一个根节点开始（全部重跑）。
        """
        import concurrent.futures

        # Harness: 每次 rerun 重置预算追踪器
        self._budget = ContextBudget()

        old_run = load_run(run_id)
        if old_run is None:
            raise ValueError(f"Run {run_id} not found")

        # 所有 step_id 到配置下标的映射
        id_to_idx = {sc["id"]: i for i, sc in enumerate(self.step_configs)}

        # 确定目标 step_id：若未指定则从第一层（全部根节点）开始，相当于全部重跑
        if step_id is None:
            # 找出所有根节点（无 depends_on 或 depends_on 为空的步骤），从它们开始
            target_ids: set[str] = {
                sc["id"] for sc in self.step_configs if not sc.get("depends_on")
            }
        else:
            if step_id not in id_to_idx:
                raise ValueError(
                    f"step_id '{step_id}' 在 flow 配置中不存在。有效的 step_id: {list(id_to_idx.keys())}"
                )
            target_ids = {step_id}

        # 祖先集合：所有目标节点的祖先（取并集）
        ancestor_ids: set[str] = set()
        for tid in target_ids:
            ancestor_ids |= _get_ancestor_ids(tid, self.step_configs)

        # 需要重新执行的 step_id：目标节点 + 目标节点的后继（不在祖先集合中）
        # 策略：拓扑排序所有层，跳过纯祖先节点（不在 target_ids 的祖先）
        rerun_ids: set[str] = set()
        for sc in self.step_configs:
            sid = sc["id"]
            # 不是祖先、或者是目标节点本身 → 需要重跑
            if sid not in ancestor_ids or sid in target_ids:
                rerun_ids.add(sid)

        # 从原始日志中构建 step_id → StepLog 的映射（用于继承输出）
        old_step_map: dict[str, StepLog] = {s.step_id: s for s in old_run.steps}

        # 生成新 run_id（嵌入目标 step_id 便于追溯）
        _target_label = next(iter(target_ids)) if len(target_ids) == 1 else "multi"
        new_run_id = new_run_id or (
            datetime.now().strftime("%Y%m%d_%H%M%S_%f") + f"_rerun_dag_{_target_label}"
        )
        new_run_log = RunLog(
            run_id=new_run_id,
            task_input=old_run.task_input,
            flow_name=self.flow_name,
        )
        context: dict = {"task_input": old_run.task_input, "steps": []}
        if self._knowledge_text:
            context["knowledge"] = self._knowledge_text
        if self._pre_retrieval_cfg.get("enabled"):
            context["rag_docs"] = self._do_pre_retrieval(old_run.task_input)
        prompt_versions: dict = {}

        # 按拓扑顺序逐层处理所有步骤
        groups = _dag_topo_sort(self.step_configs)

        for group in groups:
            if len(group) == 1:
                idx = group[0]
                sc = self.step_configs[idx]
                sid = sc["id"]
                agent = self.agents[idx]
                prompt_key = sc.get("prompt_key") or sc.get("id", "")

                if sid not in rerun_ids:
                    # ── 祖先步骤：继承原始输出 ──────────────────────────────
                    old_step = old_step_map.get(sid)
                    if old_step is None:
                        raise ValueError(
                            f"原始 run {run_id} 中找不到 step_id='{sid}' 的日志，无法继承输出。请先完整跑一次再重跑。"
                        )
                    copied = StepLog(
                        run_id=new_run_id,
                        step_index=old_step.step_index,
                        step_id=old_step.step_id,
                        agent_name=old_step.agent_name,
                        timestamp=old_step.timestamp,
                        input=old_step.input,
                        rendered_context=old_step.rendered_context,
                        system_prompt=old_step.system_prompt,
                        model=old_step.model,
                        output=old_step.output,
                        status=old_step.status,
                        source="inherited",
                        raw_response=old_step.raw_response,
                        prompt_version=old_step.prompt_version,
                        metadata=old_step.metadata,
                    )
                    save_step(copied)
                    new_run_log.steps.append(copied)
                    prompt_versions[prompt_key] = old_step.prompt_version
                    context["steps"].append(
                        {
                            "step": sid,
                            "agent_name": agent.name,
                            "output": old_step.output,
                        }
                    )
                    if on_step_done:
                        on_step_done(
                            idx,
                            len(self.agents),
                            agent.name,
                            0.0,
                            "inherited",
                            old_step.output,
                        )
                else:
                    # ── 重新执行 ────────────────────────────────────────────
                    # 仅对目标步骤应用 prompt_override / context_overlay
                    is_target = sid in target_ids
                    if is_target and prompt_override:
                        agent_to_run = Agent(
                            step_id=agent.step_id,
                            name=agent.name,
                            system_prompt=prompt_override,
                            adapter=self.default_adapter,
                            model=agent.model,
                            api_base=agent.api_base,
                            api_key=agent.api_key,
                        )
                    else:
                        agent_to_run = agent

                    # DAG 模式：只把祖先步骤的输出放入上下文
                    _anc_ids = _get_ancestor_ids(sid, self.step_configs)
                    anc_context = dict(context)
                    anc_context["steps"] = [
                        s for s in context["steps"] if s["step"] in _anc_ids
                    ]
                    rendered = _render_context(anc_context, self.max_context_chars)
                    if is_target and context_overlay:
                        rendered = rendered + "\n\n---\n\n" + context_overlay

                    step_log, elapsed = self._execute_step(
                        agent_to_run,
                        idx,
                        new_run_id,
                        context,
                        old_run.task_input,
                        rendered_override=rendered,
                    )
                    new_run_log.steps.append(step_log)
                    prompt_versions[prompt_key] = step_log.prompt_version
                    context["steps"].append(
                        {
                            "step": sid,
                            "agent_name": agent_to_run.name,
                            "output": step_log.output,
                        }
                    )
                    if on_step_done:
                        on_step_done(
                            idx,
                            len(self.agents),
                            agent_to_run.name,
                            elapsed,
                            step_log.status,
                            step_log.output,
                        )

            else:
                # ── 并行分组 ────────────────────────────────────────────────
                par_results: dict[int, tuple] = {}

                def _run_dag_par_step(idx: int) -> tuple:
                    sc = self.step_configs[idx]
                    sid = sc["id"]
                    agent = self.agents[idx]

                    if sid not in rerun_ids:
                        # 继承
                        old_step = old_step_map.get(sid)
                        if old_step is None:
                            raise ValueError(
                                f"原始 run {run_id} 中找不到 step_id='{sid}' 的日志"
                            )
                        copied = StepLog(
                            run_id=new_run_id,
                            step_index=old_step.step_index,
                            step_id=old_step.step_id,
                            agent_name=old_step.agent_name,
                            timestamp=old_step.timestamp,
                            input=old_step.input,
                            rendered_context=old_step.rendered_context,
                            system_prompt=old_step.system_prompt,
                            model=old_step.model,
                            output=old_step.output,
                            status=old_step.status,
                            source="inherited",
                            raw_response=old_step.raw_response,
                            prompt_version=old_step.prompt_version,
                            metadata=old_step.metadata,
                        )
                        save_step(copied)
                        return idx, copied, 0.0
                    else:
                        # 重新执行
                        _anc_ids = _get_ancestor_ids(sid, self.step_configs)
                        anc_context = dict(context)
                        anc_context["steps"] = [
                            s for s in context["steps"] if s["step"] in _anc_ids
                        ]
                        rendered = _render_context(anc_context, self.max_context_chars)
                        step_log, elapsed = self._execute_step(
                            agent,
                            idx,
                            new_run_id,
                            context,
                            old_run.task_input,
                            rendered_override=rendered,
                        )
                        return idx, step_log, elapsed

                with concurrent.futures.ThreadPoolExecutor(
                    max_workers=len(group)
                ) as executor:
                    futures = {
                        executor.submit(with_tenant(_run_dag_par_step), idx): idx
                        for idx in group
                    }
                    for fut in concurrent.futures.as_completed(futures):
                        res_idx, res_log, res_elapsed = fut.result()
                        par_results[res_idx] = (res_log, res_elapsed)

                # 按原始顺序合并
                for idx in group:
                    step_log, elapsed = par_results[idx]
                    sc = self.step_configs[idx]
                    sid = sc["id"]
                    agent = self.agents[idx]
                    prompt_key = sc.get("prompt_key") or sc.get("id", "")
                    new_run_log.steps.append(step_log)
                    prompt_versions[prompt_key] = step_log.prompt_version
                    context["steps"].append(
                        {
                            "step": sid,
                            "agent_name": agent.name,
                            "output": step_log.output,
                        }
                    )
                    _status = step_log.status if sid in rerun_ids else "inherited"
                    if on_step_done:
                        on_step_done(
                            idx,
                            len(self.agents),
                            agent.name,
                            elapsed,
                            _status,
                            step_log.output,
                        )

        # 确定 from_step_id 供元数据记录
        _from_step_id = next(iter(target_ids)) if len(target_ids) == 1 else None
        return self._finalize_run(
            new_run_log,
            prompt_versions,
            run_type="rerun_dag",
            source_run_id=run_id,
            from_step=None,
            from_step_id=_from_step_id,
        )


def _extract_spawn_subtasks(text: str, field: str) -> list[str]:
    """从文本中提取 spawn 子任务列表。

    依次尝试：```json 代码块 → 整段 JSON → 返回空列表。
    支持字典形式 {"field": [...]} 和直接 JSON 数组 [...]。
    """
    import json
    import re

    def _parse_value(data: object) -> list[str]:
        if isinstance(data, list):
            return [str(v) for v in data if v]
        if isinstance(data, dict) and field in data:
            val = data[field]
            if isinstance(val, list):
                return [str(v) for v in val if v]
        return []

    for block in re.findall(r"```json\s*(.*?)\s*```", text, re.DOTALL):
        try:
            result = _parse_value(json.loads(block))
            if result:
                return result
        except (json.JSONDecodeError, ValueError):
            pass

    try:
        result = _parse_value(json.loads(text))
        if result:
            return result
    except (json.JSONDecodeError, ValueError):
        pass

    return []


def _merge_spawn_outputs(
    results: dict[int, dict],
    subtasks: list[str],
    strategy: str,
) -> str:
    """合并 spawn 子任务的执行结果。

    strategy:
      "numbered" — 每段加 '### 子任务 N：标题' 标签（默认）
      "concat"   — 直接拼接，不加标签
    """
    SEP = "\n\n---\n\n"
    parts: list[str] = []
    for i, task_label in enumerate(subtasks):
        result = results.get(i)
        if result is None:
            output = "[执行失败]"
        elif isinstance(result, dict):
            output = result.get("output", "[执行失败]")
        else:
            output = str(result)

        if strategy == "concat":
            parts.append(output)
        else:
            parts.append(f"### 子任务 {i + 1}：{task_label}\n\n{output}")
    return SEP.join(parts)


def _dag_topo_sort(step_configs: list[dict]) -> list[list[int]]:
    """对含 depends_on 字段的步骤列表做拓扑排序，返回执行层次。

    返回 list[list[int]]，每个子列表是可并行执行的步骤下标。
    无 depends_on 字段的步骤退化为原有 parallel_group 逻辑（不由本函数处理）。

    Raises:
        ValueError: 存在循环依赖或 depends_on 引用了不存在的 step_id。
    """
    id_to_idx = {sc["id"]: i for i, sc in enumerate(step_configs)}

    # 验证所有 depends_on 引用
    for sc in step_configs:
        for dep in sc.get("depends_on") or []:
            if dep not in id_to_idx:
                raise ValueError(
                    f"步骤 '{sc['id']}' 的 depends_on 引用了不存在的 step_id: '{dep}'"
                )

    # Kahn 算法计算入度
    in_degree = [0] * len(step_configs)
    dependents: list[list[int]] = [
        [] for _ in step_configs
    ]  # dependents[i] = i 的后继下标列表

    for i, sc in enumerate(step_configs):
        for dep in sc.get("depends_on") or []:
            j = id_to_idx[dep]
            in_degree[i] += 1
            dependents[j].append(i)

    queue = [i for i, d in enumerate(in_degree) if d == 0]
    if not queue:
        raise ValueError("DAG 循环依赖：所有步骤都有前置依赖，无法确定起始节点")

    layers: list[list[int]] = []
    visited = 0

    while queue:
        layers.append(list(queue))
        visited += len(queue)
        next_queue: list[int] = []
        for idx in queue:
            for succ in dependents[idx]:
                in_degree[succ] -= 1
                if in_degree[succ] == 0:
                    next_queue.append(succ)
        queue = next_queue

    if visited < len(step_configs):
        raise ValueError("DAG 循环依赖：检测到环，无法拓扑排序")

    return layers


def _get_ancestor_ids(step_id: str, step_configs: list[dict]) -> set[str]:
    """返回指定步骤的所有祖先 step_id（包括间接祖先）。"""
    id_to_deps: dict[str, list[str]] = {
        sc["id"]: sc.get("depends_on") or [] for sc in step_configs
    }

    ancestors: set[str] = set()
    stack = list(id_to_deps.get(step_id, []))
    while stack:
        dep = stack.pop()
        if dep in ancestors:
            continue
        ancestors.add(dep)
        stack.extend(id_to_deps.get(dep, []))
    return ancestors


def _render_verified_facts(vf: dict) -> str:
    """已验证财务事实(build_verified_facts 产出)→ 喂模型的可读文本。
    只渲染 periods 的科目数字 + 比率(provenance/gate 是元数据不喂模型)。"""
    if not isinstance(vf, dict):
        return str(vf)[:2000]
    lines: list[str] = []
    for period, data in (vf.get("periods") or {}).items():
        if not isinstance(data, dict):
            continue
        nums = [
            f"{k}={v}"
            for k, v in data.items()
            if k != "_ratios" and not isinstance(v, (dict, list))
        ]
        if nums:
            lines.append(f"【{period}期】" + "、".join(nums))
        ratios = data.get("_ratios") or {}
        if isinstance(ratios, dict) and ratios:
            lines.append("  比率：" + "、".join(f"{k}={v}" for k, v in ratios.items()))
    return "\n".join(lines) or json.dumps(vf, ensure_ascii=False, default=str)[:2000]


def _render_context(context: dict, max_chars: int = 0) -> str:
    """将结构化 context 渲染为喂给模型的文本。

    如果存在已完成的步骤，会自动提取关键数据锚点（价格、预算、技术参数等），
    注入到上下文末尾，强制下游 Agent 引用而非自编数据。

    max_chars: 上下文最大字符数（0 = 不限制）。超出时从最早的步骤输出开始截断。
    """
    SEP = "\n\n---\n\n"

    today_str = datetime.now().strftime("%Y-%m-%d")

    if context.get("conversation_history"):
        task_label = (
            "## 💬 对话记录（含本次消息）\n"
            "以下是你与用户的完整对话历史，最后一行是用户**当前消息**，"
            "请直接接着对话回复，不要重复已问过的问题，不要把当前消息当作全新任务重新开始。\n\n"
            + context["conversation_history"]
            + f"\n用户（当前）：{context['task_input']}"
        )
        fixed_parts: list[str] = [f"## 📅 当前日期\n{today_str}", task_label]
    else:
        fixed_parts: list[str] = [
            f"## 📅 当前日期\n{today_str}",
            f"## 原始客户需求\n{context['task_input']}",
        ]

    # 知识注入（静态数据，插在需求之后、历史步骤之前）
    if context.get("knowledge"):
        fixed_parts.append(
            "## 📋 产品知识库（公司内部数据，必须优先引用）\n"
            "以下数据来自公司产品参数库，涉及产品选型和报价时必须引用这些数据，"
            "不得凭空编造与下列数据矛盾的价格或参数。\n\n" + context["knowledge"]
        )

    # 户部已验证财务事实（金蝶/审计报表导入，唯一可引用的真实数字来源）
    if context.get("verified_facts"):
        fixed_parts.append(
            "## 💵 已验证财务事实（公司金蝶/审计报表导入，唯一可引用的真实数字来源）\n"
            "以下是经确定性校验的公司真实财务数字，涉及任何金额/比率/科目时**必须引用这些数字**，"
            "不得凭空编造，也不得声称“无可用数据”。这些数字已带来源、可直接落笔计算。\n\n"
            + _render_verified_facts(context["verified_facts"])
        )

    # RAG 预检索结果（文档片段，插在静态知识之后）
    if context.get("rag_docs"):
        fixed_parts.append(
            "## 📚 相关文档参考（知识库检索结果）\n"
            "以下内容来自公司知识库的自动检索，可作为分析参考。\n\n"
            + context["rag_docs"]
        )

    # IMA 知识库预检索结果
    if context.get("ima_docs"):
        fixed_parts.append(
            "## 📂 IMA 知识库相关资料（公司历史方案/测试报告）\n"
            "以下内容来自公司 IMA 知识库的自动检索，包含历史方案、测试报告等真实数据，"
            "分析时优先参考这些内容。\n\n" + context["ima_docs"]
        )

    # 槽位指令（需求澄清流程的强制指令，优先级最高）
    if context.get("slot_instruction"):
        fixed_parts.insert(
            0,
            "## ⚙️ 系统强制指令（必须严格执行，优先级高于所有其他指示）\n"
            + context["slot_instruction"],
        )

    # Hermes 记忆：相关历史 run 摘要（FTS5 检索结果）
    if context.get("memory_context"):
        fixed_parts.append(
            "## 🧠 相关历史记忆（自动检索）\n"
            "以下是系统从历史任务中检索到的相关经验，可作为分析参考。\n\n"
            + context["memory_context"]
        )

    # 销售成交飞轮：真实历史成交价锚点（干净燃料，非 LLM 自评成交）
    if context.get("real_deals"):
        fixed_parts.append(
            "## 💰 真实历史成交参考（成交目录，价格锚点）\n\n" + context["real_deals"]
        )

    # Few-Shot 示例注入（来自 case_archive）
    if context.get("few_shot_cases"):
        fixed_parts.append(
            "## 📋 历史相似案例（Few-Shot 参考）\n"
            "以下历史高质量方案供参考，请结合当前客户实际情况，不要照搬。\n\n"
            + context["few_shot_cases"]
        )

    step_parts: list[str] = [
        f"## {step['agent_name']} 的分析结果\n{step['output']}"
        for step in context["steps"]
    ]

    # 上下文窗口管理：超出 max_chars 时从最旧的步骤开始丢弃，并生成语义摘要
    if max_chars > 0 and step_parts:
        fixed_base = SEP.join(fixed_parts)
        dropped_step_parts: list[str] = []
        while len(step_parts) > 1:
            candidate = SEP.join([fixed_base] + step_parts)
            # 留 10% 余量给数据锚点
            if len(candidate) <= int(max_chars * 0.9):
                break
            dropped_step_parts.append(step_parts.pop(0))  # 记录被丢弃的步骤
        if context.get("_window_notice") is not False and dropped_step_parts:
            summary_lines: list[str] = []
            for part in dropped_step_parts:
                header_match = _STEP_HEADER_RE.match(part)
                agent_label = header_match.group(1) if header_match else "早期步骤"
                parts_split = part.split("\n", 1)
                body = parts_split[1] if len(parts_split) > 1 else part
                digest = _semantic_extract_step(body, max_chars=300)
                summary_lines.append(f"**{agent_label}** | {digest}")
            step_parts.insert(
                0,
                f"## [增量上下文摘要] 已压缩最早的 {len(dropped_step_parts)} 个步骤（保留关键数据）\n"
                + "\n\n".join(summary_lines),
            )

    rendered = SEP.join(fixed_parts + step_parts)

    # 提取并注入数据锚点
    anchors = _extract_data_anchors(context)
    if anchors:
        anchor_lines = "\n".join(f"- {a}" for a in anchors)
        rendered += (
            "\n\n---\n\n"
            "## ⚠ 数据锚点（必须引用，不得自编数字）\n"
            "以下数据来自上游分析或原始需求，下游输出中涉及这些数据时必须直接引用，"
            "不得凭空编造不同的数字。如需调整，必须说明调整理由。\n\n"
            f"{anchor_lines}"
        )

    # 最终硬截断（极端情况兜底）
    if max_chars > 0 and len(rendered) > max_chars:
        rendered = rendered[:max_chars] + "\n\n...[上下文已截断，已达上下文窗口上限]"

    return rendered


def _eval_run_if(condition: str, context: dict, prev_step_log=None) -> bool:
    """安全地评估 run_if 条件表达式。

    可用变量：
        prev_status   上一步骤的状态（'success'/'error'/'warning'/'skipped'/'none'）
        prev_score    上一步骤的质量总分（float 或 None）
        step_count    当前已完成的步骤数
        True/False    布尔常量

    示例：
        run_if: "prev_status == 'success'"
        run_if: "prev_score is not None and prev_score >= 3.5"
        run_if: "step_count > 0"
    """
    if not condition or condition.strip().lower() in ("true", "1", "yes"):
        return True
    if condition.strip().lower() in ("false", "0", "no"):
        return False

    prev_score = None
    prev_status = "none"
    if prev_step_log is not None:
        prev_status = getattr(prev_step_log, "status", "none") or "none"
        qs = getattr(prev_step_log, "quality_score", None)
        if isinstance(qs, dict):
            prev_score = qs.get("total_score")

    prev_output = (getattr(prev_step_log, "output", "") or "") if prev_step_log else ""
    safe_vars: dict = {
        "True": True,
        "False": False,
        "None": None,
        "prev_status": prev_status,
        "prev_score": prev_score,
        "prev_output": prev_output,
        "step_count": len(context.get("steps", [])),
    }
    try:
        return bool(eval(condition, {"__builtins__": {}}, safe_vars))  # noqa: S307
    except Exception as e:
        logger.warning("run_if 条件 '%s' 评估失败: %s，默认跳过", condition, e)
        return False


def _format_memory_hits(hits: list[dict]) -> str:
    """将 FTS5 检索结果格式化为注入 context 的文本摘要（每条 ≤50 字）。"""
    lines = []
    for i, hit in enumerate(hits, 1):
        task_summary = (hit.get("task_input") or "")[:50].replace("\n", " ")
        score = hit.get("quality_score") or 0.0
        flow = hit.get("flow_name", "")
        lines.append(f"{i}. [{flow}] 任务：{task_summary}… （质量分 {score:.1f}）")
    return "\n".join(lines)


def _format_few_shot_cases(hits: list[dict]) -> str:
    """将 RAG 检索到的 case_archive 结果格式化为 few-shot 示例。"""
    if not hits:
        return ""
    parts = ["以下是历史相似案例（供参考，不要直接复制）：\n"]
    for i, h in enumerate(hits, 1):
        score_pct = f"{h.get('score', 0):.0%}"
        parts.append(f"### 参考案例 {i}（相关度: {score_pct}）\n{h['content']}\n")
    return "\n".join(parts)


def _extract_and_update_profile(
    person_id: str,
    flow_name: str,
    quality_score: float,
    task_input: str,
) -> None:
    """规则提取：高质量 run 结束后，在 persons/{id}.md 中追加历史反馈信号。

    不调用 LLM，仅做字符串拼接写入。
    """
    from datetime import date

    try:
        from src.memory_tool import add_memory

        today = date.today().isoformat()
        task_summary = task_input[:50].replace("\n", " ")
        entry = f"- {today}: {flow_name} 输出质量 {quality_score:.1f}，任务摘要：{task_summary}"
        result = add_memory(person_id, entry)
        if result.get("ok"):
            logger.info(
                "已更新 person %s 的历史反馈信号（quality=%.1f）",
                person_id,
                quality_score,
            )
        else:
            logger.warning("人格快照写入拒绝: %s", result.get("error"))
    except Exception as e:
        logger.warning("_extract_and_update_profile 失败: %s", e)


import re as _re

# 数据锚点提取的正则模式
_ANCHOR_PATTERNS = [
    # 价格/成本：匹配 "xx元/Wh" "xx万元" 等
    (
        _re.compile(
            r"(?:单价|售价|成本|报价|定价|预算|价格|BOM)[^\n]{0,20}?"
            r"[\d.]+\s*(?:[-~～至到]\s*[\d.]+\s*)?"
            r"(?:元/[Ww][Hh]|万元?|亿元?|元)",
        ),
        "价格/成本",
    ),
    # 技术参数：匹配 "-30℃" "≥85%" "≥6000次" 等
    (
        _re.compile(
            r"(?:保持率|放电|循环寿命|可用率|容量|效率|能量密度)[^\n]{0,30}?"
            r"[≥≤><]?\s*[\d.]+\s*(?:%|次|℃|[Ww][Hh]|[Aa][Hh]|年)",
        ),
        "技术参数",
    ),
    # 预算：匹配 "预算xxx万"
    (
        _re.compile(
            r"预算[^\n]{0,15}?[\d.]+\s*(?:[-~～至到]\s*[\d.]+\s*)?(?:万元?|亿元?|元)",
        ),
        "预算",
    ),
    # 交付周期：匹配 "xx周" "xx个月"
    (
        _re.compile(
            r"(?:周期|交付|工期)[^\n]{0,15}?[\d.]+\s*(?:周|个?月|天)",
        ),
        "交付周期",
    ),
    # 毛利率
    (
        _re.compile(
            r"毛利[率]?[^\n]{0,10}?[\d.]+\s*%",
        ),
        "毛利",
    ),
]


def _extract_data_anchors(context: dict) -> list[str]:
    """从原始需求和已完成步骤中提取关键数据锚点。"""
    anchors = []
    seen = set()

    # 从原始需求提取
    _extract_from_text(context["task_input"], "原始需求", anchors, seen)

    # 从每个已完成步骤提取
    for step in context.get("steps", []):
        _extract_from_text(step["output"], step["agent_name"], anchors, seen)

    return anchors


def _extract_from_text(text: str, source: str, anchors: list, seen: set) -> None:
    """从文本中提取数据锚点。"""
    if not text or text.startswith("[ERROR]"):
        return

    for pattern, category in _ANCHOR_PATTERNS:
        for match in pattern.finditer(text):
            raw = match.group(0).strip()
            # 去重：相同数据不重复添加
            key = _re.sub(r"\s+", "", raw)
            if key in seen or len(raw) < 5:
                continue
            seen.add(key)
            anchors.append(f"【{category}｜{source}】{raw}")


def _load_prompt_from_module(module_path: str | None, prompt_key: str) -> str:
    """从指定模块动态加载 prompt。

    自动发现模块中所有 PROMPT_MAP_* 变量（不再硬编码），
    新增 Flow 只需在 prompt 模块中定义 PROMPT_MAP_XXX 即可。
    """
    if not module_path:
        raise ValueError(
            f"Prompt '{prompt_key}' not in PROMPT_MAP and no prompt_module specified"
        )
    import importlib

    mod = importlib.import_module(module_path)
    # 自动发现所有 PROMPT_MAP_* 变量
    for attr_name in dir(mod):
        if attr_name.startswith("PROMPT_MAP_"):
            prompt_map = getattr(mod, attr_name)
            if isinstance(prompt_map, dict) and prompt_key in prompt_map:
                return prompt_map[prompt_key]
    raise ValueError(f"Prompt '{prompt_key}' not found in module '{module_path}'")


# 蜂群专属 final_output 兜底/安全垫 已抽出到 src/swarm_fallbacks.py(恢复"加蜂群不改引擎"解耦)。
# 引擎只在 _finalize_run 调用下列函数;新增蜂群兜底改 swarm_fallbacks.py,不再动本文件内核。
from src.swarm_fallbacks import (  # noqa: E402
    _apply_opc_safety_floor,
    _apply_opc_safety_floor_with_report,
    _apply_pack_rd_cost_gate_with_report,
    _apply_product_redline_final_output_with_report,
    _apply_shiguan_archive_final_output_with_report,
    _build_ai_ops_final_output,
    _build_ai_ops_final_output_with_report,
    _build_haolong_final_output,
    _build_haolong_final_output_with_report,
    _build_ima_final_output,
    _build_ima_final_output_with_report,
    _build_pack_rd_final_output,
    _build_quotation_final_output,
    _build_release_final_output_with_report,
    _build_sdlc_final_output,
    _build_sourcing_final_output,
    _build_xiaohongshu_final_output,
    _is_opc_safety_floor_triggered,
)


def _sanitize_json_text(text: str) -> str:
    """修复模型输出中常见的 JSON 破坏问题。

    主要处理：中文引号 \u201c\u201d 在 JSON 字符串值内与 JSON 双引号冲突。
    策略：将中文引号替换为书名号或单引号，避免 JSON 解析器误判。
    """

    # 替换中文左右双引号为「」（在 JSON 字符串值内不会冲突）
    # 只替换不在 JSON 结构位置的引号（即不在 key: "value" 的边界位置）
    # 简单策略：中文引号总是成对出现在内容中，直接替换
    text = text.replace("\u201c", "\u300c")  # " → 「
    text = text.replace("\u201d", "\u300d")  # " → 」
    text = text.replace("\u2018", "\u300e")  # ' → 『
    text = text.replace("\u2019", "\u300f")  # ' → 』
    return text


def _build_step_metrics(step_log) -> dict:
    """从 StepLog 提取 Harness metrics，用于 SSE step_metrics 事件。"""
    meta = step_log.metadata or {}
    ctx_metrics = meta.get("context_metrics", {})
    lint_meta = meta.get("lint", {})
    assert_meta = meta.get("assertions", {})
    return {
        "step_id": step_log.step_id,
        "step_index": step_log.step_index,
        "model": step_log.model,
        "status": step_log.status,
        # Context budget
        "prompt_tokens": ctx_metrics.get("actual_prompt_tokens", 0),
        "completion_tokens": ctx_metrics.get("actual_completion_tokens", 0),
        "total_tokens": (
            ctx_metrics.get("actual_prompt_tokens", 0)
            + ctx_metrics.get("actual_completion_tokens", 0)
        ),
        "context_utilization": ctx_metrics.get("utilization_ratio", 0.0),
        "context_zone": ctx_metrics.get("zone", "smart"),
        "cost_usd": ctx_metrics.get("cost_usd", 0.0),
        # Lint
        "lint_passed": lint_meta.get("passed", True),
        "lint_retries": lint_meta.get("retries", 0),
        # Assertions
        "assertions_all_passed": assert_meta.get("all_passed", True),
        "assertions_hard_failures": assert_meta.get("hard_failures", []),
        "warnings": assert_meta.get("warnings", []),
    }


def _parse_qa_output(
    raw_output: str,
    output_fields: list[str] | None = None,
    qa_domain: str = "product",
) -> tuple[dict | None, dict | None]:
    """解析 QA Agent 的 JSON 输出。容错处理。

    qa_domain: "product"(默认,保持现状)强制 C1/C2/C3 硬核查封顶;
    "general"(招聘/法律/咨询等非产品蜂群)只强制 C1 数字勾稽(域中立),
    C2需求约束/C3规格实测属产品语义,对非产品蜂群不适用,改由领域化 QA prompt 软性把关。
    """
    text = raw_output.strip()

    # 去除可能的 markdown 代码块标记
    if text.startswith("```"):
        lines = text.split("\n")
        # 去掉首行 ``` 和末行 ```
        lines = [ln for ln in lines if not ln.strip().startswith("```")]
        text = "\n".join(lines).strip()

    # 修复中文引号等常见 JSON 破坏问题
    text = _sanitize_json_text(text)

    # 若文本不是纯 JSON，从中提取第一个顶层 JSON 对象（处理模型在 JSON 前后附加说明文字的情况）
    if not text.startswith("{"):
        import re as _re

        m = _re.search(r"\{[\s\S]*\}", text)
        if m:
            text = m.group(0)

    try:
        parsed = json.loads(text)
        final_output = parsed.get("final_output")
        qa_result = {
            "qa_result": parsed.get("qa_result", "unknown"),
            "issues": parsed.get("issues", []),
        }

        # 判词槽位表 + 硬核查透传（拟奏节点 memorial_drafter / 御史闸 yushi_gate 的确定性信号源）
        if isinstance(parsed.get("verdict_slots"), dict):
            qa_result["verdict_slots"] = parsed["verdict_slots"]
        if isinstance(parsed.get("hard_checks"), dict):
            qa_result["hard_checks"] = parsed["hard_checks"]

        # 提取质量评分（新增）
        quality_score = parsed.get("quality_score")
        if quality_score:
            # 验证评分结构
            is_valid, issues = validate_quality_score(quality_score)
            if is_valid:
                qa_result["quality_score"] = quality_score
            else:
                qa_result["quality_score_validation_issues"] = issues
                # 尝试修复或保留原始数据
                qa_result["quality_score"] = quality_score

        # 计算总分和等级（如果评分存在）
        if qa_result.get("quality_score"):
            from src.schema import calculate_total_score, get_grade

            scores = qa_result["quality_score"].get("scores", {})
            if scores:
                total = calculate_total_score(scores)
                qa_result["quality_score"]["total_score"] = total
                qa_result["quality_score"]["grade"] = get_grade(total)

        # 二次校验（使用当前 Flow 的字段列表���
        if final_output:
            is_valid, issues = validate_output(final_output, fields=output_fields)
            if not is_valid:
                qa_result["qa_result"] = "fail"
                qa_result["issues"].extend(issues)

        # ── 硬核查闸·确定性强制执行（大神质量复盘 2026-06-04）──
        # 此前"FAIL→封顶≤3、判fail"只活在 QA prompt 文本里，由同一个 LLM 自觉遵守，
        # 模型可输出"hard_checks 全 PASS"绕过。这里用 Python 强制读 hard_checks：
        # C1勾稽/C2需求约束/C3事实有据 任一 FAIL → 强制判 fail + 总分封顶≤3，裁判权归代码。
        hard = parsed.get("hard_checks") or {}
        qa_result["hard_checks"] = hard  # 持久化,供飞轮/可观测切片(Charity)
        # 硬核查关键词按领域:产品类查 C1/C2/C3(C2需求约束/C3规格实测是产品语义);
        # 非产品类(招聘/法律/咨询)只强制 C1 数字勾稽(域中立)——C2/C3 产品语义对它们不适用,
        # 由领域化 QA prompt 软性把关,不再代码硬封顶(此前把"招聘漏电压"误判 fail,LLM 还在 C2/C3 间横跳)。
        _crit_keywords = (
            ("C1", "C2", "C3", "勾稽", "约束", "事实", "命中")
            if qa_domain == "product"
            else ("C1", "勾稽")
        )
        _crit = [
            k
            for k, v in hard.items()
            if str(v).strip().upper() == "FAIL"
            and any(t in str(k) for t in _crit_keywords)
        ]
        if _crit:
            qa_result["qa_result"] = "fail"
            qa_result.setdefault("issues", []).append(
                f"硬核查失败(代码强制,非LLM自评): {', '.join(_crit)} → 判fail且封顶≤3"
            )
            _qs = qa_result.get("quality_score")
            if isinstance(_qs, dict):
                _scores = _qs.get("scores") or {}
                for _dim in (
                    "需求匹配度",
                    "需求覆盖度",
                    "行业专业性",
                    "逻辑一致性",
                    "数据一致性",
                ):
                    if (
                        isinstance(_scores.get(_dim), (int, float))
                        and _scores[_dim] > 3
                    ):
                        _scores[_dim] = 3
                try:
                    from src.schema import calculate_total_score, get_grade

                    _t = min(calculate_total_score(_scores), 3.0) if _scores else 3.0
                except Exception:  # noqa: BLE001
                    _t = min(float(_qs.get("total_score", 3.0)), 3.0)
                _qs["total_score"] = _t
                _qs["grade"] = (
                    get_grade(_t) if "get_grade" in dir() else _qs.get("grade")
                )

        return final_output, qa_result

    except json.JSONDecodeError as e:
        # 本地小模型（如 qwen/llama）常以纯文字输出 QA，尝试从文本判断 pass/fail
        text_lower = raw_output.lower()
        if any(kw in text_lower for kw in ["pass", "通过", "合格", "满足", "完整"]):
            inferred = "pass"
        elif any(
            kw in text_lower for kw in ["fail", "不通过", "不合格", "缺失", "问题"]
        ):
            inferred = "fail"
        else:
            inferred = "error"

        # 尝试从叙述文本中提取 final_output（搜索 output_fields 对应的段落）
        inferred_output: dict | None = None
        if output_fields:
            extracted: dict = {}
            for field in output_fields:
                pattern = rf"(?:^|\n).*?{re.escape(field)}.*?\n([\s\S]*?)(?=\n.*?(?:{'|'.join(re.escape(f) for f in output_fields)})|$)"
                m2 = re.search(pattern, raw_output)
                if m2:
                    extracted[field] = m2.group(1).strip()[:500]
            if len(extracted) >= len(output_fields) // 2:
                inferred_output = extracted

        return inferred_output, {
            "qa_result": inferred,
            "issues": [f"JSON解析失败；QA输出非JSON，已从文本推断结果（原因: {e!s}）"],
            "raw_output": raw_output[:500],
        }


_QA_POLLUTION_MARKERS = (
    '"quality_score"',
    "'quality_score'",
    '"qa_result"',
    "'qa_result'",
    '"issues"',
    "'issues'",
    '"score_breakdown"',
    "'score_breakdown'",
    '"hard_checks"',
    "'hard_checks'",
    "source_agent",
    "failure_dimensions",
)


def _looks_like_qa_polluted_final_output(
    final_output: dict | None,
    output_fields: list[str] | None = None,
) -> bool:
    """判断 final_output 是否像 QA/调试 JSON，而不是业务报告。"""
    if not isinstance(final_output, dict) or not final_output:
        return True
    if output_fields and any(field not in final_output for field in output_fields):
        return True
    qa_keys = {
        "qa_result",
        "quality_score",
        "score_breakdown",
        "hard_checks",
        "issues",
        "weakest_fields",
        "improvement_targets",
    }
    if qa_keys.intersection(final_output.keys()):
        return True

    values = [str(v) for v in final_output.values()]
    polluted = sum(
        any(marker in value for marker in _QA_POLLUTION_MARKERS) for value in values
    )
    return polluted >= max(1, len(values) // 3)


def _build_business_step_final_output_with_report(
    steps: list[StepLog],
    output_fields: list[str] | None,
    final_output: dict | None,
) -> tuple[dict | None, dict]:
    """当 QA 回吐的 final_output 缺失/污染时，用业务步骤产出兜底。

    客户报告不应由 QA 自评 JSON 组成。此兜底只在 final_output 明显缺失或污染时触发，
    正常由 QA 生成的业务 final_output 不受影响。
    """
    report = {
        "applicable": False,
        "reason": "",
        "source_steps": [],
    }
    if not _looks_like_qa_polluted_final_output(final_output, output_fields):
        return final_output, report

    business_steps = [
        step
        for step in steps
        if step.status == "success"
        and step.output
        and step.step_id not in {"qa_tech_support", "qa_check"}
    ]
    report["applicable"] = True
    if not business_steps or not output_fields:
        report["reason"] = "qa_final_output_polluted_but_no_business_steps"
        return final_output, report

    combined = "\n\n".join(
        f"## {step.agent_name or step.step_id}\n{step.output.strip()}"
        for step in business_steps
    ).strip()
    if not combined:
        report["reason"] = "qa_final_output_polluted_but_empty_business_steps"
        return final_output, report

    report.update(
        {
            "reason": "qa_final_output_missing_or_polluted",
            "source_steps": [step.step_id for step in business_steps],
        }
    )
    return {field: combined[:1200] for field in output_fields}, report
