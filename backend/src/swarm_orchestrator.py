"""SwarmOrchestrator: 蜂群编排器 — 通过 EventBus 连接多个独立 Flow。

核心职责：
1. 管理多个蜂群（Flow）的注册与生命周期
2. 通过事件总线实现蜂群间的异步通信
3. 质量门控：上游蜂群输出达标后才触发下游
4. 数据转换：将上游 Flow 的输出转为下游 Flow 的输入
5. 全局状态追踪：记录跨蜂群执行链路
6. 冲突仲裁：循环依赖检测 + 多绑定冲突策略 + 配置校验

架构：
    SwarmOrchestrator
    ├── EventBus（事件总线）
    ├── ConflictResolver（冲突仲裁器）
    ├── Swarm Registry（蜂群注册表）
    ├── Binding Rules（事件绑定规则）
    └── Session State（会话状态）
"""

from __future__ import annotations

import json
import logging
import os
import secrets
import threading
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Callable

import yaml

from src.conflict_resolver import (
    ConfigIssue,
    ConflictResolver,
    safe_payload,
    validate_orchestrator_config,
)
from src.event_bus import Event, EventBus
from src.flow_engine import FlowEngine
from src.step_log import RunLog
from src.tenant import with_tenant
from src.runtime_paths import resolve_runtime_paths

logger = logging.getLogger(__name__)


SESSIONS_DIR = resolve_runtime_paths().swarm_sessions
PROJECT_ROOT = Path(__file__).resolve().parent.parent


def new_session_id() -> str:
    """生成会话 ID：秒级时间戳 + 随机后缀，避免同一秒并发请求互相覆盖会话文件。"""
    return f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(3)}"


# ── 数据结构 ─────────────────────────────────────────────────────────


@dataclass
class SwarmDef:
    """蜂群定义。"""

    swarm_id: str  # 唯一标识，如 "haolong", "opc", "product"
    name: str  # 显示名称
    config_path: str  # Flow 配置文件路径
    qa_version: str = "v3"


@dataclass
class EventBinding:
    """事件绑定规则：当 topic 触发时，启动 target_swarm。"""

    topic: str  # 监听的事件主题
    target_swarm: str  # 要触发的蜂群 ID
    transform: str = "auto"  # 数据转换方式: "auto" | "passthrough" | 自定义 key
    min_quality_score: float = 0.0  # 质量门控：上游总分 >= 此值才触发
    enabled: bool = True


@dataclass
class SwarmRunRecord:
    """单个蜂群的运行记录。"""

    swarm_id: str
    run_id: str
    task_input: str
    status: str = "pending"  # pending | running | completed | failed | skipped
    triggered_by: str = ""  # 触发来源：事件 ID 或 "manual"
    quality_score: float | None = None
    qa_result: dict | None = None
    final_output: dict | None = (
        None  # 业务产出(画像/方案等);修复:此前缺字段致 session 永丢产出(0/105)
    )
    start_time: str = ""
    end_time: str = ""
    error: str = ""


@dataclass
class OrchestratorSession:
    """编排器会话：一次完整的跨蜂群执行。"""

    session_id: str
    task_input: str  # 原始输入
    swarm_runs: list[SwarmRunRecord] = field(default_factory=list)
    events: list[dict] = field(default_factory=list)
    status: str = "running"  # running | completed | failed
    start_time: str = ""
    end_time: str = ""
    # 2026-07-06:工部质量司四闸(sizing/cost/DFM/FMEA)聚合需要把同一客户项目
    # 跨 pack_rd/hardware_design/process_manufacturing 三次独立蜂群触发关联起来；
    # 没有这个字段就不知道该把哪个 session 的 DFM 和哪个 session 的 sizing 配对。
    project_id: str | None = None


# ── 数据转换 ─────────────────────────────────────────────────────────


def _transform_output_to_input(
    source_run: RunLog,
    source_swarm: SwarmDef,
    target_swarm: SwarmDef,
    transform: str,
) -> str:
    """将上游 Flow 的输出转为下游 Flow 的输入文本。

    策略：
    - "passthrough": 直接传递原始 task_input
    - "auto": 将 final_output 的各字段拼成结构化文本
    - 其他: 从 final_output 中提取指定 key
    """
    if transform == "passthrough":
        return source_run.task_input

    if not source_run.final_output:
        # 没有结构化输出，用最后一步的原始输出
        if source_run.steps:
            return source_run.steps[-1].output
        return source_run.task_input

    if transform == "auto":
        # 将 final_output dict 渲染为人类可读文本
        parts = [f"## 来自「{source_swarm.name}」的分析结果\n"]
        for key, value in source_run.final_output.items():
            parts.append(f"### {key}\n{value}\n")
        return "\n".join(parts)

    # 自定义 key：提取指定字段
    value = source_run.final_output.get(transform, "")
    if value:
        return f"## 来自「{source_swarm.name}」— {transform}\n{value}"
    return source_run.task_input


