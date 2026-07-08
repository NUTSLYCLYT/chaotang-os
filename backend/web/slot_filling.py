"""槽位填充辅助模块 — 4 类 Flow（requirements / medical / ops / appointment）。

从 web/app.py 抽出，保持行为完全一致。

槽位填充策略：
1. 每轮对话用 LLM 提取已说过的字段
2. 检查是否所有槽位都填满
3. 未填满 → LLM 生成"再问一个问题"的回复
4. 全填满 → 进入 FlowEngine 真正生成最终输出
"""
from __future__ import annotations

import json
import os

# ── 通用需求澄清 flow（flow_requirements）─────────────────

SLOT_ORDER = ["slot_users", "slot_pain", "slot_scope"]
SLOT_LABELS = {
    "slot_users": "目标用户群体",
    "slot_pain":  "核心痛点/困难",
    "slot_scope": "第一版核心功能",
}
SLOT_FLOWS = {"config/flow_requirements.yaml", "flow_requirements.yaml"}

SLOT_EXTRACT_SYSTEM = """你是一个信息提取助手。从对话历史中提取以下信息，只输出 JSON，不输出其他内容：
{
  "slot_users": "目标用户是谁（如：个人用户/企业员工/学生等），没有则为 null",
  "slot_pain": "用户遇到的具体困难或痛点，没有则为 null",
  "slot_scope": "第一版要做的核心功能，没有则为 null"
}
规则：只提取用户明确说过的内容，不要推断或补充，不确定的输出 null。"""

SLOT_CONV_SYSTEM = """你是一个需求澄清顾问，帮用户把模糊想法变成清晰需求。

当前还缺少以下信息（必须从用户口中获得，不能自己猜）：
{missing_info}

你的任务：根据对话上下文，用口语自然地追问其中一个缺失信息。
要求：
- 每次只问一个问题
- 语气自然友好，不用表格或模板
- 如果用户说了不相关的内容，先简短回应，再追问
- 绝对不要生成需求文档"""


# ── 医疗导诊 flow（flow_medical，3 个槽位）────────────────

MEDICAL_SLOT_ORDER = ["slot_symptom", "slot_duration", "slot_need"]
MEDICAL_SLOT_LABELS = {
    "slot_symptom":  "主要症状（哪里不舒服）",
    "slot_duration": "持续时间和严重程度",
    "slot_need":     "就医需求（挂号/咨询/查报告等）",
}
MEDICAL_SLOT_FLOWS = {"config/flow_medical.yaml", "flow_medical.yaml"}

MEDICAL_SLOT_EXTRACT_SYSTEM = """你是一个导诊信息提取助手。从患者的对话中提取以下信息，只输出 JSON，不输出其他内容：
{
  "slot_symptom": "患者明确描述的症状或不适部位，没有明确说则为 null",
  "slot_duration": "患者明确说的持续时间或严重程度，没有明确说则为 null",
  "slot_need": "患者明确说的就医目的（如挂号、查报告、咨询费用等），没有明确说则为 null"
}
严格规则：
- 只提取患者本人明确说过的话，不推断、不补充、不猜测
- 患者只提到症状但没说持续时间，slot_duration 必须为 null
- 患者没说就医目的，slot_need 必须为 null
- 宁可输出 null 也不要猜"""

MEDICAL_SLOT_CONV_SYSTEM = """你是医院的智能导诊顾问，正在接待一位前来咨询的患者。

当前还需要了解以下信息才能给出就诊建议：
{missing_info}

你的任务：用亲切自然的口语追问其中一个缺失信息。
要求：
- 每次只问一个问题，语气温和，让患者感到被关心
- 如果患者说了其他内容（如问地址、停车），先简短回答，再回到当前问题
- 绝对不要提前给出导诊建议或生成记录
- 发现胸痛、呼吸困难、意识模糊、大量出血等紧急情况，立即提示：「您描述的情况可能需要急诊，请立即前往急诊科或拨打120。」"""


# ── 预约挂号 flow（医疗第二阶段，3 个预约槽位）────────────

APPT_SLOT_ORDER = ["slot_patient_name", "slot_contact_email", "slot_appt_date"]
APPT_SLOT_LABELS = {
    "slot_patient_name":   "您的姓名",
    "slot_contact_email":  "邮箱地址（用于发送预约确认）",
    "slot_appt_date":      "希望就诊的日期",
}
APPT_SLOT_EXTRACT_SYSTEM = """你是一个预约信息提取助手。从患者的对话中提取以下信息，只输出 JSON：
{
  "slot_patient_name": "患者明确说的姓名，没有则为 null",
  "slot_contact_email": "患者明确说的邮箱地址，没有则为 null",
  "slot_appt_date": "患者明确说的就诊日期（如明天、4月21日等），没有则为 null"
}
严格规则：只提取明确说过的，不推断，不确定的输出 null。"""

APPT_SLOT_CONV_SYSTEM = """你是医院预约助手，正在帮患者完成挂号预约登记。

当前还需要了解以下信息：
{missing_info}

你的任务：用亲切的口语追问其中一个缺失信息。
要求：
- 每次只问一个问题
- 语气友好简洁
- 绝对不要提前生成预约单"""


# ── AI 运维元蜂群槽位（flow_ai_ops，6 个槽位）─────────────

