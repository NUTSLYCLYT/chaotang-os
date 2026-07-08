from __future__ import annotations
import re
from dataclasses import dataclass, field

@dataclass
class SwarmProfile:
    swarm_id: str
    name: str
    good_at: list = field(default_factory=list)
    keywords: list = field(default_factory=list)
    confidence: float = 0.8

# 完整蜂群关键词配置 v3 - 解决关键词冲突
SWARM_PROFILES = {
    # 核心业务蜂群
    "haolong": SwarmProfile(
        "haolong", "获客 Pipeline",
        ["获客", "线索"],
        ["获客", "线索", "意向", "拜访", "跟进", "新线索", "高意向", "客户转化", "销售线索"],
    ),
    "opc": SwarmProfile(
        "opc", "OPC 市场",
        ["商机", "市场"],
        ["商机", "市场", "行业", "动态", "拓客", "客户群", "竞争对手", "市场份额", "市场分析"],
    ),
    "product": SwarmProfile(
        "product", "产品研发",
        ["竞品", "产品"],
        ["竞品", "产品", "功能", "研发", "对比", "差异", "需求", "竞品对比"],
    ),
    "quotation": SwarmProfile(
        "quotation", "报价",
        ["报价", "成本"],
        ["报价", "报个价", "价格", "成本", "利润", "打折", "核算"],
    ),
    
    # 研发交付蜂群
    "sourcing": SwarmProfile(
        "sourcing", "采购 Sourcing",
        ["供应", "物料"],
        ["供应", "供应商", "物料", "库存", "采购单", "交货", "质量审核"],
    ),
    "pack_rd": SwarmProfile(
        "pack_rd", "PACK 研发",
        ["PACK", "电池模组", "BMS", "储能"],
        ["PACK研发", "PACK设计方案", "PACK设计", "电池模组", "BMS", "BMS软件", "模组", "热管理", "可靠性", "电芯", "储能"],
    ),
    "battery_stage_gate": SwarmProfile(
        "battery_stage_gate", "电池 Stage Gate",
        ["Stage Gate", "阶段评审", "阶段门"],
        ["Stage Gate评审", "电池项目Stage Gate", "阶段评审", "阶段门评审", "阶段门Gate", "FMEA", "失效模式", "制造工艺", "工艺评审"],
    ),
    
    # 功能支持蜂群
    "finance": SwarmProfile(
        "finance", "财务分析",
        ["财务", "资金"],
        ["财务", "财务预算", "预算执行", "资金", "发票", "回款", "账期", "现金流", "报表"],
    ),
    "legal": SwarmProfile(
        "legal", "法律合规",
        ["合同", "合规"],
        ["合同", "合规", "法务", "条款", "风险", "审阅"],
    ),
    "xiaohongshu": SwarmProfile(
        "xiaohongshu", "小红书运营",
        ["小红书", "KOL", "笔记", "种草"],
        ["小红书内容", "小红书运营", "KOL", "爆款笔记", "种草", "账号运营", "博主"],
    ),
    "ima": SwarmProfile(
        "ima", "IMA 知识",
        ["知识库", "知识图谱"],
        ["行业知识库", "知识库", "知识图谱", "文档检索", "案例库", "最佳实践", "技术文档", "故障案例"],
    ),
    
    # 管理和工具蜂群
    "court": SwarmProfile(
        "court", "三省六部",
        ["策略", "战略", "规划", "协调"],
        ["策略", "战略", "规划", "协调", "决策", "制定", "多部门", "跨部门", "公司级", "公司战略", "整体规划"],
    ),
    "ai_ops": SwarmProfile(
        "ai_ops", "AI 运维",
        ["AI运维", "模型运维", "LLM", "RAG"],
        [
            "AI运维", "AIOps", "MLOps", "模型运维", "模型部署", "部署运维",
            "AI模型", "大模型", "LLM", "RAG", "向量检索", "embedding",
            "模型性能", "推理延迟", "延迟异常", "SLA", "QPS", "吞吐",
            "AI监控", "监控告警", "SLA告警", "告警处理", "链路追踪",
            "token", "token成本", "成本飙升", "限流", "降级", "熔断",
        ],
    ),
    "sdlc": SwarmProfile(
        "sdlc", "SDLC 开发",
        ["SDLC", "需求文档", "代码"],
        ["SDLC", "SDLC开发", "生成需求文档", "需求文档", "架构设计", "代码审查", "测试用例", "安全漏洞扫描", "漏洞扫描", "安全扫描", "代码生成"],
    ),
}

