"""
密旨直通车 - 监控模块
生产部署必备
"""
from __future__ import annotations
import time
import threading
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, Optional


@dataclass
class RoutingMetrics:
    """单次路由指标"""
    command: str
    mode: str
    target: str
    latency_ms: float
    success: bool
    cache_hit: bool = False
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


class MetricsCollector:
    """指标收集器"""
    
    def __init__(self, window_seconds: int = 60):
        self.window_seconds = window_seconds
        self._lock = threading.Lock()
        self._routing_history: list[RoutingMetrics] = []
        self._start_time = time.time()
        
        # 聚合统计
        self._total_requests = 0
        self._total_errors = 0
        self._total_latency = 0.0
        self._cache_hits = 0
    
    def record(self, metrics: RoutingMetrics):
        """记录路由指标"""
        with self._lock:
            self._routing_history.append(metrics)
            
            # 清理过期数据
            cutoff = time.time() - self.window_seconds
            self._routing_history = [
                m for m in self._routing_history 
                if time.time() - self._parse_timestamp(m.timestamp) < cutoff
            ]
            
            # 更新聚合
            self._total_requests += 1
            self._total_latency += metrics.latency_ms
            if not metrics.success:
                self._total_errors += 1
            if metrics.cache_hit:
                self._cache_hits += 1
    
    def _parse_timestamp(self, ts: str) -> float:
        try:
            return datetime.fromisoformat(ts).timestamp()
        except:
            return time.time()
    
    def get_stats(self) -> dict:
        """获取统计信息"""
        with self._lock:
            now = time.time()
            
            # 计算窗口内的数据
            window_data = [
                m for m in self._routing_history
                if now - self._parse_timestamp(m.timestamp) < self.window_seconds
            ]
            
            if not window_data:
                return {
                    "total_requests": 0,
                    "requests_per_minute": 0,
                    "error_rate": 0,
                    "avg_latency_ms": 0,
                    "p99_latency_ms": 0,
                    "cache_hit_rate": 0,
                }
            
            # 计算指标
            total = len(window_data)
            errors = sum(1 for m in window_data if not m.success)
            latencies = sorted([m.latency_ms for m in window_data])
            cache_hits = sum(1 for m in window_data if m.cache_hit)
            
            # P99
            p99_idx = int(total * 0.99)
            p99_latency = latencies[p99_idx] if latencies else 0
            
            return {
                "total_requests": total,
                "requests_per_minute": total / (self.window_seconds / 60),
                "error_rate": errors / total if total > 0 else 0,
                "avg_latency_ms": sum(latencies) / len(latencies) if latencies else 0,
                "p99_latency_ms": p99_latency,
                "cache_hit_rate": cache_hits / total if total > 0 else 0,
            }
    
    def get_mode_distribution(self) -> dict:
        """获取各模式分布"""
        with self._lock:
            counts = defaultdict(int)
            for m in self._routing_history:
                counts[m.mode] += 1
            return dict(counts)
    
    def get_uptime(self) -> float:
        """获取运行时间（秒）"""
        return time.time() - self._start_time


class AlertManager:
    """告警管理器"""
    
    def __init__(self):
        self._thresholds = {
            "error_rate": 0.05,       # 5%
            "p99_latency_ms": 1000,    # 1s
            "cache_hit_rate": 0.3,    # 30%
        }
        self._last_alert_time = {}
        self._alert_cooldown = 300  # 5分钟
    
    def check(self, metrics: dict) -> list:
        """检查是否触发告警"""
        alerts = []
        now = time.time()
        
        # 错误率告警
        if metrics.get("error_rate", 0) > self._thresholds["error_rate"]:
            if self._should_alert("error_rate", now):
                alerts.append({
                    "level": "warning",
                    "type": "high_error_rate",
                    "message": f"错误率过高: {metrics['error_rate']*100:.1f}%",
                    "threshold": f">{self._thresholds['error_rate']*100}%",
                })
        
        # 延迟告警
        if metrics.get("p99_latency_ms", 0) > self._thresholds["p99_latency_ms"]:
            if self._should_alert("latency", now):
                alerts.append({
                    "level": "warning",
                    "type": "high_latency",
                    "message": f"P99延迟过高: {metrics['p99_latency_ms']:.0f}ms",
                    "threshold": f">{self._thresholds['p99_latency_ms']}ms",
                })
        
        # 缓存命中率告警
        if metrics.get("cache_hit_rate", 1) < self._thresholds["cache_hit_rate"]:
            if self._should_alert("cache", now):
                alerts.append({
                    "level": "info",
                    "type": "low_cache_hit_rate",
                    "message": f"缓存命中率低: {metrics['cache_hit_rate']*100:.1f}%",
                    "threshold": f"<{self._thresholds['cache_hit_rate']*100}%",
                })
        
        return alerts
    
    def _should_alert(self, alert_type: str, now: float) -> bool:
        last = self._last_alert_time.get(alert_type, 0)
        if now - last < self._alert_cooldown:
            return False
        self._last_alert_time[alert_type] = now
        return True


# 全局实例
metrics_collector = MetricsCollector()
alert_manager = AlertManager()