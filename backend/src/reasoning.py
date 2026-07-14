"""ReAct 推理策略模块。

核心思路：让 Agent 在生成最终答案前，可以主动读取前序步骤的完整输出。
Observe 阶段从 StepLog 文件读取（不受 WorkingMemory 压缩影响），
形成自我引用的推理轨迹，每轮 T/A/O 写入 metadata 供断点续跑使用。

ReAct 对话格式::

    Thought: 我需要先确认研发负责人提出的需求规格...
    Action: read_step | pack_rd_leader

    收到 Observation 后继续：

    Thought: 已知需求，现在生成 BMS 硬件方案...
    Action: answer | [最终输出内容]

可配置项（step 级）::

    reasoning_strategy: react
    max_react_steps: 5      # 最多几轮 T/A/O（默认 5）

集成点：
- flow_engine.py: _execute_step 检测 reasoning_strategy == "react"
- step_log.py:    Observe 阶段读 runs/{run_id}/step_*.json（已保存的前序步骤）
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

from src.step_log import get_run_dir

logger = logging.getLogger(__name__)

_THOUGHT_RE = re.compile(r"Thought\s*[：:]\s*(.+?)(?=\nAction\s*[：:]|\Z)", re.DOTALL)
_ACTION_RE = re.compile(r"Action\s*[：:]\s*(\w+)\s*[|｜]\s*(.+?)(?=\nThought\s*[：:]|\Z)", re.DOTALL)
_ANSWER_RE = re.compile(r"Action\s*[：:]\s*answer\s*[|｜]\s*(.+)", re.DOTALL | re.IGNORECASE)


@dataclass
class ReactTurn:
    thought: str
    action: str   # "read_step" | "answer"
    action_input: str
    observation: str = ""


@dataclass
class ReactTrace:
    turns: list[ReactTurn] = field(default_factory=list)
    final_answer: str | None = ""
    stop_reason: str = ""  # "answer" | "max_steps_exceeded" | "model_error"

    def to_dict(self) -> list[dict]:
        return [
            {
                "thought": t.thought,
                "action": t.action,
                "action_input": t.action_input,
                "observation": t.observation[:500] + ("…" if len(t.observation) > 500 else ""),
            }
            for t in self.turns
        ]


def _read_step_from_disk(run_id: str, step_id: str) -> str:
    """从 StepLog 文件读取指定步骤的完整输出。

    绕过 WorkingMemory 的压缩，拿到原始未截断内容。
    这是 ReAct Observe 阶段与 StepLog 自我引用的核心。
    """
    run_dir = get_run_dir(run_id)
    if run_dir is None:
        return f"[ERROR] run {run_id} 不存在"

    # 查找 step_*_{step_id}.json（不依赖 step_index，支持 DAG 乱序）
    matches = list(run_dir.glob(f"step_*_{step_id}.json"))
    if not matches:
        available = [f.stem.split("_", 2)[-1] for f in sorted(run_dir.glob("step_*.json"))]
        return f"[ERROR] 未找到 step_id={step_id}。当前 run 中可用的步骤：{available}"

    import json
    data = json.loads(matches[0].read_text(encoding="utf-8"))
    output = data.get("output", "")
    agent_name = data.get("agent_name", step_id)
    return f"[{agent_name} 的完整输出]\n\n{output}"


def _parse_react_output(text: str) -> tuple[str, str, str]:
    """从模型输出中解析 (thought, action, action_input)。

    Returns:
        (thought, action_type, action_input)
        action_type 为 "read_step" | "answer" | "unknown"
    """
    # 优先匹配 answer（终止动作）
    ans_match = _ANSWER_RE.search(text)
    if ans_match:
        thought_match = _THOUGHT_RE.search(text)
        thought = thought_match.group(1).strip() if thought_match else ""
        return thought, "answer", ans_match.group(1).strip()

    action_match = _ACTION_RE.search(text)
    thought_match = _THOUGHT_RE.search(text)

    thought = thought_match.group(1).strip() if thought_match else text[:200]
    if action_match:
        action_type = action_match.group(1).strip().lower()
        action_input = action_match.group(2).strip()
        return thought, action_type, action_input

    # 解析失败：把整段输出当作最终答案（容错）
    return text[:100], "answer", text


def _build_react_system_prompt(
    base_prompt: str,
    available_steps: list[dict],
    lessons: list[str] | None = None,
) -> str:
    """在原始系统提示词前插入 ReAct 格式说明，并在末尾注入历史失败教训。

    lessons: 由 FailureMemory.retrieve() 返回的自然语言教训列表，
             为空或 None 时不插入，等价于没有 Reflexion（冷启动期行为不变）。
    """
    step_list = "\n".join(
        f"  - {s['step']} ({s['agent_name']})" for s in available_steps
    ) or "  （暂无前序步骤）"

    react_header = f"""## ReAct 工作模式

