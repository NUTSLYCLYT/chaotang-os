"""
密旨直通车 - 健康检查模块
生产部署必备
"""
from __future__ import annotations
import time
import threading
from dataclasses import dataclass
from typing import Dict, Optional


@dataclass
class ComponentHealth:
    """组件健康状态"""
    name: str
    healthy: bool
    message: str = ""
    latency_ms: float = 0


class HealthChecker:
    """健康检查器"""
    
    def __init__(self):
        self._start_time = time.time()
        self._lock = threading.Lock()
        self._checks = {}
        self._last_check_time = 0
    
    def register_check(self, name: str, check_func):
        """注册健康检查"""
        self._checks[name] = check_func
    
    def check_all(self) -> Dict:
        """执行所有健康检查"""
        with self._lock:
            results = {
                "status": "healthy",
                "timestamp": time.time(),
                "uptime_seconds": time.time() - self._start_time,
                "components": {},
            }
            
            all_healthy = True
            
            for name, check_func in self._checks.items():
                start = time.time()
                try:
                    healthy, message = check_func()
                    latency = (time.time() - start) * 1000
                    
                    results["components"][name] = {
                        "healthy": healthy,
                        "message": message or "OK",
                        "latency_ms": round(latency, 2),
                    }
                    
                    if not healthy:
                        all_healthy = False
                        
                except Exception as e:
                    results["components"][name] = {
                        "healthy": False,
                        "message": str(e),
                        "latency_ms": 0,
                    }
                    all_healthy = False
            
            if not all_healthy:
                results["status"] = "unhealthy"
            elif len(results["components"]) == 0:
                results["status"] = "startup"  # 还没检查过
            
            self._last_check_time = time.time()
            return results
    
    def is_healthy(self) -> bool:
        """快速检查是否健康"""
        return self.check_all()["status"] == "healthy"
    
    def get_readiness(self) -> Dict:
        """获取就绪状态（用于k8s readiness probe）"""
        result = self.check_all()
        return {
            "ready": result["status"] == "healthy",
            "details": result,
        }
    
    def get_liveness(self) -> Dict:
        """获取存活状态（用于k8s liveness probe）"""
        return {
            "alive": True,
            "uptime_seconds": time.time() - self._start_time,
        }


# 全局实例
health_checker = HealthChecker()

# 注册默认检查
def _check_direct_router():
    try:
        from src.direct_router import router
        return True, "OK"
    except Exception as e:
        return False, str(e)

def _check_direct_cache():
    try:
        from src.direct_cache import cache
        return True, f"{cache.get_stats()['cached_items']} items"
    except Exception as e:
        return False, str(e)

health_checker.register_check("direct_router", _check_direct_router)
health_checker.register_check("direct_cache", _check_direct_cache)