# ── 编排器主体 ────────────────────────────────────────────────────────


class SwarmOrchestrator:
    """蜂群编排器：管理多个 Flow，通过事件总线实现跨蜂群协作。

    用法:
        orch = SwarmOrchestrator("config/swarm_orchestrator.yaml")
        session = orch.run("低温锂电池储能系统方案")  # 自动触发整条链路
    """

    def __init__(self, config_path: str | None = None, provider: str | None = None):
        self.swarms: dict[str, SwarmDef] = {}
        self.bindings: list[EventBinding] = []
        self.bus = EventBus()
        self._engines: dict[str, FlowEngine] = {}
        self._session: OrchestratorSession | None = None
        self._on_swarm_start: Callable | None = None
        self._on_swarm_done: Callable | None = None
        self._on_step_done: Callable | None = None
        self._provider: str | None = provider
        self._resolver: ConflictResolver = ConflictResolver(strategy="all")
        self._config_issues: list[ConfigIssue] = []
        self._parallel_workers: int = 1  # 1 = sequential (default), >1 = parallel
        self._parallel_entry: list[str] = []  # 多入口并行：同时启动的蜂群 ID 列表
        self._threads: list[threading.Thread] = []
        self._threads_lock = threading.Lock()
        self._gov_state: dict = {}  # 治理状态（整改#2），由 _load_config 填充

        if config_path:
            self._load_config(config_path)

    def _load_config(self, config_path: str) -> None:
        """从 YAML 加载编排器配置（含冲突检测）。"""
        with open(config_path, encoding="utf-8") as f:
            config = yaml.safe_load(f)

        # 注册蜂群。flow 配置路径统一解析到项目根（服务可能从任意 CWD 启动），
        # 文件缺失的蜂群跳过注册并大声告警 —— 否则 next(iter(swarms)) 默认入口
        # 会落在坏蜂群上，整条编排在 FlowEngine 构造期炸掉（2026-06-11 实测：
        # flow_bingbu_sales_acquisition.yaml 缺失导致密旨默认路径必死）。
        for s in config.get("swarms", []):
            flow_path = Path(s["config"])
            if not flow_path.is_absolute():
                flow_path = PROJECT_ROOT / flow_path
            if not flow_path.exists():
                logger.warning(
                    "蜂群 '%s' 的 flow 配置不存在，跳过注册: %s", s["id"], s["config"]
                )
                continue
            self.register_swarm(
                SwarmDef(
                    swarm_id=s["id"],
                    name=s["name"],
                    config_path=str(flow_path),
                    qa_version=s.get("qa_version", "v3"),
                )
            )

        # 注册事件绑定
        raw_bindings = config.get("bindings", [])
        for b in raw_bindings:
            self.add_binding(
                EventBinding(
                    topic=b["topic"],
                    target_swarm=b["target_swarm"],
                    transform=b.get("transform", "auto"),
                    min_quality_score=b.get("min_quality_score", 0.0),
                    enabled=b.get("enabled", True),
                )
            )

        # 仲裁策略（可在配置中指定，默认 "all" 兼容现有行为）
        arbitration = config.get("arbitration", {})
        strategy = arbitration.get("strategy", "all")
        self._resolver = ConflictResolver(strategy=strategy)

        # 并行执行配置
        execution = config.get("execution", {})
        self._parallel_workers = execution.get("parallel_workers", 1)
        self._parallel_entry = execution.get("parallel_entry", [])

        # 配置校验（循环依赖 + 重复绑定 + 无效引用）
        self._config_issues = validate_orchestrator_config(
            swarm_ids=list(self.swarms.keys()),
            bindings=raw_bindings,
        )
        for issue in self._config_issues:
            if issue.level == "error":
                logger.error("编排配置错误: %s", issue)
            else:
                logger.warning("编排配置警告: %s", issue)

        # 循环依赖是致命错误，直接抛异常
        errors = [i for i in self._config_issues if i.level == "error"]
        if errors:
            msg = "; ".join(str(e) for e in errors)
            raise ValueError(f"编排配置存在致命错误，无法启动: {msg}")

        # 治理层叠加（整改#2）：读持久化状态，不改 YAML
        try:
            from src.governance import load_governance_state

            self._gov_state = load_governance_state()
        except Exception as _e:
            logger.debug("治理状态加载跳过: %s", _e)

    def register_swarm(self, swarm_def: SwarmDef) -> None:
        """注册一个蜂群。"""
        self.swarms[swarm_def.swarm_id] = swarm_def

    def add_binding(self, binding: EventBinding) -> None:
        """添加事件绑定规则。"""
        self.bindings.append(binding)

    @property
    def config_issues(self) -> list[ConfigIssue]:
        """返回配置校验发现的问题列表。"""
        return self._config_issues

    def _get_engine(self, swarm_id: str) -> FlowEngine:
        """获取或创建蜂群的 FlowEngine（懒加载）。"""
        if swarm_id not in self._engines:
            swarm_def = self.swarms[swarm_id]
            self._engines[swarm_id] = FlowEngine(
                config_path=swarm_def.config_path,
                qa_version=swarm_def.qa_version,
                provider=self._provider,
            )
        return self._engines[swarm_id]

    def _setup_bindings(self) -> None:
        """根据绑定规则设置 EventBus 订阅（含租户 overlay 合并 + 治理层叠加）。"""
        # 第1步·orchestration_plan：每租户 overlay 绑定**先合进全列表**，再统一过 governance——
        # 丞相提议的新绑定不能绕过治理（防绕过）。合并失败回落纯静态，大声报错。
        all_bindings = list(self.bindings)
        try:
            from src.orchestration_plan import merge_bindings_with_overlay

            all_bindings = merge_bindings_with_overlay(all_bindings, set(self.swarms))
        except Exception as _e:
            logger.error(
                "[overlay disabled] 租户绑定 overlay 合并失败，本次运行仅用静态 config: %s",
                _e,
            )
            all_bindings = list(self.bindings)

        # 治理层叠加（整改#2）：只读覆盖，不改 self.bindings 原列表
        try:
            from src.governance import apply_governance_to_bindings

            effective_bindings = apply_governance_to_bindings(
                all_bindings, self._gov_state
            )
        except Exception as _e:
            logger.error(
                "[governance disabled] 治理约束叠加失败，本次运行所有 binding 无治理过滤: %s",
                _e,
            )
            effective_bindings = list(all_bindings)

        for binding in effective_bindings:
            if not binding.enabled:
                continue

            # 用闭包捕获 binding
            def _make_handler(b: EventBinding):
                def handler(event: Event):
                    self._handle_triggered_swarm(event, b)

                return handler

            self.bus.subscribe(binding.topic, _make_handler(binding))

    def _handle_triggered_swarm(self, event: Event, binding: EventBinding) -> None:
        """事件触发的蜂群执行（含冲突仲裁）。"""
        if not self._session:
            return

        target_id = binding.target_swarm
        if target_id not in self.swarms:
            return

        # 深拷贝 payload，防止多个 handler 间相互篡改
        payload = safe_payload(event.payload)

        # 质量门控（quality_score 可能为 None，不能直接链式 .get）
        qs = payload.get("quality_score") or {}
        source_score = qs.get("total_score", 0)
        if binding.min_quality_score > 0 and source_score < binding.min_quality_score:
            record = SwarmRunRecord(
                swarm_id=target_id,
                run_id="",
                task_input="",
                status="skipped",
                triggered_by=event.event_id,
                start_time=datetime.now().astimezone().isoformat(),
                end_time=datetime.now().astimezone().isoformat(),
                error=f"质量门控未通过: {source_score:.2f} < {binding.min_quality_score}",
            )
            self._session.swarm_runs.append(record)
            self._save_session()
            return

        # 构造下游输入
        task_input = payload.get("transformed_input", "")
        if not task_input:
            task_input = payload.get("task_input", self._session.task_input)

        source_swarm_id = payload.get("swarm_id", "")

        # 冲突仲裁：决定是否执行
        result = self._resolver.arbitrate(
            target_swarm=target_id,
            source_swarm=source_swarm_id,
            quality_score=source_score,
            task_input=task_input,
            event_topic=event.topic,
        )

        if result.action == "skip":
            record = SwarmRunRecord(
                swarm_id=target_id,
                run_id="",
                task_input=task_input[:200],
                status="skipped",
                triggered_by=event.event_id,
                start_time=datetime.now().astimezone().isoformat(),
                end_time=datetime.now().astimezone().isoformat(),
                error=f"仲裁跳过: {result.reason}",
            )
            self._session.swarm_runs.append(record)
            logger.info("仲裁跳过 %s: %s", target_id, result.reason)
            self._save_session()
            return

        # 执行下游蜂群
        if self._parallel_workers > 1:
            # with_tenant:在父线程捕获租户,worker 线程恢复——否则子线程 thread-local 为空,
            # 静默回落 'default' 租户,跨租户污染 + 每企业进化归零(会审 CRITICAL,第0步a)。
            t = threading.Thread(
                target=with_tenant(self._run_single_swarm),
                args=(target_id, task_input),
                kwargs={"triggered_by": event.event_id},
                daemon=True,
            )
            with self._threads_lock:
                self._threads.append(t)
            t.start()
        else:
            self._run_single_swarm(
                target_id,
                task_input,
                triggered_by=event.event_id,
            )

    def _run_parallel_entry(self, task_input: str) -> None:
        """并行启动多个入口蜂群（parallel_entry 配置）。

        所有入口蜂群同时在独立线程中运行，本方法阻塞直到全部完成。
        后续蜂群仍通过 EventBus 事件自动触发。
        """
        entry_ids = self._parallel_entry
        if not entry_ids:
            raise ValueError("parallel_entry 列表为空，无法启动并行入口蜂群")
        unknown = [sid for sid in entry_ids if sid not in self.swarms]
        if unknown:
            raise ValueError(f"parallel_entry 引用了未注册的蜂群: {unknown}")

        # with_tenant:并行入口蜂群同样在子线程跑,必须携带父线程租户(见第0步a)。
        threads = [
            threading.Thread(
                target=with_tenant(self._run_single_swarm),
                args=(swarm_id, task_input),
                kwargs={"triggered_by": "manual"},
                daemon=False,
            )
            for swarm_id in entry_ids
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

    def _run_single_swarm(
        self,
        swarm_id: str,
        task_input: str,
        triggered_by: str = "manual",
    ) -> RunLog | None:
        """执行单个蜂群并发布完成事件。"""
        swarm_def = self.swarms[swarm_id]
        run_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")

        record = SwarmRunRecord(
            swarm_id=swarm_id,
            run_id=run_id,
            task_input=task_input,
            status="running",
            triggered_by=triggered_by,
            start_time=datetime.now().astimezone().isoformat(),
        )
        if self._session:
            self._session.swarm_runs.append(record)
            self._save_session()

        if self._on_swarm_start:
            self._on_swarm_start(swarm_id, swarm_def.name)

        # 第一阶段：执行本蜂群 Flow
        # engine 构造（打开 flow YAML）也在 try 内：配置缺失/损坏同样要记成
        # failed run 并发布失败事件，而不是炸穿整个编排。
        try:
            engine = self._get_engine(swarm_id)
            run_log = engine.run(
                task_input, on_step_done=self._on_step_done, run_id=run_id
            )
            record.run_id = run_log.run_id
            record.status = "completed"
            record.end_time = datetime.now().astimezone().isoformat()

            # 提取质量分
            if run_log.quality_score:
                record.quality_score = run_log.quality_score.get("total_score")
            record.qa_result = run_log.qa_result
            final_output = run_log.final_output
            # 会审(Taleb 2026-07-08):不可逆蜂群的产出**落地即标 PENDING_HUMAN_SIGNOFF**
            # (decision_guard 宪法从注释变成在带数据):任何下游(前端/导出/链式流)拿到的
            # 产出自带"未签字不得生效"标记,而不是把安全性押在前端愿不愿意渲染红灯上。
            # 加法式标记(_decision_guard 键),不破坏既有字段消费方。
            try:
                from src.decision_guard import ADVISORY_HEADER, PENDING, is_irreversible

                if final_output and is_irreversible(swarm_id):
                    final_output = {
                        **final_output,
                        "_decision_guard": {
                            "status": PENDING,
                            "flow_id": swarm_id,
                            "advisory": ADVISORY_HEADER,
                        },
                    }
            except Exception:
                logger.exception("decision_guard 标记失败(产出照存,但缺 PENDING 标)")
            record.final_output = final_output  # 业务产出装进 session,前端才取得回

            if self._on_swarm_done:
                self._on_swarm_done(swarm_id, swarm_def.name, run_log)

            # 每个蜂群完成后保存会话，供外部轮询查看进度
            self._save_session()

        except Exception as e:
            record.status = "failed"
            record.end_time = datetime.now().astimezone().isoformat()
            record.error = str(e)

            if self._on_swarm_done:
                self._on_swarm_done(swarm_id, swarm_def.name, None)

            # 失败也要立即落盘，否则外部只能看到会话长期 running 且无 swarm_runs。
            self._save_session()

            # 发布失败事件
            self.bus.publish(
                topic=f"{swarm_id}_failed",
                source=swarm_id,
                payload={
                    "swarm_id": swarm_id,
                    "error": str(e),
                    "status": "failed",
                },
            )
            return None

        # 第二阶段：发布完成事件（触发下游蜂群）
        # 与 Flow 执行分离，下游异常不会污染本蜂群状态
        transformed_input = _transform_output_to_input(
            run_log, swarm_def, swarm_def, "auto"
        )
        self.bus.publish(
            topic=f"{swarm_id}_completed",
            source=swarm_id,
            payload={
                "swarm_id": swarm_id,
                "swarm_name": swarm_def.name,
                "run_id": run_log.run_id,
                "task_input": task_input,
                "transformed_input": transformed_input,
                "final_output": run_log.final_output,
                "quality_score": run_log.quality_score,
                "status": "completed",
            },
        )

        return run_log

    def run(
        self,
        task_input: str,
        entry_swarm: str | None = None,
        entry_swarms: list[str] | None = None,
        session_id: str | None = None,
        project_id: str | None = None,
        on_swarm_start: Callable | None = None,
        on_swarm_done: Callable | None = None,
        on_step_done: Callable | None = None,
    ) -> OrchestratorSession:
        """执行跨蜂群编排。

        Args:
            task_input: 原始任务输入。
            entry_swarm: 入口蜂群 ID（默认用配置中第一个）。
            entry_swarms: 多入口蜂群列表（三层执行计划 junjichu 模式喂入，
                见 orchestration_plan.plan_run_kwargs）。传入时覆盖配置的
                parallel_entry，走既有并行入口通道；与 entry_swarm 互斥。
            session_id: 外部指定的会话 ID（不传则自动生成）。
            project_id: 客户项目关联键（可选）。同一 project_id 下多次触发
                pack_rd/hardware_design/process_manufacturing 才能被质量司
                四闸聚合识别为同一项目，见 list_sessions_by_project()。
            on_swarm_start: 蜂群开始回调 (swarm_id, name)。
            on_swarm_done: 蜂群完成回调 (swarm_id, name, run_log | None)。
            on_step_done: 步骤完成回调（透传给 FlowEngine）。

        Returns:
            OrchestratorSession: 完整会话记录。
        """
        self._on_swarm_start = on_swarm_start
        self._on_swarm_done = on_swarm_done
        self._on_step_done = on_step_done

        # 三层执行计划的多入口（第1步）：覆盖配置的 parallel_entry，
        # 校验在 _run_parallel_entry 里 fail-fast（未注册即抛，铁律2：禁静默回退）。
        if entry_swarms:
            if entry_swarm:
                raise ValueError("entry_swarm 与 entry_swarms 互斥，只能传一个")
            self._parallel_entry = list(entry_swarms)

        # 创建会话（重置仲裁器状态）
        self._resolver.reset()
        self._threads = []
        if not session_id:
            session_id = new_session_id()
        self.bus = EventBus(session_id=session_id)
        self._session = OrchestratorSession(
            session_id=session_id,
            task_input=task_input,
            start_time=datetime.now().astimezone().isoformat(),
            project_id=project_id,
        )

        # 设置事件绑定
        self._setup_bindings()

        # 确定入口蜂群：显式校验，无效入口 fail-fast（铁律2：禁静默回退）
        if not entry_swarm:
            if not self.swarms:
                raise ValueError("没有任何可用蜂群（注册表为空或全部 flow 配置缺失）")
            # 默认用第一个注册的蜂群
            entry_swarm = next(iter(self.swarms))
        elif entry_swarm not in self.swarms:
            raise ValueError(
                f"入口蜂群 '{entry_swarm}' 未注册，可用: {sorted(self.swarms)}"
            )

        # 先持久化一次，让外部轮询可以发现此会话（状态 running）
        self._save_session()

        # 执行入口蜂群（后续蜂群通过事件自动触发）。
        # 任何异常都必须把会话落盘成 failed 再上抛 —— 否则会话文件永挂 running，
        # 外部轮询（GET /api/swarm/sessions）永不收敛。
        try:
            if self._parallel_entry:
                self._run_parallel_entry(task_input)
            else:
                self._run_single_swarm(entry_swarm, task_input, triggered_by="manual")

            # 等待所有并行子蜂群完成
            if self._parallel_workers > 1:
                while True:
                    with self._threads_lock:
                        alive = [t for t in self._threads if t.is_alive()]
                    if not alive:
                        break
                    for t in alive:
                        t.join(timeout=1.0)
        except Exception:
            self._session.events = [asdict(e) for e in self.bus.get_history()]
            self._session.end_time = datetime.now().astimezone().isoformat()
            self._session.status = "failed"
            self._save_session()
            raise

        # 记录事件历史
        self._session.events = [asdict(e) for e in self.bus.get_history()]
        self._session.end_time = datetime.now().astimezone().isoformat()

        # 判断整体状态
        has_failed = any(r.status == "failed" for r in self._session.swarm_runs)
        self._session.status = "failed" if has_failed else "completed"

        # 持久化会话
        self._save_session()

        return self._session

    def run_single(
        self,
        swarm_id: str,
        task_input: str,
        on_step_done: Callable | None = None,
    ) -> RunLog | None:
        """独立运行单个蜂群（不触发事件链）。"""
        self._on_step_done = on_step_done
        session_id = new_session_id()
        self.bus = EventBus(session_id=session_id)
        self._session = OrchestratorSession(
            session_id=session_id,
            task_input=task_input,
            start_time=datetime.now().astimezone().isoformat(),
        )

        # 不设置绑定，纯独立运行
        run_log = self._run_single_swarm(swarm_id, task_input)

        self._session.end_time = datetime.now().astimezone().isoformat()
        self._session.status = "completed" if run_log else "failed"
        self._save_session()

        return run_log

    # parallel_workers>1 时多个蜂群线程并发落盘同一会话文件，必须加锁 + 原子替换，
    # 否则交错写出截断 JSON，读端整个 sessions 列表损坏。
    _save_lock = threading.Lock()

    def _save_session(self) -> Path:
        """持久化会话到 swarm_sessions/{session_id}.json（加锁 + 临时文件原子替换）。"""
        SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
        path = SESSIONS_DIR / f"{self._session.session_id}.json"

        with self._save_lock:
            data = {
                "session_id": self._session.session_id,
                "task_input": self._session.task_input,
                "status": self._session.status,
                "start_time": self._session.start_time,
                "end_time": self._session.end_time,
                "swarm_runs": [asdict(r) for r in list(self._session.swarm_runs)],
                "events": self._session.events,
                "project_id": self._session.project_id,
            }
            tmp = path.with_suffix(f".{secrets.token_hex(4)}.tmp")
            tmp.write_text(
                json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            os.replace(tmp, path)
        return path


def load_session(session_id: str) -> dict | None:
    """加载编排会话；文件缺失或 JSON 损坏均返回 None（不让单个坏文件 500 整个列表）。"""
    path = SESSIONS_DIR / f"{session_id}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        logger.warning("会话文件损坏，跳过 %s: %s", path.name, e)
        return None


def list_sessions_by_project(project_id: str) -> list[dict]:
    """按 project_id 查出该客户项目下全部关联 session(供质量司四闸聚合用)。

    线性扫描 swarm_sessions/*.json ——项目关联本就是低频操作(一个项目
    也就 pack_rd/hardware_design/process_manufacturing 三次触发),不值得
    为此建索引;文件损坏的单个 session 跳过,不让脏文件炸掉整批查询。
    """
    if not project_id or not SESSIONS_DIR.exists():
        return []
    out: list[dict] = []
    for f in SESSIONS_DIR.glob("*.json"):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if data.get("project_id") == project_id:
            out.append(data)
    return out


def list_sessions() -> list[str]:
    """列出所有编排会话（按时间倒序）。"""
    if not SESSIONS_DIR.exists():
        return []
    return sorted(
        [f.stem for f in SESSIONS_DIR.glob("*.json")],
        reverse=True,
    )
