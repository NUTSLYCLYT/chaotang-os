"""CriticStep: 红蓝对抗质疑机制。

解决问题：
- 做完就完，不追问"真的做对了吗？"
- QA 只评分，不主动质疑
- 缺乏对抗性检查（并发、边界、幂等）

设计参考：
- cc_src Verification Agent: 专门"想办法搞崩它"
- 强制要求至少一个 adversarial probe

核心 prompt 片段（来自 cc_src）：
  "You are a verification specialist. Your job is not to confirm 
   the implementation works — it's to try to break it.
   The first 80% is the easy part. Your entire value is in finding 
   the last 20%."

集成点：
- flow_engine.py 在 QA 步骤后执行 critic
- 如果 critic 输出 CHALLENGE 且 SEVERITY=high → 触发修复或人工确认

配置方式：
- 在 flow YAML 中添加 critic 步骤
- 或在 repair 配置中启用 critic_before_repair
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

CRITIC_SYSTEM_PROMPT = """你是质疑专家。你的任务不是确认"做完了"，而是质疑"真的做对了吗？"

你有两个常见的失败模式，必须警惕：
1. 验证逃避：找理由不质疑，读输出、写"没问题"、跳过
2. 被 80% 诱惑：看到输出完整、格式正确就觉得 OK，没发现数据矛盾、逻辑漏洞、需求偏差

前 80% 是容易的部分。你的价值在于找出后 20%。

=== 检查维度 ===

1. **需求匹配**：用户要 A，你给了 B？
   - 检查原始 task_input 和最终输出是否一致
   - 是否遗漏关键需求？
   - 是否添加了用户没要求的内容？

2. **数据一致性**：数字前后矛盾？
   - 前面说 100万，后面变 80万？
   - 价格单位是否统一（万元/元）？
   - 参数是否在合理范围？

3. **逻辑漏洞**：方案自相矛盾？
   - 技术参数和商业参数冲突？
   - 时间线不合理？
   - 资源分配矛盾？

4. **遗漏检查**：边界情况、异常处理？
   - 极端工况考虑了吗？
   - 失败路径有方案吗？
   - 兼容性问题？

=== 输出格式 ===

每个质疑点必须遵循此格式：

```
### 质疑：[质疑点标题]
**证据来源：**
  [引用前序步骤的具体输出，包含步骤ID和内容片段]
**问题描述：**
  [具体描述问题，不要笼统]
**严重程度：** high / medium / low
```

如果没有找到问题，输出：
```
NO_CHALLENGE
理由：[简要说明检查了哪些维度，为什么没有问题]
```

=== 强制要求 ===

你必须至少质疑一个点，即使最终判定是"可接受的"。
如果所有检查都是"格式正确"、"输出完整"，你只是确认了 80%，没有质疑。
回去再找问题。

记住：你的价值在于找出后 20%，不是确认前 80%。
"""

CRITIC_USER_PROMPT_TEMPLATE = """请对以下 Flow 输出进行质疑检查。

## 原始需求
{task_input}

## 各步骤输出摘要
{steps_summary}

## QA 评分
- 总分：{total_score}
- 各维度：{dimension_scores}

