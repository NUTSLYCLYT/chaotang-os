"""
密旨直通车 - 限流模块
生产部署必备
"""
from __future__ import annotations
import time
import threading
from collections import defaultdict
from dataclasses import dataclass
from typing import Dict, Optional


@dataclass
class RateLimit:
    """限流配置"""
    requests: int      # 请求数
    window_seconds: int  # 时间窗口


class RateLimiter:
    """滑动窗口限流器"""
    
    # 默认限流配置
    DEFAULT_LIMITS = {
        "direct": RateLimit(requests=60, window_seconds=60),      # 60次/分钟
        "swarm": RateLimit(requests=10, window_seconds=60),       # 10次/分钟
        "court": RateLimit(requests=5, window_seconds=300),        # 5次/5分钟
        "global": RateLimit(requests=100, window_seconds=60),    # 全局100次/分钟
        "login_ip": RateLimit(requests=5, window_seconds=60),      # 单IP登录 5次/分钟
        "login_user": RateLimit(requests=5, window_seconds=60),    # 单用户名登录 5次/分钟
    }
    
    def __init__(self, custom_limits: Optional[Dict[str, RateLimit]] = None):
        self._limits = {**self.DEFAULT_LIMITS}
        if custom_limits:
            self._limits.update(custom_limits)
        
        self._lock = threading.Lock()
        # {user_id: {mode: [timestamp1, timestamp2, ...]}}
        self._requests: Dict[str, Dict[str, list]] = defaultdict(lambda: defaultdict(list))
    
    def check(self, user_id: str, mode: str = "global") -> tuple[bool, Optional[dict]]:
        """
        检查是否允许请求
        返回: (是否允许, 错误信息)
        """
        with self._lock:
            now = time.time()
            
            # 检查各层级限流
            limits_to_check = ["global"]
            if mode in self._limits:
                limits_to_check.append(mode)
            
            for limit_key in limits_to_check:
                limit = self._limits.get(limit_key)
                if not limit:
                    continue
                
                # 获取该用户该模式的请求记录
                requests = self._requests[user_id][limit_key]
                
                # 清理过期记录
                cutoff = now - limit.window_seconds
                requests[:] = [t for t in requests if t > cutoff]
                
                # 检查是否超限
                if len(requests) >= limit.requests:
                    return False, {
                        "error": "rate_limit_exceeded",
                        "limit_key": limit_key,
                        "limit": f"{limit.requests}/{limit.window_seconds}s",
                        "retry_after": int(limit.window_seconds - (now - requests[0])) + 1,
                        "message": f"请求过于频繁，请 {int(limit.window_seconds - (now - requests[0])) + 1} 秒后重试",
                    }
            
            # 记录请求
            for limit_key in limits_to_check:
                limit = self._limits.get(limit_key)
                if limit:
                    self._requests[user_id][limit_key].append(now)
            
            return True, None
    
    def get_remaining(self, user_id: str, mode: str = "global") -> int:
        """获取剩余请求配额"""
        with self._lock:
            now = time.time()
            limit = self._limits.get(mode, self.DEFAULT_LIMITS["global"])
            requests = self._requests[user_id][mode]
            
            # 清理过期
            cutoff = now - limit.window_seconds
            requests = [t for t in requests if t > cutoff]
            
            return max(0, limit.requests - len(requests))
    
    def reset(self, user_id: str, mode: Optional[str] = None):
        """重置限流计数"""
        with self._lock:
            if mode:
                self._requests[user_id].pop(mode, None)
            else:
                self._requests.pop(user_id, None)
    
    def get_status(self) -> dict:
        """获取限流状态"""
        with self._lock:
            total_users = len(self._requests)
            return {
                "total_users": total_users,
                "limits": {
                    key: {
                        "requests": limit.requests,
                        "window_seconds": limit.window_seconds,
                    }
                    for key, limit in self._limits.items()
                },
            }


# 全局实例
rate_limiter = RateLimiter()