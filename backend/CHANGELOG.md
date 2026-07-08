# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-04

### Added

- **feat(sdk)**: Jensen+Karpathy 开放平台战略落地 — 数据飞轮、SDK 骨架及 3 个标准案例
  (`Dockerfile.sdk`, `docker-compose.sdk.yml`, `pyproject.toml`, `examples/01_outdoor_storage`, `examples/02_basestation_lowtemp`, `examples/03_ebike_motor`)
- **feat(d1)**: 三天战室 D1 — Docker SDK + 买家清单 + 物理参数安全标注
  (`docs/buyer_targets.md`, `runtime_prompts/` 四类 AGENTS.md 工程师角色)
- **feat(governance)**: 整改 #2 — 凭良率收敛蜂群 + 治理层降级
  (`src/governance.py`, `scripts/governance_monitor.py`)
- **feat(quality)**: Phase 0.1 质量安全改进 — 黄金测试套件 + CI eval 脚本 + 运行日志
  (`tests/golden/run_golden.py`, `scripts/eval_ci.py`, `src/run_logger.py`, `scripts/flywheel_stats.py`)
- **feat**: 户部财务确定性信任核心 — 校验层 + 数字回链闸 + 唯一真源 (`src/prompts_finance.py`)
- **feat**: OPC/Product 接入 Tavily 实时搜索（DeepSeek 时全效）
- **feat**: OPC market_intel 接入真实知识库 + DuckDuckGo

### Changed

- **feat(pack)**: 大神评审团建议全面重构 PACK 蜂群 — `swarm_orchestrator` 重构，
  `config/flow_product.yaml` 精简，`src/prompts_product.py` 大幅扩充（+221 行）
- **docs**: 销售管道设计文档 + 财务蜂群设计 + 估值案例
  (`docs/fin_intel_valuation_cases.md`, `docs/financial_swarm_design.md`)
- `scripts/validate_flows.py` 扩展 PACK 专用流验证逻辑
- `scripts/golden_cases/` 新增 5 套黄金案例（haolong / opc / pack_rd / product / sourcing）

### Fixed

- **fix(qa)**: QA 维度从 6 维 OPC 通用改为 5 维 PACK 专用 (`src/prompts_qa_v2.py`)
- **fix(pack-flow)**: `executive_summary` 字段缺失修复，确保报告结构完整输出
- **fix(sales)**: 报价质量门真启用 + 金额逐位自检防漏位
- **fix(ocr)**: 断点续灌 + 分批防 OOM

[0.1.0]: https://github.com/third_wsl/jiqun_ai/releases/tag/v0.1.0
