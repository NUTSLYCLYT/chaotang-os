from app.agents.runtime_skills.models import (
    AgentLayer,
    CouncilReport,
    RuntimeService,
    RuntimeSkillDefinition,
)

JUNJICHU_SKILL = RuntimeSkillDefinition(
    skill_id="conduct-joint-ministry-review",
    version="1.0.0",
    agent_id="junjichu",
    layer=AgentLayer.COUNCIL,
    purpose="按批准顺序组织跨部会审并保留共识、分歧、依赖与联合选项。",
    responsibility_scope=("批准部门与顺序", "跨部共识与分歧", "联合会审结论"),
    data_requirements=("批准的参会部门及顺序", "各部结构化报告及引用"),
    analysis_procedure=("核对参会名单与顺序", "依序审阅各部报告", "汇总共识、分歧与待丞相裁决事项"),
    required_findings=("跨部共识与真实分歧", "依赖关系与联合选项"),
    allowed_services=frozenset({RuntimeService.MINISTRY_AGENTS}),
    forbidden_actions=("不得增删参会部门或改变批准顺序", "不得直接调用司级 Agent 或调查证据"),
    report_type=CouncilReport,
)
