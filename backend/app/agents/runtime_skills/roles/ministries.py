from app.agents.ministries.prompts import MINISTRY_POSITIONINGS
from app.agents.runtime_skills.models import (
    AgentLayer,
    MinistryReport,
    RuntimeService,
    RuntimeSkillDefinition,
)

_SKILL_IDS = {
    "吏部": "synthesize-workforce-governance",
    "户部": "synthesize-finance-governance",
    "礼部": "synthesize-communications-governance",
    "兵部": "synthesize-commercial-governance",
    "刑部": "synthesize-risk-governance",
    "工部": "synthesize-delivery-governance",
}
_AGENT_IDS = {
    "吏部": "ministry-libu",
    "户部": "ministry-hubu",
    "礼部": "ministry-libu-rites",
    "兵部": "ministry-bingbu",
    "刑部": "ministry-xingbu",
    "工部": "ministry-gongbu",
}


MINISTRY_SKILLS = tuple(
    RuntimeSkillDefinition(
        skill_id=_SKILL_IDS[item.department],
        version="1.0.0",
        agent_id=_AGENT_IDS[item.department],
        layer=AgentLayer.MINISTRY,
        purpose=f"综合{item.department}所属各司报告，形成{item.memorial_goal}。",
        responsibility_scope=(item.positioning, *item.inputs),
        data_requirements=("确定性选司结果与理由", "所有已调用司级结构化报告"),
        analysis_procedure=(
            "校验选司均属本部",
            "审阅并比较全部司级报告",
            "形成跨司取舍、冲突与部级立场",
        ),
        required_findings=("共享发现与冲突", "跨司影响、部级立场与未决事项"),
        allowed_services=frozenset({RuntimeService.BUREAU_AGENTS}),
        forbidden_actions=(
            f"不得虚构未调用的{item.department}司级意见",
            "不得调用锦衣卫、MCP、外网、史馆写入或其他部的司级 Agent",
        ),
        report_type=MinistryReport,
    )
    for item in MINISTRY_POSITIONINGS
)
