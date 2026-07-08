/**
 * 东宫(太子自主运营模式)视图数据源。
 *
 * 契约驱动:形状严格来自 @/lib/contracts/authorization + memorial(SoT)。
 * 当前为静态 source(产品 backend #4 未就绪),与 governance 的 GOVERNANCE_CASES
 * 同范式;后端就绪后改 swrFetcher('/court/donggong') 即可,组件不变。
 *
 * 角色定位:太子=朝廷自主运营模式(非 AgentCode),对应 governance 页"太子先盯盘":
 * 感知六部情报→自主决策→低风险授权毕业/高风险伏候圣裁→反事实奏折。
 */
import type { AuthorizationGrant, Escalation } from '@/lib/contracts/authorization';
import type { MemorialSections } from '@/lib/contracts/memorial';

export interface DonggongSummary {
  executed: number;
  blocked: number;
  pending: number;
  date: string;
}

export interface DonggongAuthorityDrill {
  title: string;
  objectId: string;
  borrowedFrom: string;
  mode: 'simulate_only';
  route: string[];
  humanGate: string;
  nextAction: string;
  evidence: string[];
}

export interface DonggongSoloCompanyPrototype {
  headline: string;
  operatingRule: string;
  loop: string[];
  principles: string[];
}

export interface DonggongDigitalTwin {
  title: string;
  mandate: string;
  channels: string[];
  canDo: string[];
  mustAsk: string[];
  signature: string;
}

export interface DonggongRoleBoundary {
  role: string;
  badge: string;
  power: string;
  value: string;
  cannot: string;
  tone: 'gold' | 'green' | 'blue';
}

export interface DonggongView {
  summary: DonggongSummary;
  grants: AuthorizationGrant[];
  escalations: Escalation[];
  authorityDrill: DonggongAuthorityDrill;
  soloCompany: DonggongSoloCompanyPrototype;
  digitalTwin: DonggongDigitalTwin;
  roleBoundaries: DonggongRoleBoundary[];
  memorial: Pick<
    MemorialSections,
    'recommendation' | 'notDone' | 'awaitingDecree' | 'counterfactual'
  >;
}

