"""知识注入功能测试。"""

import os
import sys
import tempfile
from pathlib import Path

import pytest
import yaml

# 确保能 import src
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


class TestKnowledgeRender:
    """测试知识数据渲染为文本。"""

    def test_render_products(self):
        from src.flow_engine import FlowEngine

        data = {
            "products": [
                {
                    "model": "LFP-40C-100Ah",
                    "category": "磷酸铁锂",
                    "capacity": "100Ah",
                    "temp_range": "-40°C ~ 60°C",
                    "cycle_life": "≥3000次",
                    "energy_density": "160Wh/kg",
                    "price_range": "350-420元/只",
                    "lead_time": "6-8周",
                }
            ]
        }
        text = FlowEngine._render_knowledge_data(data)
        assert "LFP-40C-100Ah" in text
        assert "350-420元/只" in text
        assert "磷酸铁锂" in text

    def test_render_packs(self):
        from src.flow_engine import FlowEngine

        data = {
            "pack_solutions": [
                {
                    "name": "标准低温储能PACK",
                    "config": "1P280S",
                    "capacity": "250kWh",
                    "bms": "BMS-V3",
                    "price_range": "0.85-1.0元/Wh",
                }
            ]
        }
        text = FlowEngine._render_knowledge_data(data)
        assert "标准低温储能PACK" in text
        assert "0.85-1.0元/Wh" in text

    def test_render_competitors(self):
        from src.flow_engine import FlowEngine

        data = {
            "competitor_reference": [
                {
                    "brand": "宁德时代",
                    "low_temp_product": "低温版",
                    "temp_range": "-35°C",
                    "price_level": "偏高15%",
                    "advantage": "品牌",
                }
            ]
        }
        text = FlowEngine._render_knowledge_data(data)
        assert "宁德时代" in text
        assert "偏高15%" in text

    def test_render_empty(self):
        from src.flow_engine import FlowEngine

        text = FlowEngine._render_knowledge_data({})
        assert text == ""

    def test_render_generic_nonempty_dict(self):
        from src.flow_engine import FlowEngine

        data = {
            "ai_ops": {
                "quality_score": 1.0,
                "pass": False,
                "case_count": 2,
            }
        }

        text = FlowEngine._render_knowledge_data(data)

        assert "注入知识数据" in text
        assert "ai_ops" in text
        assert "quality_score" in text