OPS_SLOT_FLOWS = {"config/flow_ai_ops.yaml", "flow_ai_ops.yaml"}
OPS_SLOT_ORDER = [
    "slot_use_case", "slot_scale", "slot_env",
    "slot_core_features", "slot_ha", "slot_constraints",
]
OPS_SLOT_LABELS = {
    "slot_use_case":      "需求类型/使用场景",
    "slot_scale":         "规模（用户数/节点数/数据量）",
    "slot_env":           "部署环境（物理机/虚机/云/OS）",
    "slot_core_features": "核心功能需求",
    "slot_ha":            "高可用/可靠性要求",
    "slot_constraints":   "关键约束（预算/时间/集成）",
}
OPS_SLOT_EXTRACT_SYSTEM = """你是一个运维需求信息提取助手。从对话历史中提取以下字段，只输出 JSON，不输出其他内容：
{
  "slot_use_case": "用户想做什么（如：搭建SVN服务器/部署Kubernetes集群等），没有则为 null",
  "slot_scale": "规模信息（用户数量、节点数、数据量级等），没有则为 null",
  "slot_env": "部署环境（物理机/虚机/云，操作系统版本等），没有则为 null",
  "slot_core_features": "核心功能需求（如：版本控制/权限管理/高可用等），没有则为 null",
  "slot_ha": "高可用或可靠性要求（如：需要主从/需要故障切换/无要求等），没有则为 null",
  "slot_constraints": "限制条件（预算范围/上线时间/需对接的现有系统等），没有则为 null"
}
规则：只提取用户明确说过的内容，不推断，不确定的输出 null。"""


# ── flow 识别辅助 ───────────────────────────────────────

def is_slot_flow(config_path: str) -> bool:
    """是否为需求澄清或医疗导诊 flow（任一）。"""
    return (
        any(config_path.endswith(f) for f in SLOT_FLOWS)
        or any(config_path.endswith(f) for f in MEDICAL_SLOT_FLOWS)
    )


def is_medical_flow(config_path: str) -> bool:
    return any(config_path.endswith(f) for f in MEDICAL_SLOT_FLOWS)


def is_ops_flow(config_path: str) -> bool:
    return any(config_path.endswith(f) for f in OPS_SLOT_FLOWS)


# ── 槽位提取 LLM 调用 ───────────────────────────────────

def extract_slots_llm(
    conversation_history: str,
    current_slots: dict,
    extract_system: str | None = None,
    slot_order: list[str] | None = None,
) -> dict:
    """用一次轻量 LLM 调用从对话历史中提取槽位值，合并到 current_slots。"""
    if extract_system is None:
        extract_system = SLOT_EXTRACT_SYSTEM
    if slot_order is None:
        slot_order = SLOT_ORDER
    try:
        from src.model_adapter import ModelAdapter

        adapter = ModelAdapter(
            model="openai/glm-4.5-air",
            api_base=os.environ.get(
                "LITELLM_API_BASE", "http://127.0.0.1:4000/v1"
            ),
            api_key=os.environ.get("LITELLM_PROXY_KEY", ""),
        )
        result = adapter.call(extract_system, conversation_history)
        if result.get("status") != "success":
            return current_slots
        raw = result.get("output", "").strip()
        # 剥离 markdown code fence
        if "```" in raw:
            raw = raw.split("```")[1].lstrip("json").strip()
        extracted = json.loads(raw)
        merged = dict(current_slots)
        for slot in slot_order:
            val = extracted.get(slot)
            if val and val != "null" and not merged.get(slot):
                merged[slot] = str(val)[:500]
        return merged
    except Exception:
        return current_slots


def build_conv_history(session: dict) -> str:
    """把 session.turns 转成对话历史文本，供槽位提取使用。"""
    parts = []
    for t in session.get("turns", []) or []:
        parts.append(f"用户：{t['user']}")
        ao = t.get("assistant_output", "")
        if ao:
            parts.append(f"助手：{ao[:300]}")
    return "\n".join(parts)


# ── 预约邮件发送 ─────────────────────────────────────────

def send_appointment_email(
    to_email: str,
    patient_name: str,
    appt_record: str,
) -> bool:
    """发送预约确认邮件，返回是否成功。未配置 SMTP 时静默返回 False。"""
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    smtp_host = os.environ.get("SMTP_HOST", "")
    smtp_port = int(os.environ.get("SMTP_PORT", "465"))
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASS", "")
    smtp_from = os.environ.get("SMTP_FROM", smtp_user)

    if not all([smtp_host, smtp_user, smtp_pass]):
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"【医院预约确认】{patient_name} 的就诊预约"
        msg["From"] = smtp_from
        msg["To"] = to_email
        body = (
            f"尊敬的 {patient_name}，\n\n"
            f"您的就诊预约已登记，详情如下：\n\n{appt_record}\n\n"
            "如需取消或修改，请联系医院挂号处。\n\n祝您早日康复！"
        )
        msg.attach(MIMEText(body, "plain", "utf-8"))
        with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, [to_email], msg.as_string())
        return True
    except Exception:
        return False


# ── config_path 路径安全校验（多处复用）──────────────────

def validate_config_path(config_path: str) -> tuple[bool, str]:
    """校验 config 路径必须是 config/*.yaml 相对路径，无 ..。

    返回 (ok, error_message)。错误时 ok=False，error_message 描述原因。
    """
    if ".." in str(config_path):
        return False, "config 路径不允许包含 .."
    from pathlib import Path as _P
    p = _P(config_path)
    if p.is_absolute():
        return False, "config 路径必须是相对路径（如 config/flow_opc.yaml）"
    # Windows 把 '/' 转成 '\\'，先 normalize
    normalized = str(p).replace("\\", "/")
    if not normalized.startswith("config/"):
        return False, "config 路径必须以 config/ 开头"
    return True, ""