/** 静态视图模型(可整体替换为后端响应)。 */
export function buildDonggongView(): DonggongView {
  const grants: AuthorizationGrant[] = [
    { actionClass: 'hu_bu:medium', approvals: 5, rejections: 0, graduated: true, highRiskLocked: false, graduateThreshold: 5 },
    { actionClass: 'gong_bu:medium', approvals: 3, rejections: 0, graduated: false, highRiskLocked: false, graduateThreshold: 5 },
    { actionClass: 'jin_yi_wei:low', approvals: 5, rejections: 0, graduated: true, highRiskLocked: false, graduateThreshold: 5 },
    { actionClass: 'bing_bu:high', approvals: 0, rejections: 1, graduated: false, highRiskLocked: true, graduateThreshold: 5 },
  ];

  const escalations: Escalation[] = [
    {
      id: 'esc-hu-001',
      actionClass: 'hu_bu:high',
      department: 'hu_bu',
      reason: '拟一次性投放 ¥2000 竞品反制预算,超户部单笔上限,伏候圣裁',
      riskLevel: 'high',
      createdAt: '2026-06-02T08:00:00Z',
      slaSeconds: 3600,
      defaultOnTimeout: 'block',
      resolved: null,
      resolvedBy: '',
    },
    {
      id: 'esc-bing-002',
      actionClass: 'bing_bu:high',
      department: 'bing_bu',
      reason: '对竞品开源低价模型启动价格战+生态绑定,属高危战略动作,需御批',
      riskLevel: 'high',
      createdAt: '2026-06-02T08:05:00Z',
      slaSeconds: 3600,
      defaultOnTimeout: 'block',
      resolved: null,
      resolvedBy: '',
    },
  ];

  const memorial: DonggongView['memorial'] = {
    recommendation: '今日运营平稳:户部低额跟进已授权毕业;两件高危战略伏候圣裁,逾期默断为按律拦下。',
    notDone: [
      { objective: '工部:大额算力集群采购', reason: 'ROI 0.3 未达阈值,按律拦下' },
    ],
    awaitingDecree: [
      { objective: '户部竞品反制预算 ¥2000', reason: '超单笔上限', sla: '60 分钟' },
      { objective: '兵部价格战+生态绑定', reason: '高危双签未过,强制上报', sla: '60 分钟' },
    ],
    counterfactual: [
      { objective: '户部竞品反制预算', estimatedGain: '若获准,预计半年省 80% 推理预算(ROI≈8.5)' },
      { objective: '兵部价格战', estimatedGain: '若获准,预计守住竞品冲击下的市场份额' },
    ],
  };

  const authorityDrill: DonggongAuthorityDrill = {
    title: '权责演练 · 同一 objectId 继承训练',
    objectId: 'build-chaotang-dev-workbench-mvp-shadow',
    borrowedFrom: '工部发布前固定演示脚本',
    mode: 'simulate_only',
    route: ['上书房下旨', '东宫模拟判断', '御史二审', '史馆归档', '皇帝准驳'],
    humanGate: '御史二审前不授功业、不升级授权、不生成称号',
    nextAction: '请皇上准/驳高危事项；太子只给建议和反事实，不越权执行。',
    evidence: ['同一 objectId', '模拟痕迹', '二审意见', '准驳记录'],
  };

  const soloCompany: DonggongSoloCompanyPrototype = {
    headline: '一人公司的自动化运营雏形',
    operatingRule: '老板只处理高风险准驳；低风险动作只在授权毕业后代办；所有判断留下影子记录、二审意见和史馆证据。',
    loop: ['盯盘', '代拟', '按律拦截', '请您拍板', '归档学习'],
    principles: ['不替老板做高危决定', '不把模拟当执行', '不让自动化脱离证据链'],
  };

  const digitalTwin: DonggongDigitalTwin = {
    title: '数字分身 · 御前副本',
    mandate: '代老板看盘、代拟口径、催办低风险事项；遇到花钱、签约、公开发布和战略转向，必须回到本人准驳。',
    channels: ['经营日报', '客户跟进', '预算准驳草案', '发布口径预演'],
    canDo: ['代拟回复', '提醒跟进', '整理证据', '生成待批草案'],
    mustAsk: ['付款', '签约', '公开发布', '战略转向'],
    signature: '所有对外内容标记为数字分身代拟，未经本人确认不得代表最终决定。',
  };

  const roleBoundaries: DonggongRoleBoundary[] = [
    {
      role: '皇帝本人',
      badge: '最终准驳',
      power: '处理高风险、不可逆、对外承诺和战略转向。',
      value: '保留最终意志、责任和品牌信用。',
      cannot: '不被系统替代,不把责任外包给自动化。',
      tone: 'gold',
    },
    {
      role: '太子监国',
      badge: '授权毕业',
      power: '低风险只在授权毕业后代办,高风险一律拦截并上奏。',
      value: '让一人公司在老板不盯盘时仍持续运转。',
      cannot: '不擅自越权,不把模拟结果当真实执行。',
      tone: 'green',
    },
    {
      role: '数字分身',
      badge: '代拟与跟进',
      power: '代拟表达、提醒跟进、整理证据、生成待批草案。',
      value: '提前准备老板的表达和判断材料,减少重复沟通。',
      cannot: '不代表最终决定,不私自付款、签约或公开发布。',
      tone: 'blue',
    },
  ];

  return {
    summary: { executed: 6, blocked: 1, pending: escalations.length, date: '2026-06-02' },
    grants,
    escalations,
    authorityDrill,
    soloCompany,
    digitalTwin,
    roleBoundaries,
    memorial,
  };
}
