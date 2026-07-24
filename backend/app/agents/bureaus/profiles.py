"""Immutable registry for the 39 bureau-level enterprise capabilities."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class BureauProfile:
    """The identity and complete responsibility scope of one bureau."""

    department: str
    bureau: str
    responsibilities: tuple[str, ...]


BUREAU_PROFILES: tuple[BureauProfile, ...] = (
    BureauProfile("吏部", "任免司", ("任免", "晋升", "职级", "调岗", "职责匹配")),
    BureauProfile("吏部", "招聘司", ("招聘需求", "岗位缺口", "候选人匹配", "面试推进")),
    BureauProfile("吏部", "劳关司", ("劳动关系", "员工入、离、调、转、续全过程风险")),
    BureauProfile("吏部", "薪酬司", ("薪酬区间", "调薪", "奖金", "预算", "内部公平性")),
    BureauProfile("吏部", "制度司", ("人事制度", "流程规则", "适用条款", "例外处理")),
    BureauProfile("吏部", "协同司", ("责任人", "跨司协同链路", "卡点", "逾期", "催办")),
    BureauProfile("户部", "预算司", ("预算", "预测", "费用控制", "经营分析")),
    BureauProfile("户部", "出纳司", ("现金安全", "回款", "付款", "账期", "资金安全垫")),
    BureauProfile("户部", "盐铁司", ("报价", "成本拆解", "毛利底线", "异常价格")),
    BureauProfile("户部", "融资司", ("资金缺口", "融资方案", "资金成本", "还款压力", "融资红线")),
    BureauProfile("户部", "审计司", ("异常报销", "重复付款", "缺证费用", "流程绕行稽核")),
    BureauProfile("户部", "会计司", ("收入", "成本", "费用", "科目", "项目归集", "税务", "月结")),
    BureauProfile(
        "户部",
        "投资司",
        (
            "投资评审",
            "收益测算",
            "风险分析",
            "退出路径",
            "证券行情",
            "股票价格",
            "市场数据",
            "估值观察",
        ),
    ),
    BureauProfile("礼部", "品牌司", ("品牌表达", "视觉资产", "语气一致性", "品牌风险")),
    BureauProfile("礼部", "公关司", ("舆情监测", "事实核查", "回应口径", "危机升级")),
    BureauProfile("礼部", "客户沟通司", ("客户话术", "沟通目标", "禁用话术", "承诺边界")),
    BureauProfile("礼部", "内容司", ("内容质量", "事实校验", "发布门禁", "修改建议")),
    BureauProfile("礼部", "政企司", ("政企合作", "材料准备", "合规边界", "跟进计划")),
    BureauProfile("礼部", "体验司", ("用户反馈", "体验问题优先级", "优化建议", "结果验证")),
    BureauProfile("兵部", "报价司", ("商机推进", "客户阶段", "报价动作", "赢率", "阻塞点")),
    BureauProfile("兵部", "线索司", ("市场活动", "线索质量", "获客成本", "投放复盘")),
    BureauProfile("兵部", "渠道司", ("渠道合作", "报备", "成交归属", "返佣", "渠道冲突")),
    BureauProfile("兵部", "客户司", ("客户健康", "续约", "投诉", "交付问题", "关键联系人")),
    BureauProfile("兵部", "竞情司", ("竞品对比", "价格战风险", "输赢原因", "竞争策略")),
    BureauProfile("兵部", "增长司", ("漏斗转化", "增长瓶颈", "实验队列", "实验优先级")),
    BureauProfile("刑部", "合同司", ("合同条款", "签署门禁", "缺失条款", "模板偏离")),
    BureauProfile("刑部", "合规稽查司", ("合规规则", "风险等级", "整改要求", "稽查结论")),
    BureauProfile("刑部", "风控司", ("整体风险评分", "风险趋势", "控制措施", "准入建议")),
    BureauProfile("刑部", "缺证核查司", ("证据完整性", "授权链", "审批状态", "越权检查")),
    BureauProfile("刑部", "争议处置司", ("争议事实链", "双方诉求", "证据强弱", "处置策略")),
    BureauProfile("刑部", "知识产权司", ("知识产权归属", "授权", "侵权风险", "保护建议")),
    BureauProfile("刑部", "制度司", ("法律制度", "处罚风险", "整改路径", "豁免条件")),
    BureauProfile("工部", "产研司", ("需求", "产品方案", "用户价值", "范围边界", "优先级")),
    BureauProfile("工部", "技术司", ("技术可行性", "架构风险", "研发成本", "依赖", "技术债")),
    BureauProfile("工部", "物料司", ("库存", "采购", "供应商", "缺料风险", "替代方案")),
    BureauProfile("工部", "进度司", ("里程碑", "排期", "延期风险", "卡点责任人", "交付预测")),
    BureauProfile("工部", "质量司", ("质量检查", "缺陷", "验收证据", "返工建议", "质量裁决")),
    BureauProfile("工部", "现场司", ("现场事实", "客户反馈", "处理进度", "现场证据")),
    BureauProfile("工部", "承诺司", ("客户承诺", "兑现状态", "承诺来源", "责任人", "越权风险")),
)

_PROFILE_BY_IDENTITY = {
    (profile.department, profile.bureau): profile for profile in BUREAU_PROFILES
}


def bureau_profiles_for(department: str) -> tuple[BureauProfile, ...]:
    """Return all open bureaus for ``department`` in registry order."""

    profiles = tuple(
        profile for profile in BUREAU_PROFILES if profile.department == department
    )
    if not profiles:
        raise ValueError("Unknown bureau department.")
    return profiles


def bureau_profile_for(department: str, bureau: str) -> BureauProfile:
    """Resolve a bureau by its compound identity, rejecting cross-department use."""

    try:
        return _PROFILE_BY_IDENTITY[(department, bureau)]
    except KeyError as exc:
        raise ValueError("Unknown or cross-department bureau identity.") from exc
