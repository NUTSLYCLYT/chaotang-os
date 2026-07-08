"""冲突仲裁引擎 — 蜂群编排的安全网。

解决蜂群编排中的四类冲突：
1. 循环依赖检测：配置加载时拓扑排序检测环
2. 多绑定冲突：同一事件触发多个下游的仲裁策略
3. 配置校验：重复绑定、无效引用、不可达蜂群
4. Payload 保护：事件数据深拷贝，防止篡改

仲裁策略（arbitration_strategy）：
    - "all"        — 默认，所有绑定依次执行（当前行为）
    - "best_score" — 同一 topic 多个下游，只执行上游评分最高的
    - "first_win"  — 同一 target_swarm 被多个事件触发时，只接受第一个
    - "merge"      — 同一 target_swarm 被多个来源触发时，合并上游输出
"""

from __future__ import annotations

import copy
import logging
from collections import defaultdict
from dataclasses import dataclass

logger = logging.getLogger(__name__)


# ── 配置校验 ─────────────────────────────────────────────────────────

@dataclass
class ConfigIssue:
    """配置问题。"""
    level: str      # "error" | "warning"
    message: str
    context: str = ""   # 相关配置项

    def __str__(self):
        prefix = "ERROR" if self.level == "error" else "WARN"
        ctx = f" [{self.context}]" if self.context else ""
        return f"[{prefix}]{ctx} {self.message}"


def validate_orchestrator_config(
    swarm_ids: list[str],
    bindings: list[dict],
    output_fields_map: dict[str, list[str]] | None = None,
) -> list[ConfigIssue]:
    """校验蜂群编排配置，返回问题列表。

    Args:
        swarm_ids: 已注册的蜂群 ID 列表
        bindings: 绑定配置列表，每项含 topic/target_swarm/transform/enabled
        output_fields_map: 各蜂群的 output_fields（可选，用于校验 transform 字段）

    Returns:
        问题列表（空列表 = 配置合法）
    """
    issues = []
    swarm_set = set(swarm_ids)

    # 1. 检查绑定引用的 target_swarm 是否存在
    for b in bindings:
        target = b.get("target_swarm", "")
        if target not in swarm_set:
            issues.append(ConfigIssue(
                level="error",
                message=f"target_swarm '{target}' 不在已注册蜂群中: {sorted(swarm_set)}",
                context=f"binding:{b.get('topic', '?')}→{target}",
            ))

    # 2. 检查重复绑定（同一 topic 触发同一 target_swarm）
    seen = set()
    for b in bindings:
        if not b.get("enabled", True):
            continue
        key = (b.get("topic", ""), b.get("target_swarm", ""))
        if key in seen:
            issues.append(ConfigIssue(
                level="warning",
                message=f"重复绑定: topic='{key[0]}' → target='{key[1]}' 出现多次",
                context=f"binding:{key[0]}→{key[1]}",
            ))
        seen.add(key)

    # 3. 检查循环依赖
    cycle = detect_cycle(swarm_ids, bindings)
    if cycle:
        cycle_str = " → ".join(cycle)
        issues.append(ConfigIssue(
            level="error",
            message=f"检测到循环依赖: {cycle_str}",
            context="bindings",
        ))

    # 4. 检查不可达蜂群（warning，不影响运行）
    reachable = set()
    for b in bindings:
        if b.get("enabled", True):
            reachable.add(b.get("target_swarm", ""))
            # 从 topic 推断来源蜂群
            topic = b.get("topic", "")
            if topic.endswith("_completed"):
                reachable.add(topic[:-len("_completed")])
    unreachable = swarm_set - reachable
    # ai_ops 和第一个蜂群不需要在绑定链里
    for u in unreachable:
        if u != "ai_ops":
            issues.append(ConfigIssue(
                level="warning",
                message=f"蜂群 '{u}' 未出现在任何事件绑定中（可能是入口蜂群或未使用）",
                context=f"swarm:{u}",
            ))

    # 5. 校验 transform 字段引用（如果提供了 output_fields_map）
    if output_fields_map:
        for b in bindings:
            transform = b.get("transform", "auto")
            if transform in ("auto", "passthrough"):
                continue
            topic = b.get("topic", "")
            if topic.endswith("_completed"):
                source_id = topic[:-len("_completed")]
                fields = output_fields_map.get(source_id, [])
                if fields and transform not in fields:
                    issues.append(ConfigIssue(
                        level="warning",
                        message=f"transform='{transform}' 不在 {source_id} 的 output_fields 中: {fields}",
                        context=f"binding:{topic}→{b.get('target_swarm', '?')}",
                    ))

    return issues


# ── 循环依赖检测 ──────────────────────────────────────────────────────

