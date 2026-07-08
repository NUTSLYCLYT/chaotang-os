"""
密旨直通车 - 自动化测试脚本
用法: 
  python test_direct_command.py          # 需要服务器运行
  python test_direct_command.py --unit    # 离线单元测试
"""
import sys
import time
import json
import requests
from pathlib import Path

BASE_URL = "http://127.0.0.1:8081"

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def add(self, name: str, passed: bool, msg: str = ""):
        self.results.append({"name": name, "passed": passed, "msg": msg})
        if passed:
            self.passed += 1
        else:
            self.failed += 1
        status = "[PASS]" if passed else "[FAIL]"
        print(f"  {status} {name} {msg}")
    
    def summary(self):
        print(f"\n{'='*50}")
        print(f"通过: {self.passed}, 失败: {self.failed}")
        return self.failed == 0


def test_routing_unit():
    """单元测试：路由逻辑"""
    print("\n[单元测试] 路由逻辑")
    from src.direct_router import router
    
    r = TestResult()
    tests = [
        ("你好", "direct", "llm", "问候"),
        ("什么是OPC？", "direct", "llm", "定义"),
        ("分析客户线索", "swarm", "haolong", "获客"),
        ("查看市场动态", "swarm", "opc", "市场"),
        ("对比竞品", "swarm", "product", "产品"),
        ("给客户报个价", "swarm", "quotation", "报价"),
        ("审阅合同", "swarm", "legal", "法律"),
        ("制定策略", "court", "court", "战略"),
        ("协调部门", "court", "court", "协调"),
    ]
    
    for cmd, expected_mode, expected_target, desc in tests:
        result = router.route(cmd)
        ok = result.mode == expected_mode and result.target == expected_target
        r.add(f"{desc}: {cmd}", ok, f"期望{expected_mode}/{expected_target}, 实际{result.mode}/{result.target}")
    
    return r


def test_cache_unit():
    """单元测试：缓存"""
    print("\n[单元测试] 缓存模块")
    from src.direct_cache import cache
    
    r = TestResult()
    
    # 测试写入
    test_cmd = "__test_cache__"
    test_result = {"data": "test"}
    cache.set(test_cmd, test_result, "direct")
    r.add("缓存写入", True)
    
    # 测试读取
    cached = cache.get(test_cmd)
    r.add("缓存命中", cached is not None and cached.get("_cache_hit"))
    
    # 测试统计
    stats = cache.get_stats()
    r.add("缓存统计", "cached_items" in stats)
    
    return r


def test_feedback_unit():
    """单元测试：反馈学习"""
    print("\n[单元测试] 反馈学习")
    from src.direct_feedback import learner
    
    r = TestResult()
    
    # 记录反馈
    fb = learner.record(
        task_id="__test__",
        command="__test_cmd__",
        mode="direct",
        target="llm",
        rating="bad",
        corrected_mode="swarm",
        corrected_target="haolong"
    )
    r.add("反馈记录", fb.task_id == "__test__")
    
    # 检查override
    override = learner.get_override("__test_cmd__")
    r.add("Override获取", override is not None)
    
    # 统计
    stats = learner.get_stats()
    r.add("反馈统计", stats.get("total_feedback", 0) > 0)
    
    return r


def test_stream_unit():
    """单元测试：流式格式化"""
    print("\n[单元测试] 流式格式化")
    from src.direct_stream import stream_formatter
    
    r = TestResult()
    
    events = [
        stream_formatter.thinking("分析中", 0.5),
        stream_formatter.routing("路由", 0.8),
        stream_formatter.conclusion("完成"),
    ]
    
    for event in events:
        formatted = stream_formatter.format_event(event)
        r.add(f"格式化{event.type}", "type" in formatted)
    
    return r


def test_service_health():
    """服务健康检查"""
    r = TestResult()
    try:
        resp = requests.get(f"{BASE_URL}/api/direct/profiles", timeout=5)
        r.add("服务启动", resp.status_code == 200, f"({resp.status_code})")
        r.add("Profiles接口", len(resp.json().get("data", [])) > 0)
    except Exception as e:
        r.add("服务启动", False, str(e)[:50])
    return r


def test_routing_integration():
    """集成测试：路由"""
    r = TestResult()
    tests = [
        ("你好", "direct"),
        ("分析客户线索", "swarm"),
        ("制定策略", "court"),
    ]
    for cmd, expected in tests:
        try:
            resp = requests.get(f"{BASE_URL}/api/direct/explain", params={"command": cmd}, timeout=5)
            data = resp.json().get("data", {})
            actual = data.get("mode", "")
            r.add(f"{cmd[:15]}", actual == expected, f"{actual} vs {expected}")
        except Exception as e:
            r.add(f"{cmd[:15]}", False, str(e)[:30])
    return r


def main():
    mode = "--unit" in sys.argv
    
    print("=" * 50)
    print("密旨直通车 - 自动化测试")
    print("=" * 50)
    
    if mode:
        print("\n[模式] 离线单元测试（无需服务器）")
    else:
        print("\n[模式] 集成测试（需要服务器运行）")
    
    results = []
    
    # 单元测试
    results.append(("路由逻辑", test_routing_unit()))
    results.append(("缓存模块", test_cache_unit()))
    results.append(("反馈学习", test_feedback_unit()))
    results.append(("流式格式化", test_stream_unit()))
    
    # 集成测试（需要服务器）
    if not mode:
        results.append(("服务健康", test_service_health()))
        results.append(("路由集成", test_routing_integration()))
    
    print("\n" + "=" * 50)
    print("测试汇总")
    print("=" * 50)
    
    total_passed = 0
    total_failed = 0
    for name, res in results:
        status = "[PASS]" if res.failed == 0 else "[FAIL]"
        print(f"  {status} {name}: 通过{res.passed}, 失败{res.failed}")
        total_passed += res.passed
        total_failed += res.failed
    
    print(f"\n总计: 通过 {total_passed}/{total_passed+total_failed}")
    
    if total_failed == 0:
        print("\n所有测试通过!")
    else:
        print(f"\n存在 {total_failed} 个失败用例")
    
    return 0 if total_failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())