class TestKnowledgeInjectLoading:
    """测试 FlowEngine 加载知识注入配置。"""

    def _make_flow_config(self, tmpdir, knowledge_file=None, max_tokens=2000):
        """创建最小 flow 配置文件（不需要真正跑 Agent）。"""
        config = {
            "flow_name": "test",
            "default_model": "openai/test",
            "default_api_key_env": "TEST_KEY",
            "qa_version": "v2",
            "steps": [
                {
                    "id": "qa_tech_support",
                    "name": "QA",
                    "description": "QA",
                    "prompt_key": "qa_tech_support",
                }
            ],
            "output_fields": ["测试"],
        }
        if knowledge_file:
            config["knowledge_inject"] = {
                "file": knowledge_file,
                "max_tokens": max_tokens,
            }
        config_path = str(tmpdir / "flow_test.yaml")
        with open(config_path, "w", encoding="utf-8") as f:
            yaml.dump(config, f, allow_unicode=True)
        return config_path

    def test_no_knowledge_config(self, tmp_path):
        """没有 knowledge_inject 配置时返回 None。"""
        config_path = self._make_flow_config(tmp_path)
        os.environ.setdefault("TEST_KEY", "fake")
        engine = FlowEngine(config_path)
        assert engine._knowledge_text is None

    def test_file_not_found(self, tmp_path):
        """知识文件不存在时返回 None。"""
        config_path = self._make_flow_config(
            tmp_path, knowledge_file="knowledge/nonexistent.yaml"
        )
        os.environ.setdefault("TEST_KEY", "fake")
        engine = FlowEngine(config_path)
        assert engine._knowledge_text is None

    def test_knowledge_loaded(self, tmp_path):
        """正常加载知识文件。"""
        # 创建知识文件
        knowledge_dir = tmp_path / "knowledge"
        knowledge_dir.mkdir()
        knowledge_file = knowledge_dir / "test.yaml"
        knowledge_file.write_text(
            yaml.dump(
                {
                    "meta": {"updated_at": "2026-04-01"},
                    "products": [
                        {
                            "model": "TEST-100",
                            "category": "测试",
                            "capacity": "100Ah",
                            "temp_range": "-40°C",
                            "cycle_life": "3000次",
                            "energy_density": "160Wh/kg",
                            "price_range": "100元",
                            "lead_time": "1周",
                        }
                    ],
                },
                allow_unicode=True,
            ),
            encoding="utf-8",
        )
        config_path = self._make_flow_config(
            tmp_path, knowledge_file=str(knowledge_file)
        )
        os.environ.setdefault("TEST_KEY", "fake")
        engine = FlowEngine(config_path)
        assert engine._knowledge_text is not None
        assert "TEST-100" in engine._knowledge_text

    def test_token_truncation(self, tmp_path):
        """超过 max_tokens 限制时截断。"""
        knowledge_dir = tmp_path / "knowledge"
        knowledge_dir.mkdir()
        knowledge_file = knowledge_dir / "big.yaml"
        # 创建大量产品数据
        products = []
        for i in range(200):
            products.append(
                {
                    "model": f"PROD-{i:04d}",
                    "category": "测试电芯",
                    "capacity": f"{i}Ah",
                    "temp_range": "-40°C",
                    "cycle_life": "3000次",
                    "energy_density": "160Wh/kg",
                    "price_range": f"{100+i}元",
                    "lead_time": "1周",
                }
            )
        knowledge_file.write_text(
            yaml.dump(
                {"meta": {"updated_at": "2026-04-01"}, "products": products},
                allow_unicode=True,
            ),
            encoding="utf-8",
        )
        config_path = self._make_flow_config(
            tmp_path, knowledge_file=str(knowledge_file), max_tokens=500
        )
        os.environ.setdefault("TEST_KEY", "fake")
        engine = FlowEngine(config_path)
        assert engine._knowledge_text is not None
        assert "数据已截断" in engine._knowledge_text

    def test_freshness_warning(self, tmp_path):
        """超过30天未更新时注入警告。"""
        knowledge_dir = tmp_path / "knowledge"
        knowledge_dir.mkdir()
        knowledge_file = knowledge_dir / "old.yaml"
        knowledge_file.write_text(
            yaml.dump(
                {
                    "meta": {"updated_at": "2025-01-01"},
                    "products": [
                        {
                            "model": "OLD",
                            "category": "旧",
                            "capacity": "1Ah",
                            "temp_range": "?",
                            "cycle_life": "?",
                            "energy_density": "?",
                            "price_range": "?",
                            "lead_time": "?",
                        }
                    ],
                },
                allow_unicode=True,
            ),
            encoding="utf-8",
        )
        config_path = self._make_flow_config(
            tmp_path, knowledge_file=str(knowledge_file)
        )
        os.environ.setdefault("TEST_KEY", "fake")
        engine = FlowEngine(config_path)
        assert engine._knowledge_text is not None
        assert "天前" in engine._knowledge_text
        assert "仅供参考" in engine._knowledge_text


class TestRenderContextWithKnowledge:
    """测试 _render_context 中的知识注入。"""

    def test_knowledge_in_rendered_context(self):
        from src.flow_engine import _render_context

        context = {
            "task_input": "测试需求",
            "knowledge": "### 产品参数\n- LFP-40C: 350元",
            "steps": [],
        }
        rendered = _render_context(context)
        assert "产品知识库" in rendered
        assert "LFP-40C: 350元" in rendered
        assert "必须优先引用" in rendered

    def test_no_knowledge(self):
        from src.flow_engine import _render_context

        context = {"task_input": "测试需求", "steps": []}
        rendered = _render_context(context)
        assert "产品知识库" not in rendered

    def test_knowledge_before_steps(self):
        """知识注入应在需求之后、历史步骤之前。"""
        from src.flow_engine import _render_context

        context = {
            "task_input": "需求A",
            "knowledge": "知识B",
            "steps": [{"agent_name": "Agent1", "output": "输出C"}],
        }
        rendered = _render_context(context)
        pos_req = rendered.index("需求A")
        pos_know = rendered.index("知识B")
        pos_step = rendered.index("输出C")
        assert pos_req < pos_know < pos_step


# 需要 import FlowEngine
from src.flow_engine import FlowEngine
