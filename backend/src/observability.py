"""可观测性升级模块 — 结构化 JSON 日志、Prometheus 指标导出、OpenTelemetry 追踪。

集成点：
- web/app.py: 添加 /metrics 端点和 after_request 钩子
- flow_engine.py: 通过 StructuredLogger 记录步骤执行
- 所有模块: 替换 logging.getLogger 为 StructuredLogger
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class StructuredFormatter(logging.Formatter):
    """结构化 JSON 日志格式化器。"""

    def __init__(self, service_name: str = "jiqun_ai"):
        super().__init__()
        self.service_name = service_name
        self.hostname = os.uname().nodename

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.fromtimestamp(record.created).astimezone().isoformat(),
            "level": record.levelname,
            "service": self.service_name,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "message": record.getMessage(),
            "hostname": self.hostname,
            "pid": record.process,
            "thread": record.thread,
        }

        if hasattr(record, "structured_data") and record.structured_data:
            log_entry["data"] = record.structured_data

        if record.exc_info and record.exc_info[1]:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
            }

        return json.dumps(log_entry, ensure_ascii=False, default=str)


class StructuredLogger:
    """结构化日志记录器 — 支持附加结构化数据。"""

    def __init__(self, name: str, logger_instance: logging.Logger | None = None):
        self._logger = logger_instance or logging.getLogger(name)
        self._name = name

    def _log(self, level: int, message: str, **kwargs) -> None:
        record = self._logger.makeRecord(
            name=self._name,
            level=level,
            fn="",
            lno=0,
            msg=message,
            args=(),
            exc_info=None,
        )
        record.structured_data = kwargs if kwargs else None
        self._logger.handle(record)

    def info(self, message: str, **kwargs) -> None:
        self._log(logging.INFO, message, **kwargs)

    def warning(self, message: str, **kwargs) -> None:
        self._log(logging.WARNING, message, **kwargs)

    def error(self, message: str, **kwargs) -> None:
        self._log(logging.ERROR, message, **kwargs)

    def debug(self, message: str, **kwargs) -> None:
        self._log(logging.DEBUG, message, **kwargs)

    def step_executed(self, step_id: str, run_id: str, elapsed_ms: float,
                      model: str, status: str, **kwargs) -> None:
        self.info("step executed", step_id=step_id, run_id=run_id,
                  elapsed_ms=elapsed_ms, model=model, status=status, **kwargs)

    def tool_called(self, tool_name: str, step_id: str, elapsed_ms: int,
                    status: str, **kwargs) -> None:
        self.info("tool called", tool_name=tool_name, step_id=step_id,
                  elapsed_ms=elapsed_ms, status=status, **kwargs)

    def flow_completed(self, flow_name: str, run_id: str, total_steps: int,
                       quality_score: float | None, total_ms: float, **kwargs) -> None:
        self.info("flow completed", flow_name=flow_name, run_id=run_id,
                  total_steps=total_steps, quality_score=quality_score,
                  total_ms=total_ms, **kwargs)


def setup_structured_logging(service_name: str = "jiqun_ai", level: str = "INFO") -> None:
    """全局配置结构化日志。"""
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    handler = logging.StreamHandler()
    handler.setFormatter(StructuredFormatter(service_name))
    root_logger.addHandler(handler)


@dataclass
class MetricSample:
    name: str
    value: float
    timestamp: float
    labels: dict[str, str] = field(default_factory=dict)
    metric_type: str = "gauge"


class PrometheusMetricsExporter:
    """Prometheus 格式指标导出器。

    不依赖 prometheus_client，纯 Python 实现。
    通过 HTTP 端点暴露 /metrics。
    """

    def __init__(self):
        self._counters: dict[str, float] = defaultdict(float)
        self._gauges: dict[str, float] = {}
        self._histograms: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()
        self._label_cache: dict[str, dict[str, str]] = {}

    def inc_counter(self, name: str, value: float = 1.0, labels: dict[str, str] | None = None) -> None:
        key = self._metric_key(name, labels)
        with self._lock:
            self._counters[key] += value
            if labels:
                self._label_cache[key] = labels

    def set_gauge(self, name: str, value: float, labels: dict[str, str] | None = None) -> None:
        key = self._metric_key(name, labels)
        with self._lock:
            self._gauges[key] = value
            if labels:
                self._label_cache[key] = labels

    def observe_histogram(self, name: str, value: float, labels: dict[str, str] | None = None) -> None:
        key = self._metric_key(name, labels)
        with self._lock:
            self._histograms[key].append(value)
            if labels:
                self._label_cache[key] = labels

    def record_step_latency(self, step_id: str, flow_name: str, elapsed_ms: float, model: str) -> None:
        labels = {"step_id": step_id, "flow": flow_name, "model": model}
        self.observe_histogram("step_latency_ms", elapsed_ms, labels)
        self.inc_counter("steps_total", labels={"flow": flow_name})

    def record_step_status(self, step_id: str, flow_name: str, status: str) -> None:
        labels = {"step_id": step_id, "flow": flow_name, "status": status}
        self.inc_counter("step_status_total", labels=labels)
        if status == "error":
            self.inc_counter("errors_total", labels={"flow": flow_name, "step_id": step_id})

    def record_active_runs(self, count: int) -> None:
        self.set_gauge("active_runs", count)

    def export(self) -> str:
        """导出 Prometheus 文本格式。"""
        lines: list[str] = []

        with self._lock:
            for key, value in sorted(self._counters.items()):
                labels = self._label_cache.get(key, {})
                name = key.split("{")[0] if "{" in key else key
                label_str = self._format_labels(labels)
                lines.append(f"# HELP {name} {name}")
                lines.append(f"# TYPE {name} counter")
                lines.append(f"{name}{label_str} {value}")

            for key, value in sorted(self._gauges.items()):
                labels = self._label_cache.get(key, {})
                name = key.split("{")[0] if "{" in key else key
                label_str = self._format_labels(labels)
                lines.append(f"# HELP {name} {name}")
                lines.append(f"# TYPE {name} gauge")
                lines.append(f"{name}{label_str} {value}")

            for key, values in sorted(self._histograms.items()):
                labels = self._label_cache.get(key, {})
                name = key.split("{")[0] if "{" in key else key
                label_str = self._format_labels(labels)

                buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, float("inf")]
                sorted_values = sorted(values)
                bucket_counts = []
                cumulative = 0
                vi = 0
                for b in buckets:
                    while vi < len(sorted_values) and sorted_values[vi] / 1000 <= b:
                        cumulative += 1
                        vi += 1
                    bucket_counts.append(cumulative)

                lines.append(f"# HELP {name} {name}")
                lines.append(f"# TYPE {name} histogram")
                for i, b in enumerate(buckets):
                    b_str = "+Inf" if b == float("inf") else str(b)
                    lines.append(f'{name}_bucket{{le="{b_str}",{label_str[1:-1] if label_str else ""}}} {bucket_counts[i]}')
                lines.append(f"{name}_count{label_str} {len(values)}")
                lines.append(f"{name}_sum{label_str} {sum(v / 1000 for v in values):.6f}")

        return "\n".join(lines) + "\n"

    def _metric_key(self, name: str, labels: dict[str, str] | None) -> str:
        if not labels:
            return name
        label_parts = ",".join(f'{k}="{v}"' for k, v in sorted(labels.items()))
        return f"{name}{{{label_parts}}}"

    def _format_labels(self, labels: dict[str, str]) -> str:
        if not labels:
            return ""
        label_parts = ",".join(f'{k}="{v}"' for k, v in sorted(labels.items()))
        return f"{{{label_parts}}}"


metrics_exporter = PrometheusMetricsExporter()


@dataclass
class TraceSpan:
    """OpenTelemetry 兼容的追踪 Span。"""
    trace_id: str
    span_id: str
    parent_span_id: str = ""
    operation_name: str = ""
    start_time: str = ""
    end_time: str = ""
    duration_ms: float = 0
    status: str = "OK"
    attributes: dict[str, Any] = field(default_factory=dict)
    events: list[dict] = field(default_factory=list)


class TraceCollector:
    """OpenTelemetry 兼容的追踪收集器（文件持久化）。"""

    def __init__(self, traces_dir: Path | None = None):
        self.traces_dir = traces_dir or Path(__file__).resolve().parent.parent / "traces"
        self.traces_dir.mkdir(parents=True, exist_ok=True)
        self._active_spans: dict[str, TraceSpan] = {}
        self._lock = threading.Lock()

    def start_span(
        self,
        trace_id: str,
        span_id: str,
        operation_name: str,
        parent_span_id: str = "",
        attributes: dict | None = None,
    ) -> TraceSpan:
        span = TraceSpan(
            trace_id=trace_id,
            span_id=span_id,
            parent_span_id=parent_span_id,
            operation_name=operation_name,
            start_time=datetime.now().astimezone().isoformat(),
            attributes=attributes or {},
        )
        with self._lock:
            self._active_spans[span_id] = span
        return span

    def end_span(self, span_id: str, status: str = "OK", attributes: dict | None = None) -> TraceSpan | None:
        with self._lock:
            span = self._active_spans.pop(span_id, None)
        if not span:
            return None

        span.end_time = datetime.now().astimezone().isoformat()
        span.status = status
        if attributes:
            span.attributes.update(attributes)

        try:
            start = datetime.fromisoformat(span.start_time)
            end = datetime.fromisoformat(span.end_time)
            span.duration_ms = (end - start).total_seconds() * 1000
        except (ValueError, TypeError):
            pass

        self._persist_span(span)
        return span

    def add_event(self, span_id: str, event_name: str, attributes: dict | None = None) -> None:
        with self._lock:
            span = self._active_spans.get(span_id)
        if span:
            span.events.append({
                "name": event_name,
                "timestamp": datetime.now().astimezone().isoformat(),
                "attributes": attributes or {},
            })

    def _persist_span(self, span: TraceSpan) -> None:
        trace_dir = self.traces_dir / span.trace_id
        trace_dir.mkdir(parents=True, exist_ok=True)
        path = trace_dir / f"{span.span_id}.json"
        path.write_text(
            json.dumps({
                "traceId": span.trace_id,
                "spanId": span.span_id,
                "parentSpanId": span.parent_span_id,
                "operationName": span.operation_name,
                "startTime": span.start_time,
                "endTime": span.end_time,
                "duration_ms": span.duration_ms,
                "status": span.status,
                "attributes": span.attributes,
                "events": span.events,
            }, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8",
        )

    def load_trace(self, trace_id: str) -> list[dict]:
        trace_dir = self.traces_dir / trace_id
        if not trace_dir.exists():
            return []
        spans = []
        for f in sorted(trace_dir.glob("*.json")):
            try:
                spans.append(json.loads(f.read_text(encoding="utf-8")))
            except Exception:
                continue
        return spans


trace_collector = TraceCollector()
