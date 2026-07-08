"""
密旨直通车 v2.2 - 部署验证脚本
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

print('=' * 60)
print('密旨直通车 v2.2 - 部署验证')
print('=' * 60)

# 1. 模块导入
print()
print('[1] 模块导入测试')
try:
    from src.direct_router import router
    from src.direct_cache import cache
    from src.direct_feedback import learner
    from src.direct_stream import stream_formatter
    from src.direct_monitor import metrics_collector
    from src.direct_rate_limit import rate_limiter
    from src.direct_health import health_checker
    print('    [PASS] 所有模块导入成功')
except Exception as e:
    print('    [FAIL] 模块导入失败:', e)
    sys.exit(1)

# 2. 健康检查
print()
print('[2] 健康检查')
health = health_checker.check_all()
print('    状态:', health['status'])
print('    组件:')
for name, info in health['components'].items():
    status = 'OK' if info['healthy'] else 'ERROR'
    print(f'      - {name}: [{status}] {info["message"]}')

# 3. 路由测试
print()
print('[3] 路由测试')
tests = [
    ('你好', 'direct', 'llm'),
    ('分析客户线索', 'swarm', 'haolong'),
    ('查看市场动态', 'swarm', 'opc'),
    ('制定策略', 'court', 'court'),
]
all_pass = True
for cmd, exp_mode, exp_target in tests:
    r = router.route(cmd)
    if r.mode == exp_mode and r.target == exp_target:
        print(f'    [PASS] {cmd} -> {r.mode}/{r.target}')
    else:
        print(f'    [FAIL] {cmd} -> {r.mode}/{r.target} (期望: {exp_mode}/{exp_target})')
        all_pass = False

# 4. 限流测试
print()
print('[4] 限流测试')
allowed, error = rate_limiter.check('deploy_test_user', 'direct')
print('    请求允许:', allowed)
remaining = rate_limiter.get_remaining('deploy_test_user', 'direct')
print('    剩余配额:', remaining, '/ 60')

# 5. 监控测试
print()
print('[5] 监控测试')
from src.direct_monitor import RoutingMetrics
metrics_collector.record(RoutingMetrics(
    command='deploy_test',
    mode='direct',
    target='llm',
    latency_ms=5.0,
    success=True,
    cache_hit=True,
))
stats = metrics_collector.get_stats()
print('    总请求:', stats['total_requests'])
print('    缓存命中率:', f"{stats['cache_hit_rate']*100:.0f}%")
print('    P99延迟:', f"{stats['p99_latency_ms']:.1f}ms")

# 6. 反馈测试
print()
print('[6] 反馈学习')
fb = learner.record('deploy_001', '测试命令', 'direct', 'llm', 'good')
print('    反馈ID:', fb.task_id)

# 7. 流式输出
print()
print('[7] 流式输出')
event = stream_formatter.thinking('部署验证', 0.9)
formatted = stream_formatter.format_event(event)
print('    事件:', formatted['type'])
print('    进度:', formatted['progress'])

print()
print('=' * 60)
print('部署验证完成!')
print('=' * 60)

if all_pass:
    print()
    print('  系统状态: 正常')
    print('  推荐操作: 可以上线')
else:
    print()
    print('  系统状态: 异常')
    print('  推荐操作: 检查路由配置')