## 质疑任务
按上述维度检查，找出至少一个质疑点。如果没有问题，必须说明检查了哪些维度。
"""


@dataclass
class CriticResult:
    """质疑检查结果。"""
    
    has_challenge: bool = False
    challenges: list[dict] = field(default_factory=list)
    verdict: str = "NO_CHALLENGE"
    checked_dimensions: list[str] = field(default_factory=list)
    
    def to_dict(self) -> dict:
        return {
            "has_challenge": self.has_challenge,
            "challenges": self.challenges,
            "verdict": self.verdict,
            "checked_dimensions": self.checked_dimensions,
        }
    
    def get_high_severity_challenges(self) -> list[dict]:
        return [c for c in self.challenges if c.get("severity") == "high"]
    
    def should_trigger_repair(self) -> bool:
        return len(self.get_high_severity_challenges()) > 0


def parse_critic_output(output: str) -> CriticResult:
    """解析 Critic 输出，提取质疑点。"""
    result = CriticResult()
    
    if "NO_CHALLENGE" in output:
        result.verdict = "NO_CHALLENGE"
        result.has_challenge = False
        
        if "理由：" in output or "检查了" in output:
            lines = output.splitlines()
            for line in lines:
                if "检查了" in line or "维度" in line:
                    dim = line.split("：")[-1].strip() if "：" in line else line.strip()
                    result.checked_dimensions.append(dim)
        return result
    
    challenges = []
    current_challenge = {}
    
    lines = output.splitlines()
    for line in lines:
        line = line.strip()
        
        if line.startswith("### 质疑："):
            if current_challenge:
                challenges.append(current_challenge)
            current_challenge = {"title": line.replace("### 质疑：", "").strip()}
        
        elif line.startswith("**证据来源：**"):
            current_challenge["evidence"] = []
        
        elif line.startswith("  ") and current_challenge.get("evidence") is not None:
            current_challenge["evidence"].append(line.strip())
        
        elif line.startswith("**问题描述：**"):
            current_challenge["description"] = ""
        
        elif line.startswith("  ") and current_challenge.get("description") is not None:
            current_challenge["description"] = line.strip()
        
        elif line.startswith("**严重程度：**"):
            severity = line.replace("**严重程度：**", "").strip().lower()
            current_challenge["severity"] = severity if severity in ("high", "medium", "low") else "medium"
            challenges.append(current_challenge)
            current_challenge = {}
    
    if current_challenge:
        challenges.append(current_challenge)
    
    result.challenges = challenges
    result.has_challenge = len(challenges) > 0
    result.verdict = "CHALLENGE" if result.has_challenge else "NO_CHALLENGE"
    
    return result


def build_critic_prompt(
    task_input: str,
    steps_summary: str,
    qa_result: dict,
) -> tuple[str, str]:
    """构建 Critic 的 system + user prompt。
    
    Args:
        task_input: 原始用户需求
        steps_summary: 各步骤输出摘要（已格式化）
        qa_result: QA 评分结果
    
    Returns:
        (system_prompt, user_prompt)
    """
    total_score = qa_result.get("total_score", 0)
    dimension_scores = qa_result.get("scores", {})
    
    scores_text = ", ".join(
        f"{k}: {v:.1f}" for k, v in dimension_scores.items()
    ) if dimension_scores else f"总分: {total_score:.1f}"
    
    user_prompt = CRITIC_USER_PROMPT_TEMPLATE.format(
        task_input=task_input,
        steps_summary=steps_summary,
        total_score=f"{total_score:.1f}",
        dimension_scores=scores_text,
    )
    
    return CRITIC_SYSTEM_PROMPT, user_prompt


def should_run_critic(flow_config: dict, qa_result: dict) -> bool:
    """判断是否需要运行 Critic。
    
    条件：
    1. Flow 配置了 critic 步骤
    2. QA 分数 < 4.5（不是完美）
    3. 或 repair 配置了 critic_before_repair
    
    Args:
        flow_config: Flow YAML 配置
        qa_result: QA 评分结果
    
    Returns:
        是否需要运行 Critic
    """
    repair_config = flow_config.get("repair", {})
    if repair_config.get("critic_before_repair", False):
        return True
    
    steps = flow_config.get("steps", [])
    has_critic_step = any(
        s.get("agent") == "critic" or s.get("id") == "critic_challenge"
        for s in steps
    )
    
    if has_critic_step:
        return True
    
    total_score = qa_result.get("total_score", 0)
    if total_score < 4.5:
        return True
    
    return False


def get_critic_step_config() -> dict:
    """获取默认的 Critic 步骤配置。"""
    return {
        "id": "critic_challenge",
        "agent": "critic",
        "model": "openai/GLM-4-flash",
        "prompt_key": "critic",
        "tools": [],
        "description": "红蓝对抗质疑检查",
        "optional": True,
    }


STEP_CRITIC_SYSTEM_PROMPT = """你是{agent_name}的质疑专家。你的任务是对该步骤的输出进行针对性质疑。

你有两个常见的失败模式，必须警惕：
1. 验证逃避：找理由不质疑，读输出、写"没问题"、跳过
2. 被 80% 诱惑：看到输出完整、格式正确就觉得 OK，没发现数据矛盾、逻辑漏洞、需求偏差

