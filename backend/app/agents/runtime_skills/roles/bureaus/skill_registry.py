"""Explicit fail-closed registry shell for bureau Runtime Skill declarations."""

from __future__ import annotations

from collections.abc import Iterable

from app.agents.runtime_skills.roles.bureaus.skill_spec import BureauRuntimeSkillSpec
from app.agents.runtime_skills.roles.bureaus.skills.bingbu_channels import (
    SKILL as BINGBU_CHANNELS_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.bingbu_competition import (
    SKILL as BINGBU_COMPETITION_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.bingbu_customers import (
    SKILL as BINGBU_CUSTOMERS_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.bingbu_growth import (
    SKILL as BINGBU_GROWTH_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.bingbu_leads import (
    SKILL as BINGBU_LEADS_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.bingbu_sales_opportunity import (
    SKILL as BINGBU_SALES_OPPORTUNITY_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.gongbu_commitments import (
    SKILL as GONGBU_COMMITMENTS_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.gongbu_field import SKILL as GONGBU_FIELD_SKILL
from app.agents.runtime_skills.roles.bureaus.skills.gongbu_product import (
    SKILL as GONGBU_PRODUCT_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.gongbu_quality import (
    SKILL as GONGBU_QUALITY_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.gongbu_schedule import (
    SKILL as GONGBU_SCHEDULE_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.gongbu_supply import (
    SKILL as GONGBU_SUPPLY_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.gongbu_technology import (
    SKILL as GONGBU_TECHNOLOGY_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.hubu_accounting import (
    SKILL as HUBU_ACCOUNTING_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.hubu_audit import (
    SKILL as HUBU_AUDIT_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.hubu_budget import (
    SKILL as HUBU_BUDGET_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.hubu_financing import (
    SKILL as HUBU_FINANCING_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.hubu_investment import (
    SKILL as HUBU_INVESTMENT_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.hubu_pricing import (
    SKILL as HUBU_PRICING_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.hubu_treasury import (
    SKILL as HUBU_TREASURY_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.libu_appointments import (
    SKILL as LIBU_APPOINTMENTS_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.libu_compensation import (
    SKILL as LIBU_COMPENSATION_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.libu_coordination import (
    SKILL as LIBU_COORDINATION_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.libu_labor_relations import (
    SKILL as LIBU_LABOR_RELATIONS_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.libu_policy import (
    SKILL as LIBU_POLICY_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.libu_recruitment import (
    SKILL as LIBU_RECRUITMENT_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.libu_rites_brand import (
    SKILL as LIBU_RITES_BRAND_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.libu_rites_content import (
    SKILL as LIBU_RITES_CONTENT_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.libu_rites_customer_communications import (
    SKILL as LIBU_RITES_CUSTOMER_COMMUNICATIONS_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.libu_rites_experience import (
    SKILL as LIBU_RITES_EXPERIENCE_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.libu_rites_government_enterprise import (
    SKILL as LIBU_RITES_GOVERNMENT_ENTERPRISE_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.libu_rites_public_relations import (
    SKILL as LIBU_RITES_PUBLIC_RELATIONS_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.xingbu_compliance import (
    SKILL as XINGBU_COMPLIANCE_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.xingbu_contracts import (
    SKILL as XINGBU_CONTRACTS_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.xingbu_disputes import (
    SKILL as XINGBU_DISPUTES_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.xingbu_evidence_integrity import (
    SKILL as XINGBU_EVIDENCE_INTEGRITY_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.xingbu_intellectual_property import (
    SKILL as XINGBU_INTELLECTUAL_PROPERTY_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.xingbu_policy import (
    SKILL as XINGBU_POLICY_SKILL,
)
from app.agents.runtime_skills.roles.bureaus.skills.xingbu_risk_control import (
    SKILL as XINGBU_RISK_CONTROL_SKILL,
)

BureauSkillIdentity = tuple[str, str, str, str, str]
EXPECTED_COMPLETE_BUREAU_SKILL_COUNT = 39


def _reject_duplicate_identities(skills: tuple[BureauRuntimeSkillSpec, ...]) -> None:
    identity_fields = (
        ("department_bureau", lambda item: (item.department, item.bureau)),
        ("agent_id", lambda item: item.agent_id),
        ("skill_id", lambda item: item.skill_id),
        ("policy_id", lambda item: item.tool_policy.policy_id),
    )
    for name, key in identity_fields:
        values = tuple(key(item) for item in skills)
        if len(set(values)) != len(values):
            raise ValueError(f"duplicate_bureau_{name}")


def build_bureau_skill_registry(
    declared_skills: Iterable[BureauRuntimeSkillSpec],
    *,
    expected_identities: Iterable[BureauSkillIdentity],
    finalize: bool = False,
) -> tuple[BureauRuntimeSkillSpec, ...]:
    """Validate explicit declarations and return an immutable ordered registry."""

    skills = tuple(declared_skills)
    if any(not isinstance(item, BureauRuntimeSkillSpec) for item in skills):
        raise TypeError("invalid_bureau_skill_declaration")
    expected = tuple(expected_identities)
    if any(len(identity) != 5 for identity in expected):
        raise ValueError("invalid_expected_bureau_skill_identity")

    _reject_duplicate_identities(skills)
    actual = tuple(item.identity for item in skills)
    if len(set(expected)) != len(expected):
        raise ValueError("duplicate_expected_bureau_skill_identity")
    if set(actual) != set(expected) or len(actual) != len(expected):
        raise ValueError("bureau_skill_identity_inventory_mismatch")
    if actual != expected:
        raise ValueError("bureau_skill_identity_mismatch")
    if finalize and len(skills) != EXPECTED_COMPLETE_BUREAU_SKILL_COUNT:
        raise ValueError("incomplete_bureau_skill_registry")
    return skills


BUREAU_SKILL_SPECS: tuple[BureauRuntimeSkillSpec, ...] = build_bureau_skill_registry(
    (
        LIBU_APPOINTMENTS_SKILL,
        LIBU_RECRUITMENT_SKILL,
        LIBU_LABOR_RELATIONS_SKILL,
        LIBU_COMPENSATION_SKILL,
        LIBU_POLICY_SKILL,
        LIBU_COORDINATION_SKILL,
        HUBU_BUDGET_SKILL,
        HUBU_TREASURY_SKILL,
        HUBU_PRICING_SKILL,
        HUBU_FINANCING_SKILL,
        HUBU_AUDIT_SKILL,
        HUBU_ACCOUNTING_SKILL,
        HUBU_INVESTMENT_SKILL,
        LIBU_RITES_BRAND_SKILL,
        LIBU_RITES_PUBLIC_RELATIONS_SKILL,
        LIBU_RITES_CUSTOMER_COMMUNICATIONS_SKILL,
        LIBU_RITES_CONTENT_SKILL,
        LIBU_RITES_GOVERNMENT_ENTERPRISE_SKILL,
        LIBU_RITES_EXPERIENCE_SKILL,
        BINGBU_SALES_OPPORTUNITY_SKILL,
        BINGBU_LEADS_SKILL,
        BINGBU_CHANNELS_SKILL,
        BINGBU_CUSTOMERS_SKILL,
        BINGBU_COMPETITION_SKILL,
        BINGBU_GROWTH_SKILL,
        XINGBU_CONTRACTS_SKILL,
        XINGBU_COMPLIANCE_SKILL,
        XINGBU_RISK_CONTROL_SKILL,
        XINGBU_EVIDENCE_INTEGRITY_SKILL,
        XINGBU_DISPUTES_SKILL,
        XINGBU_INTELLECTUAL_PROPERTY_SKILL,
        XINGBU_POLICY_SKILL,
        GONGBU_PRODUCT_SKILL,
        GONGBU_TECHNOLOGY_SKILL,
        GONGBU_SUPPLY_SKILL,
        GONGBU_SCHEDULE_SKILL,
        GONGBU_QUALITY_SKILL,
        GONGBU_FIELD_SKILL,
        GONGBU_COMMITMENTS_SKILL,
    ),
    expected_identities=(
        (
            "吏部",
            "任免司",
            "libu-appointments",
            "analyze-appointment-fit",
            "bureau.libu.appointments.tools",
        ),
        (
            "吏部",
            "招聘司",
            "libu-recruitment",
            "analyze-recruitment-pipeline",
            "bureau.libu.recruitment.tools",
        ),
        (
            "吏部",
            "劳关司",
            "libu-labor-relations",
            "analyze-labor-relations",
            "bureau.libu.labor-relations.tools",
        ),
        (
            "吏部",
            "薪酬司",
            "libu-compensation",
            "analyze-compensation-equity",
            "bureau.libu.compensation.tools",
        ),
        ("吏部", "制度司", "libu-policy", "analyze-hr-policy", "bureau.libu.policy.tools"),
        (
            "吏部",
            "协同司",
            "libu-coordination",
            "analyze-workforce-coordination",
            "bureau.libu.coordination.tools",
        ),
        ("户部", "预算司", "hubu-budget", "analyze-budget-performance", "bureau.hubu.budget.tools"),
        ("户部", "出纳司", "hubu-treasury", "analyze-cash-safety", "bureau.hubu.treasury.tools"),
        (
            "户部",
            "盐铁司",
            "hubu-pricing",
            "analyze-pricing-economics",
            "bureau.hubu.pricing.tools",
        ),
        (
            "户部",
            "融资司",
            "hubu-financing",
            "analyze-financing-options",
            "bureau.hubu.financing.tools",
        ),
        ("户部", "审计司", "hubu-audit", "analyze-financial-controls", "bureau.hubu.audit.tools"),
        (
            "户部",
            "会计司",
            "hubu-accounting",
            "analyze-accounting-position",
            "bureau.hubu.accounting.tools",
        ),
        (
            "户部",
            "投资司",
            "hubu-investment",
            "analyze-investment-case",
            "bureau.hubu.investment.tools",
        ),
        (
            "礼部",
            "品牌司",
            "libu-rites-brand",
            "analyze-brand-consistency",
            "bureau.libu_rites.brand.tools",
        ),
        (
            "礼部",
            "公关司",
            "libu-rites-public-relations",
            "analyze-public-relations",
            "bureau.libu_rites.public_relations.tools",
        ),
        (
            "礼部",
            "客户沟通司",
            "libu-rites-customer-communications",
            "analyze-customer-communications",
            "bureau.libu_rites.customer_communications.tools",
        ),
        (
            "礼部",
            "内容司",
            "libu-rites-content",
            "analyze-content-quality",
            "bureau.libu_rites.content.tools",
        ),
        (
            "礼部",
            "政企司",
            "libu-rites-government-enterprise",
            "analyze-government-enterprise-relations",
            "bureau.libu_rites.government_enterprise.tools",
        ),
        (
            "礼部",
            "体验司",
            "libu-rites-experience",
            "analyze-user-experience",
            "bureau.libu_rites.experience.tools",
        ),
        (
            "兵部",
            "报价司",
            "bingbu-sales-opportunity",
            "analyze-sales-opportunity",
            "bureau.bingbu.sales_opportunity.tools",
        ),
        ("兵部", "线索司", "bingbu-leads", "analyze-lead-acquisition", "bureau.bingbu.leads.tools"),
        (
            "兵部",
            "渠道司",
            "bingbu-channels",
            "analyze-channel-performance",
            "bureau.bingbu.channels.tools",
        ),
        (
            "兵部",
            "客户司",
            "bingbu-customers",
            "analyze-customer-health",
            "bureau.bingbu.customers.tools",
        ),
        (
            "兵部",
            "竞情司",
            "bingbu-competition",
            "analyze-competitive-position",
            "bureau.bingbu.competition.tools",
        ),
        ("兵部", "增长司", "bingbu-growth", "analyze-growth-funnel", "bureau.bingbu.growth.tools"),
        (
            "刑部",
            "合同司",
            "xingbu-contracts",
            "analyze-contract-risk",
            "bureau.xingbu.contracts.tools",
        ),
        (
            "刑部",
            "合规稽查司",
            "xingbu-compliance",
            "analyze-compliance-posture",
            "bureau.xingbu.compliance.tools",
        ),
        (
            "刑部",
            "风控司",
            "xingbu-risk-control",
            "analyze-enterprise-risk",
            "bureau.xingbu.risk_control.tools",
        ),
        (
            "刑部",
            "缺证核查司",
            "xingbu-evidence-integrity",
            "analyze-evidence-integrity",
            "bureau.xingbu.evidence_integrity.tools",
        ),
        (
            "刑部",
            "争议处置司",
            "xingbu-disputes",
            "analyze-dispute-resolution",
            "bureau.xingbu.disputes.tools",
        ),
        (
            "刑部",
            "知识产权司",
            "xingbu-intellectual-property",
            "analyze-intellectual-property",
            "bureau.xingbu.intellectual_property.tools",
        ),
        ("刑部", "制度司", "xingbu-policy", "analyze-legal-policy", "bureau.xingbu.policy.tools"),
        (
            "工部",
            "产研司",
            "gongbu-product",
            "analyze-product-strategy",
            "bureau.gongbu.product.tools",
        ),
        (
            "工部",
            "技术司",
            "gongbu-technology",
            "analyze-technical-feasibility",
            "bureau.gongbu.technology.tools",
        ),
        (
            "工部",
            "物料司",
            "gongbu-supply",
            "analyze-supply-readiness",
            "bureau.gongbu.supply.tools",
        ),
        (
            "工部",
            "进度司",
            "gongbu-schedule",
            "analyze-delivery-schedule",
            "bureau.gongbu.schedule.tools",
        ),
        (
            "工部",
            "质量司",
            "gongbu-quality",
            "analyze-quality-readiness",
            "bureau.gongbu.quality.tools",
        ),
        ("工部", "现场司", "gongbu-field", "analyze-field-conditions", "bureau.gongbu.field.tools"),
        (
            "工部",
            "承诺司",
            "gongbu-commitments",
            "analyze-commitment-fulfillment",
            "bureau.gongbu.commitments.tools",
        ),
    ),
    finalize=True,
)