# 高精度业务词先于泛战略词生效，避免 "方案/策略/规划/决策" 抢走明确领域任务。
PRIORITY_KEYWORDS = {
    "pack_rd": ["PACK", "BMS", "电池模组", "热管理", "电芯", "储能"],
    "battery_stage_gate": ["Stage Gate", "Gate评审", "阶段门", "FMEA", "失效模式", "制造工艺"],
    "finance": ["财务预算", "预算执行", "现金流", "发票", "回款"],
    "xiaohongshu": ["小红书", "KOL", "爆款笔记", "种草", "博主"],
    "ima": ["知识库", "知识图谱", "文档检索", "案例库", "最佳实践", "技术文档", "故障案例"],
    "ai_ops": [
        "AI运维", "AIOps", "MLOps", "模型运维", "模型部署", "部署运维",
        "AI模型", "大模型", "LLM", "RAG", "向量检索", "embedding",
        "模型性能", "推理延迟", "延迟异常", "SLA", "QPS", "吞吐",
        "AI监控", "监控告警", "SLA告警", "告警处理", "链路追踪",
        "token", "token成本", "成本飙升", "限流", "降级", "熔断",
    ],
    "sdlc": ["SDLC", "需求文档", "架构设计", "代码审查", "测试用例", "漏洞扫描", "安全扫描", "代码生成"],
}

# 战略关键词 - 触发 court
STRATEGIC_KEYWORDS = [
    "策略", "战略", "规划", "方案", "制定",
    "多部门", "跨部门", "协调", "协作", "统筹",
    "决策", "转型", "变革", "整体", "全面",
    "公司级", "年度计划", "重大",
]

SIMPLE_PATTERNS = [
    r"^(什么是|怎么|如何|怎么样)",
]


@dataclass
class ComplexityScore:
    total: float
    word_count: int
    primary_domain: str
    is_simple: bool
    domain_score: int = 0
    priority_domain: bool = False


class DirectRouter:
    def _score_keywords(self, command, keywords, weight):
        return sum(weight for kw in keywords if kw and kw in command)

    def _match_domain(self, command):
        best_sid = None
        best_score = 0
        best_priority = False
        
        for sid, p in SWARM_PROFILES.items():
            score = 0
            priority_score = self._score_keywords(command, PRIORITY_KEYWORDS.get(sid, []), 6)
            score += priority_score
            for kw in p.keywords:
                if kw in command:
                    score += 3
            
            if score > best_score:
                best_score = score
                best_sid = sid
                best_priority = priority_score > 0
        
        if best_score >= 2:
            return best_sid, best_score, best_priority
        return None, 0, False
    
    def _is_simple_question(self, command):
        wc = len(command)
        if wc > 50:
            return False
        if command.endswith(("？", "?")):
            return True
        for pattern in SIMPLE_PATTERNS:
            if re.match(pattern, command):
                return True
        greetings = ["你好", "您好", "嗨", "hi", "hello", "在吗"]
        if wc < 8 and any(g == command for g in greetings):
            return True
        return False
    
    def _has_strategic_keywords(self, command):
        return any(kw in command for kw in STRATEGIC_KEYWORDS)
    
    def calc_complexity(self, command):
        cmd = command.strip()
        wc = len(cmd)
        
        domain, domain_score, priority_domain = self._match_domain(cmd)
        is_simple = self._is_simple_question(cmd)
        has_strategic = self._has_strategic_keywords(cmd)
        
        if is_simple:
            score = 1.0
        elif has_strategic:
            score = 4.0
        elif domain:
            score = 1.0 + min(domain_score, 4) * 0.5
        else:
            score = 2.5
        
        score += min(1.5, wc / 150)
        
        return ComplexityScore(
            total=min(10.0, score),
            word_count=wc,
            primary_domain=domain or "",
            is_simple=is_simple,
            domain_score=domain_score,
            priority_domain=priority_domain,
        )
    
    def route(self, command):
        c = self.calc_complexity(command)
        
        if c.is_simple:
            return ExecutionPlan("direct", "llm", "简单问答", 0.95, c)
        
        if c.primary_domain and c.priority_domain:
            profile = SWARM_PROFILES[c.primary_domain]
            return ExecutionPlan("swarm", profile.swarm_id, "高精度匹配" + profile.name, profile.confidence, c)
        
        if c.total >= 4 or self._has_strategic_keywords(command):
            return ExecutionPlan("court", "court", "战略决策", 0.85, c)
        
        if c.primary_domain:
            profile = SWARM_PROFILES[c.primary_domain]
            return ExecutionPlan("swarm", profile.swarm_id, "匹配" + profile.name, profile.confidence, c)
        
        return ExecutionPlan("court", "court", "综合任务", 0.7, c)


def calc_complexity(command):
    return router.calc_complexity(command)


router = DirectRouter()


@dataclass
class ExecutionPlan:
    mode: str
    target: str
    reason: str
    confidence: float
    complexity: ComplexityScore