前 80% 是容易的部分。你的价值在于找出后 20%。

=== 检查维度 ===

1. **需求匹配**：用户要 A，这一步给了 B？
   - 检查原始 task_input 和本步骤输出是否一致
   - 是否遗漏关键需求？
   - 是否添加了用户没要求的内容？

2. **数据一致性**：数字前后矛盾？
   - 前面说 100万，后面变 80万？
   - 价格单位是否统一（万元/元）？
   - 参数是否在合理范围？

3. **逻辑漏洞**：方案自相矛盾？
   - 技术参数和商业参数冲突？
   - 时间线不合理？
   - 资源分配矛盾？

4. **遗漏检查**：边界情况、异常处理？
   - 极端工况考虑了吗？
   - 失败路径有方案吗？
   - 兼容性问题？

=== 输出格式 ===

每个质疑点必须遵循此格式：

```
### 质疑：[质疑点标题]
**证据来源：**
  [引用本步骤的具体输出片段]
**问题描述：**
  [具体描述问题，不要笼统]
**严重程度：** high / medium / low
```

如果没有找到问题，输出：
```
NO_CHALLENGE
理由：[简要说明检查了哪些维度，为什么没有问题]
```

记住：你的价值在于找出后 20%，不是确认前 80%。
"""

STEP_CRITIC_USER_TEMPLATE = """请对 {agent_name} 的输出进行质疑检查。

## 原始需求
{task_input}

## 前序步骤输出摘要
{context_summary}

## 本步骤输出
{step_output}

## 质疑任务
按上述维度检查，找出至少一个质疑点。如果没有问题，必须说明检查了哪些维度。
"""


def run_step_critic(
    step_id: str,
    agent_name: str,
    step_output: str,
    task_input: str,
    context: dict,
    model: str = "openai/GLM-4-flash",
    tenant_id: str = "default",
    user_preferences: list[str] | None = None,
) -> CriticResult | None:
    """执行单步 Critic 检查（分层质疑）。
    
    Args:
        step_id: 步骤 ID
        agent_name: Agent 名称
        step_output: 本步骤输出
        task_input: 原始任务输入
        context: 上下文（含前序步骤）
        model: 使用的模型
        tenant_id: 租户 ID（用于用户偏好记忆）
        user_preferences: 用户偏好列表（从 typed_memory 注入）
    
    Returns:
        CriticResult 或 None（执行失败时）
    """
    context_summary = ""
    if context.get("steps"):
        context_summary = "\n\n".join(
            f"### {s.get('step', 'unknown')} ({s.get('agent_name', 'unknown')})\n"
            f"{s.get('output', '')[:300]}..."
            for s in context["steps"][-3:]
        )
    
    prefs_instruction = ""
    if user_preferences:
        prefs_instruction = f"""
=== 用户已确认的偏好（不要质疑这些） ===

用户已在之前的交互中明确接受以下设计选择，不要将其标记为问题：
{chr(10).join(f"- {p}" for p in user_preferences)}

