"""
密旨直通车 - 生产版测试套件 v3.0
包含: 路由、缓存、反馈、监控、限流、健康检查
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from src.direct_router import router, SWARM_PROFILES
from src.direct_cache import cache
from src.direct_feedback import learner
from src.direct_stream import stream_formatter
from src.direct_monitor import metrics_collector, alert_manager
from src.direct_rate_limit import rate_limiter
from src.direct_health import health_checker


class TestRunner:
    def __init__(self):
        self.total_pass = 0
        self.total_fail = 0
    
    def test(self, name, passed, expected=None, actual=None):
        if passed:
            self.total_pass += 1
            print(f"  [PASS] {name}")
        else:
            self.total_fail += 1
            print(f"  [FAIL] {name}")
            if expected:
                print(f"         Expected: {expected}")
                print(f"         Actual: {actual}")


def test_routing(runner):
    """路由测试"""
    print("\n[1] 路由测试")
    
    cases = [
        ("你好", "direct", "llm"),
        ("什么是OPC？", "direct", "llm"),
        ("分析客户线索", "swarm", "haolong"),
        ("查看市场动态", "swarm", "opc"),
        ("对比竞品", "swarm", "product"),
        ("给客户报个价", "swarm", "quotation"),
        ("审阅合同", "swarm", "legal"),
        ("制定策略", "court", "court"),
        ("协调部门", "court", "court"),
    ]
    
    for cmd, exp_mode, exp_target in cases:
        result = router.route(cmd)
        runner.test(f"{cmd[:12]}", 
                   result.mode == exp_mode and result.target == exp_target,
                   f"{exp_mode}/{exp_target}", f"{result.mode}/{result.target}")


def test_cache(runner):
    """缓存测试"""
    print("\n[2] 缓存测试")
    
    key = "__test_cache__"
    cache.set(key, {"data": "test"}, "direct")
    cached = cache.get(key)
    runner.test("缓存写入/读取", cached is not None)
    runner.test("缓存命中标记", cached is not None and cached.get("_cache_hit"))


def test_feedback(runner):
    """反馈测试"""
    print("\n[3] 反馈测试")
    
    fb = learner.record(
        task_id="__test__",
        command="__cmd__",
        mode="direct",
        target="llm",
        rating="bad",
        corrected_mode="swarm",
        corrected_target="haolong"
    )
    runner.test("反馈记录", fb.task_id == "__test__")
    runner.test("Override生效", learner.get_override("__cmd__") is not None)


def test_monitor(runner):
    """监控测试"""
    print("\n[4] 监控测试")
    
    # 记录指标
    from src.direct_monitor import RoutingMetrics
    metrics_collector.record(RoutingMetrics(
        command="test",
        mode="direct",
        target="llm",
        latency_ms=5.0,
        success=True,
    ))
    
    stats = metrics_collector.get_stats()
    runner.test("统计计算", stats.get("total_requests", 0) > 0)
    runner.test("P99延迟", "p99_latency_ms" in stats)
    
    alerts = alert_manager.check(stats)
    runner.test("告警检查", isinstance(alerts, list))


def test_rate_limit(runner):
    """限流测试"""
    print("\n[5] 限流测试")
    
    # 测试限流
    user_id = "__test_user__"
    rate_limiter.reset(user_id)  # 先重置
    
    allowed, _ = rate_limiter.check(user_id, "direct")
    runner.test("首次请求允许", allowed)
    
    remaining = rate_limiter.get_remaining(user_id, "direct")
    runner.test("剩余配额", remaining >= 0 and remaining < 60)
    
    status = rate_limiter.get_status()
    runner.test("状态获取", "limits" in status)


def test_health(runner):
    """健康检查测试"""
    print("\n[6] 健康检查测试")
    
    health = health_checker.check_all()
    runner.test("健康状态", health["status"] in ["healthy", "startup"])
    runner.test("组件列表", "components" in health)
    runner.test("运行时间", "uptime_seconds" in health)
    
    ready = health_checker.get_readiness()
    runner.test("就绪检查", "ready" in ready)
    
    live = health_checker.get_liveness()
    runner.test("存活检查", live.get("alive") == True)


def test_integration(runner):
    """集成测试"""
    print("\n[7] 集成测试")
    
    cmd = "__integration__"
    plan = router.route(cmd)
    
    allowed, _ = rate_limiter.check("__user__", plan.mode)
    
    from src.direct_monitor import RoutingMetrics
    metrics_collector.record(RoutingMetrics(
        command=cmd,
        mode=plan.mode,
        target=plan.target,
        latency_ms=10.0,
        success=True,
    ))
    
    runner.test("完整流程", allowed and plan.mode in ["direct", "swarm", "court"])


def test_api_smoke(runner):
    """API端点冒烟测试：覆盖FastAPI注册、健康检查、限流状态、缓存执行路径。"""
    print("\n[8] API端点测试")

    from fastapi.testclient import TestClient
    from web.main import app

    client = TestClient(app)

    health = client.get("/api/direct/health")
    runner.test(
        "API健康检查",
        health.status_code == 200 and health.json().get("status") == "healthy",
        "200/healthy",
        f"{health.status_code}/{health.text[:80]}",
    )

    explain = client.get("/api/direct/explain", params={"command": "PACK设计方案评审"})
    explain_data = explain.json().get("data", {}) if explain.status_code == 200 else {}
    runner.test(
        "API路由解释",
        explain.status_code == 200
        and explain_data.get("mode") == "swarm"
        and explain_data.get("target") == "pack_rd",
        "swarm/pack_rd",
        f"{explain.status_code}/{explain_data.get('mode')}/{explain_data.get('target')}",
    )

    limits = client.get("/api/direct/limits/status")
    remaining = (limits.json().get("data") or {}).get("remaining", {}) if limits.status_code == 200 else {}
    runner.test(
        "API限流状态",
        limits.status_code == 200 and {"direct", "swarm", "court"} <= set(remaining),
        "direct/swarm/court",
        f"{limits.status_code}/{sorted(remaining)}",
    )

    metrics = client.get("/api/direct/metrics")
    runner.test(
        "API指标格式",
        metrics.status_code == 200
        and "# HELP direct_routing_total" in metrics.text
        and "}}" not in "\n".join(metrics.text.splitlines()[6:12]),
    )

    cached_cmd = "__api_cached_execute__"
    cache.set(cached_cmd, {"cached": True}, "direct")
    execute = client.post("/api/direct/execute", json={"command": cached_cmd})
    execute_body = execute.json() if execute.status_code == 200 else {}
    execute_data = execute_body.get("data") or {}
    execute_result = execute_data.get("result") or {}
    runner.test(
        "API缓存执行",
        execute.status_code == 200
        and execute_body.get("success") is True
        and execute_data.get("mode") == "court"
        and execute_result.get("cached") is True
        and execute_result.get("_cache_hit") is True,
        "cached court execution",
        f"{execute.status_code}/{execute_body}",
    )


def test_ai_ops_long_tail(runner):
    """AI运维长尾表达回归测试。"""
    print("\n[9] AI运维长尾测试")

    cases = [
        "LLM延迟异常排查",
        "RAG服务SLA告警",
        "token成本飙升分析",
        "大模型推理延迟优化",
        "向量检索链路追踪",
    ]

    for cmd in cases:
        result = router.route(cmd)
        runner.test(
            cmd[:18],
            result.mode == "swarm" and result.target == "ai_ops",
            "swarm/ai_ops",
            f"{result.mode}/{result.target}",
        )


def main():
    print("=" * 60)
    print("密旨直通车 - 生产版测试套件 v3.0")
    print("=" * 60)
    
    runner = TestRunner()
    
    test_routing(runner)
    test_cache(runner)
    test_feedback(runner)
    test_monitor(runner)
    test_rate_limit(runner)
    test_health(runner)
    test_integration(runner)
    test_api_smoke(runner)
    test_ai_ops_long_tail(runner)
    
    print("\n" + "=" * 60)
    print(f"测试汇总: {runner.total_pass} 通过, {runner.total_fail} 失败")
    print("=" * 60)
    
    if runner.total_fail == 0:
        print("\n 全部测试通过! 系统已就绪，可以部署!")
    else:
        print(f"\n 存在 {runner.total_fail} 个失败用例")
    
    return 0 if runner.total_fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
