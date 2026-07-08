"""租户上下文跨线程传播 · 回归门(2026-07-07 · 三层架构会审 CRITICAL 第0步a)。

病根:租户存在 threading.local(),不被 spawn 的子线程继承。SwarmOrchestrator 的 worker 线程
(_run_single_swarm)一起就是全新 thread-local → get_current_tenant() 静默回落 'default' →
租户 A 的密旨触发的蜂群在 default 读写 → 跨租户污染 + 每企业专项进化归零,日志全绿看不出。

三件事钉死:
1. 记录漏洞真实存在:裸 threading.Thread 里 get_current_tenant() 读到 'default' 而非父线程租户。
2. with_tenant 修好它:包装后的 target 在子线程里读到父线程捕获的租户。
3. SwarmOrchestrator 两处 spawn 点都过 with_tenant(源码断言,防有人新加第三个裸 spawn)。
"""

import threading
from pathlib import Path

from src.tenant import get_current_tenant, tenant_context, with_tenant


def _read_tenant_in_thread(target_wrapper):
    """在子线程里读租户,返回读到的值。target_wrapper 决定裸起还是 with_tenant 包装。"""
    box: dict[str, str] = {}

    def _job():
        box["seen"] = get_current_tenant()

    t = threading.Thread(target=target_wrapper(_job))
    t.start()
    t.join()
    return box["seen"]


def test_bare_thread_loses_tenant():
    """漏洞现状 characterization:父线程在租户A,裸子线程读到 'default'——thread-local 不传播。"""
    with tenant_context("tenant_a"):
        seen = _read_tenant_in_thread(lambda job: job)  # 裸起,不包装
    assert (
        seen == "default"
    ), "若这里不是 default,说明 threading.local 语义变了,更新本测试"


def test_with_tenant_propagates():
    """with_tenant 修复:父线程在租户A,包装后的子线程读到 'tenant_a'。"""
    with tenant_context("tenant_a"):
        seen = _read_tenant_in_thread(with_tenant)
    assert seen == "tenant_a", "with_tenant 未把父线程租户带进子线程"


def test_with_tenant_explicit_slug():
    """显式指定 slug 覆盖捕获值。"""
    seen = _read_tenant_in_thread(lambda job: with_tenant(job, tenant_slug="tenant_b"))
    assert seen == "tenant_b"


def test_orchestrator_spawns_wrap_tenant():
    """源码断言:SwarmOrchestrator 两处 threading.Thread 起 _run_single_swarm 都过 with_tenant。

    防回归:任何人新加一个裸 target=self._run_single_swarm 的 spawn 都会让本测试红。
    """
    src = Path("src/swarm_orchestrator.py").read_text(encoding="utf-8")
    # 每个把 _run_single_swarm 当 thread target 的地方,必须是 with_tenant(self._run_single_swarm)
    bare = "target=self._run_single_swarm"
    wrapped = "target=with_tenant(self._run_single_swarm)"
    assert bare not in src, f"发现裸 spawn(未过 with_tenant):{bare} —— 租户会落 default"
    assert src.count(wrapped) >= 2, "两处 spawn 点应都用 with_tenant 包装"


def test_threadpool_worker_propagates_with_tenant():
    """ThreadPoolExecutor 池 worker 也不继承 threading.local —— with_tenant 包装后携带父线程租户。

    会审 CRITICAL:flow_engine 的并行步/DAG/spawn 池 worker 曾裸起塌回 default,跨租户串味。
    """
    import concurrent.futures

    def _read():
        return get_current_tenant()

    with tenant_context("tenant_a"):
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
            bare = ex.submit(_read).result()
            wrapped = ex.submit(with_tenant(_read)).result()
    assert bare == "default", "裸池 worker 应塌回 default(证明漏洞)"
    assert wrapped == "tenant_a", "with_tenant 包装的池 worker 应带父线程租户"


def test_flow_engine_parallel_submits_wrap_tenant():
    """源码断言:flow_engine 三处 ThreadPoolExecutor.submit 起 _run_* 都过 with_tenant。

    防回归:谁新加裸 executor.submit(_run_parallel_step/_run_dag_par_step/_run_one) 当场红。
    """
    src = Path("src/flow_engine.py").read_text(encoding="utf-8")
    for fn in ("_run_one", "_run_parallel_step", "_run_dag_par_step"):
        assert (
            f"executor.submit({fn}," not in src
        ), f"发现裸 submit({fn}):租户会落 default"
        assert f"with_tenant({fn})" in src, f"{fn} 未过 with_tenant 包装"


def test_auto_curate_tags_tenant():
    """源码断言:flow_engine _auto_curate 写 RAG 打了 tenant_id(否则真实运行内容全租户可读)。"""
    src = Path("src/flow_engine.py").read_text(encoding="utf-8")
    assert (
        '"tenant_id": get_current_tenant()' in src
    ), "_auto_curate meta 未打 tenant_id"


def test_web_router_spawns_wrap_tenant():
    """源码断言:web/routers 所有 threading.Thread spawn 都过 with_tenant(第三个漏修点)。

    第0步a修了 swarm_orchestrator/flow_engine,但 web 层 8 处请求 handler 里的裸
    threading.Thread(target=_run) 同样丢租户——请求线程 set_current_tenant 后,
    后台线程全新 thread-local 塌回 default,整条编排(含租户 overlay/draft 地板)串味。
    防回归:web/routers 下任何 target= 不带 with_tenant( 的 Thread spawn 当场红。
    """
    import re

    offenders = []
    for path in Path("web/routers").glob("*.py"):
        src = path.read_text(encoding="utf-8")
        for m in re.finditer(r"Thread\(\s*target\s*=\s*([^\n,]+)", src):
            target = m.group(1).strip()
            if not target.startswith("with_tenant("):
                offenders.append(f"{path.name}: target={target}")
    assert not offenders, f"发现裸 thread spawn(租户会落 default): {offenders}"