如果发现的问题属于上述偏好范围，请降低严重度为 low 或跳过。
"""
    
    sys_prompt = STEP_CRITIC_SYSTEM_PROMPT.format(agent_name=agent_name)
    if prefs_instruction:
        sys_prompt += prefs_instruction
    
    user_prompt = STEP_CRITIC_USER_TEMPLATE.format(
        agent_name=agent_name,
        task_input=task_input,
        context_summary=context_summary or "(无前序步骤)",
        step_output=step_output[:2000],
    )
    
    try:
        from src.model_adapter import ModelAdapter
        adapter = ModelAdapter()
        result = adapter.call(
            system_prompt=sys_prompt,
            user_prompt=user_prompt,
            model=model,
            temperature=0.3,
            max_tokens=1500,
        )
        
        if result.get("status") != "success":
            logger.warning("Step Critic 模型调用失败: %s", result.get("error"))
            return None
        
        output = result.get("output", "")
        critic_result = parse_critic_output(output)
        return critic_result
        
    except Exception as e:
        logger.warning("Step Critic 执行失败: %s", e)
        return None


def save_user_preference(
    tenant_id: str,
    preference: str,
    source_step: str,
    description: str = "",
) -> bool:
    """保存用户偏好到 typed_memory（user 类型）。
    
    当用户明确接受某个设计选择时调用，避免后续重复质疑。
    
    Args:
        tenant_id: 租户 ID
        preference: 偏好内容（如"接受三元电芯用于低温场景"）
        source_step: 来源步骤 ID
        description: 详细说明
    
    Returns:
        是否保存成功
    """
    try:
        from src.typed_memory import TypedMemoryStore
        store = TypedMemoryStore(tenant_id=tenant_id)
        
        name = f"偏好_{source_step}_{preference[:20]}"
        result = store.save(
            name=name,
            content=preference,
            type="user",
            description=f"用户确认的设计选择（来源: {source_step}）\n{description}",
            tags=["user_preference", "critic_accepted", source_step],
        )
        
        if result.get("ok"):
            logger.info("已保存用户偏好: %s", preference[:50])
            return True
        else:
            logger.warning("保存用户偏好失败: %s", result.get("error"))
            return False
            
    except Exception as e:
        logger.warning("保存用户偏好异常: %s", e)
        return False


def build_critic_feedback_prompt(critic_result: CriticResult) -> str:
    """构建 Critic 反馈提示，用于 retry 时注入上下文。
    
    Args:
        critic_result: Critic 检查结果
    
    Returns:
        格式化的反馈提示文本
    """
    if not critic_result.has_challenge:
        return ""
    
    feedback_lines = [
        "=== ⚠️ 质疑专家反馈 ===",
        "",
        "你的输出被质疑专家发现问题，请针对以下质疑点修正：",
        "",
    ]
    
    for i, challenge in enumerate(critic_result.challenges, 1):
        severity = challenge.get("severity", "medium")
        severity_icon = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(severity, "🟡")
        
        feedback_lines.append(f"### {severity_icon} 质疑点 {i} [{severity.upper()}]")
        
        if challenge.get("title"):
            feedback_lines.append(f"**标题**：{challenge['title']}")
        
        if challenge.get("aspect"):
            feedback_lines.append(f"**维度**：{challenge['aspect']}")
        
        if challenge.get("description"):
            feedback_lines.append(f"**问题**：{challenge['description']}")
        
        if challenge.get("evidence"):
            feedback_lines.append("**证据**：")
            for ev in challenge["evidence"]:
                feedback_lines.append(f"  - {ev}")
        
        feedback_lines.append("")
    
    feedback_lines.extend([
        "=== 修正要求 ===",
        "",
        "1. 仔细阅读每个质疑点",
        "2. 重新审视你的输出，找出问题根源",
        "3. 给出修正后的完整输出（不是增量，是完整输出）",
        "",
    ])
    
    return "\n".join(feedback_lines)


def load_user_preferences(tenant_id: str, user_id: str = "default", limit: int = 10) -> list[str]:
    """加载用户偏好列表（用于 critic 检查时排除）。
    
    优先从 UserPreference 加载已接受的设计选择，
    其次从 TypedMemory 加载 user 类型的偏好。
    
    Args:
        tenant_id: 租户 ID
        user_id: 用户 ID
        limit: 最大加载数量
    
    Returns:
        用户偏好内容列表
    """
    preferences = []
    
    try:
        from src.user_preference import UserPreference
        pref = UserPreference(user_id=user_id, tenant=tenant_id)
        accepted = pref.get_accepted_designs(limit=limit)
        preferences.extend(accepted)
    except Exception as e:
        logger.debug("从 UserPreference 加载偏好失败: %s", e)
    
    if len(preferences) < limit:
        try:
            from src.typed_memory import TypedMemoryStore
            store = TypedMemoryStore(tenant_id=tenant_id)
            
            hits = store.search(
                query="用户偏好 设计选择",
                type_filter="user",
                limit=limit - len(preferences),
            )
            
            for hit in hits:
                if "user_preference" in hit.header.tags:
                    preferences.append(hit.content)
        except Exception as e:
            logger.debug("从 TypedMemory 加载偏好失败: %s", e)
    
    return preferences[:limit]