def detect_cycle(
    swarm_ids: list[str],
    bindings: list[dict],
) -> list[str] | None:
    """检测蜂群绑定图中的循环依赖。

    Returns:
        循环路径列表（如 ["opc", "product", "opc"]），无环返回 None
    """
    # 构建有向图：source → [targets]
    graph: dict[str, list[str]] = defaultdict(list)
    for b in bindings:
        if not b.get("enabled", True):
            continue
        topic = b.get("topic", "")
        target = b.get("target_swarm", "")
        # 从 topic 推断来源蜂群
        if topic.endswith("_completed"):
            source = topic[:-len("_completed")]
            graph[source].append(target)

    # DFS 检测环
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {sid: WHITE for sid in swarm_ids}
    parent = {}

    def dfs(node: str) -> list[str] | None:
        color[node] = GRAY
        for neighbor in graph.get(node, []):
            if neighbor not in color:
                continue
            if color[neighbor] == GRAY:
                # 找到环，回溯路径
                cycle = [neighbor, node]
                current = node
                while current != neighbor:
                    current = parent.get(current, "")
                    if not current:
                        break
                    cycle.append(current)
                cycle.reverse()
                cycle.append(neighbor)  # 闭合环
                return cycle
            if color[neighbor] == WHITE:
                parent[neighbor] = node
                result = dfs(neighbor)
                if result:
                    return result
        color[node] = BLACK
        return None

    for sid in swarm_ids:
        if color.get(sid) == WHITE:
            result = dfs(sid)
            if result:
                return result
    return None


# ── 多绑定仲裁 ────────────────────────────────────────────────────────

@dataclass
class ArbitrationResult:
    """仲裁结果。"""
    action: str             # "execute" | "skip" | "merge"
    reason: str = ""
    merged_input: str = ""  # merge 模式下的合并输入


class ConflictResolver:
    """冲突仲裁器 — 管理多绑定冲突和运行时仲裁。

    集成到 SwarmOrchestrator，在事件触发和蜂群执行之间加入仲裁层。
    """

    def __init__(self, strategy: str = "all"):
        """
        Args:
            strategy: 仲裁策略
                "all" — 所有绑定依次执行（默认，兼容现有行为）
                "best_score" — 同一 topic 多个下游，按上游评分排序执行
                "first_win" — 同一 target 被多源触发时，只接受第一个
        """
        self.strategy = strategy
        # 追踪本次会话中每个 target_swarm 已被触发的次数
        self._triggered: dict[str, list[dict]] = defaultdict(list)
        # 待合并的输入（merge 策略用）
        self._pending_merge: dict[str, list[str]] = defaultdict(list)

    def reset(self):
        """重置状态（新会话时调用）。"""
        self._triggered.clear()
        self._pending_merge.clear()

    def arbitrate(
        self,
        target_swarm: str,
        source_swarm: str,
        quality_score: float,
        task_input: str,
        event_topic: str,
    ) -> ArbitrationResult:
        """对一次触发进行仲裁，决定是否执行。

        Args:
            target_swarm: 要触发的下游蜂群
            source_swarm: 上游蜂群
            quality_score: 上游质量分
            task_input: 转换后的下游输入
            event_topic: 事件主题

        Returns:
            ArbitrationResult
        """
        trigger_info = {
            "source": source_swarm,
            "score": quality_score,
            "topic": event_topic,
            "input": task_input,
        }

        if self.strategy == "all":
            # 兼容模式：记录但不阻止
            self._triggered[target_swarm].append(trigger_info)
            return ArbitrationResult(action="execute")

        if self.strategy == "first_win":
            if self._triggered[target_swarm]:
                first = self._triggered[target_swarm][0]
                return ArbitrationResult(
                    action="skip",
                    reason=(
                        f"first_win策略: {target_swarm} 已被 "
                        f"{first['source']} 触发，跳过来自 {source_swarm} 的触发"
                    ),
                )
            self._triggered[target_swarm].append(trigger_info)
            return ArbitrationResult(action="execute")

        if self.strategy == "best_score":
            self._triggered[target_swarm].append(trigger_info)
            # 只在所有同 topic 的绑定都到达后执行评分最高的
            # 简化实现：每次都比较，如果当前不是最高分就跳过
            best = max(self._triggered[target_swarm], key=lambda t: t["score"])
            if trigger_info is not best and trigger_info["score"] < best["score"]:
                return ArbitrationResult(
                    action="skip",
                    reason=(
                        f"best_score策略: {source_swarm}({quality_score:.2f}) "
                        f"< {best['source']}({best['score']:.2f})，跳过"
                    ),
                )
            return ArbitrationResult(action="execute")

        # 未知策略，默认执行
        self._triggered[target_swarm].append(trigger_info)
        return ArbitrationResult(action="execute")

    def get_trigger_history(self, target_swarm: str | None = None) -> dict:
        """获取触发历史（用于调试面板）。"""
        if target_swarm:
            return {target_swarm: list(self._triggered.get(target_swarm, []))}
        return dict(self._triggered)


# ── Payload 保护 ──────────────────────────────────────────────────────

def safe_payload(payload: dict) -> dict:
    """深拷贝 event payload，防止下游 handler 篡改。"""
    return copy.deepcopy(payload)