你按照 Thought → Action → Observation 的循环生成输出，直到获得足够信息后用 Action: answer 给出最终结论。

**格式规范（严格遵守）**::

    Thought: [你的推理过程]
    Action: read_step | [step_id]

    或

    Thought: [你已有足够信息，给出结论]
    Action: answer | [最终完整输出]

**可用步骤（read_step 的合法 step_id）**：
{step_list}

**规则**：
1. 每次只输出一个 Thought + 一个 Action，等待 Observation 后再继续
2. read_step 返回该步骤的完整未压缩输出
3. 最终答案（answer）必须满足你的角色输出规范，不可省略
4. 不要重复读取同一个步骤超过 2 次

---

{base_prompt}"""

    # Reflexion 注入：将历史失败教训追加到系统提示末尾作为 few-shot 警示
    # 冷启动期（无历史记录）lessons 为空列表，直接跳过，零副作用
    if lessons:
        lesson_lines = "\n".join(f"{i}. {lesson}" for i, lesson in enumerate(lessons, 1))
        react_header += f"""

---

## 历史失败教训（请务必参考，避免重蹈覆辙）

以下是同类任务历史执行中总结的失败原因与改进建议：

{lesson_lines}

请在推理过程中主动规避上述已知问题。"""

    return react_header


class ReActEngine:
    """ReAct 推理引擎。

    每次 run() 对应一个 Step 的执行，在原有 Agent.run() 之上叠加多轮推理循环。
    """

    DEFAULT_MAX_STEPS = 5

    def run(
        self,
        agent,
        rendered_context: str,
        run_id: str,
        context_steps: list[dict],
        max_steps: int | None = None,
        model: str | None = None,
        api_base: str | None = None,
        api_key: str | None = None,
        failure_memory=None,
        task_input: str = "",
        flow_name: str = "",
    ) -> ReactTrace:
        """执行 ReAct 循环。

        Args:
            agent:           Agent 实例（提供 system_prompt 和 adapter）
            rendered_context: 已渲染的用户侧上下文（任务输入 + 前序步骤摘要）
            run_id:          当前 run_id，用于从磁盘读取完整 StepLog
            context_steps:   context["steps"]（用于构建可用步骤列表）
            max_steps:       最大循环轮数（默认 5）
            model/api_base/api_key: 模型覆盖参数
            failure_memory:  FailureMemory 实例（可选），用于 Reflexion 教训检索
            task_input:      当前任务输入文本，用于语义相似度检索
            flow_name:       当前 flow 名称，用于按 flow 分区检索教训

        Returns:
            ReactTrace（含 final_answer 和完整 turns）
        """
        _max = max_steps or self.DEFAULT_MAX_STEPS
        trace = ReactTrace()

        # Reflexion：在构建系统提示前检索历史失败教训
        # 冷启动期（无记录）retrieve() 返回 []，lessons 为空，_build_react_system_prompt 直接跳过注入
        lessons: list[str] = []
        if failure_memory is not None and task_input and flow_name:
            try:
                lessons = failure_memory.retrieve(task_input, flow_name, n=3)
                if lessons:
                    logger.info(
                        "ReAct [%s] Reflexion: 检索到 %d 条历史失败教训，注入系统提示",
                        agent.step_id, len(lessons),
                    )
            except Exception as _exc:
                logger.warning("ReAct [%s] Reflexion 检索失败（不影响执行）: %s", agent.step_id, _exc)

        react_system_prompt = _build_react_system_prompt(
            agent.system_prompt, context_steps, lessons=lessons
        )

        # 多轮对话历史（ReAct 轮次内累积）
        messages: list[dict] = [
            {"role": "system", "content": react_system_prompt},
            {"role": "user", "content": rendered_context},
        ]

        actual_model = model or agent.model
        actual_api_base = api_base or agent.api_base
        actual_api_key = api_key or agent.api_key

        for step_num in range(1, _max + 1):
            logger.debug("ReAct [%s] 第 %d 轮", agent.step_id, step_num)

            # 调用模型生成 Thought + Action
            result = agent.adapter.call(
                system_prompt=react_system_prompt,
                user_prompt="",  # 多轮模式下由 messages 参数传递，此参数不使用
                model=actual_model,
                api_base=actual_api_base,
                api_key=actual_api_key,
                messages=messages,  # 完整多轮对话历史，保留 role 分离语义
            )

            if result["status"] != "success":
                trace.stop_reason = "model_error"
                trace.final_answer = result["output"]
                break

            raw_output = result["output"]
            thought, action_type, action_input = _parse_react_output(raw_output)

            if action_type == "answer":
                turn = ReactTurn(
                    thought=thought,
                    action="answer",
                    action_input=action_input,
                    observation="",
                )
                trace.turns.append(turn)
                trace.final_answer = action_input
                trace.stop_reason = "answer"
                logger.info(
                    "ReAct [%s] 第 %d 轮 → answer，最终输出 %d 字",
                    agent.step_id, step_num, len(action_input),
                )
                break

            elif action_type == "read_step":
                step_id_to_read = action_input.strip()
                observation = _read_step_from_disk(run_id, step_id_to_read)
                logger.info(
                    "ReAct [%s] 第 %d 轮 → read_step(%s)，得到 %d 字",
                    agent.step_id, step_num, step_id_to_read, len(observation),
                )
            else:
                observation = f"[未知 Action: {action_type}，忽略，请改用 read_step 或 answer]"
                logger.warning("ReAct [%s]: 未知 action_type=%s", agent.step_id, action_type)

            turn = ReactTurn(
                thought=thought,
                action=action_type,
                action_input=action_input,
                observation=observation,
            )
            trace.turns.append(turn)

            # 将本轮 T/A/O 追加到对话历史
            messages.append({"role": "assistant", "content": raw_output})
            messages.append({
                "role": "user",
                "content": f"Observation: {observation[:3000]}",
            })

        else:
            # 达到 max_steps 但没有 answer
            trace.stop_reason = "max_steps_exceeded"
            if trace.turns:
                last_turn = trace.turns[-1]
                if last_turn.action == "answer":
                    # 正常路径：最后一轮恰好是 answer（理论上不会走到 else，但保险）
                    trace.final_answer = last_turn.action_input
                elif last_turn.action == "read_step" and last_turn.observation:
                    # 最后一步是读取步骤且有观察结果：以 observation 作为内容兜底
                    # 观察内容虽非完整答案，但比 step_id 字符串更有意义
                    trace.final_answer = last_turn.observation
                else:
                    # 无法兜底：清空 final_answer 让外层 output_linter 校验失败，
                    # 触发 lint 重试或 repair_cycle，而非静默传入一个无效字符串
                    trace.final_answer = None
            else:
                trace.final_answer = None
            logger.warning(
                "ReAct [%s] 达到最大步数 %d，stop_reason=max_steps_exceeded，"
                "final_answer=%s",
                agent.step_id, _max,
                "None（触发 linter）" if trace.final_answer is None else f"{len(trace.final_answer)} 字",
            )

        return trace


def _messages_to_text(messages: list[dict]) -> str:
    """把多轮对话历史拼成单个字符串（已弃用，保留供调试用）。

    ReActEngine 现在通过 messages 参数直接传递多轮历史，
    此函数不再在主路径中使用。
    """
    parts: list[str] = []
    for msg in messages:
        role = msg["role"]
        content = msg["content"]
        if role == "user":
            parts.append(content)
        elif role == "assistant":
            parts.append(f"[Assistant]: {content}")
    return "\n\n".join(parts)
