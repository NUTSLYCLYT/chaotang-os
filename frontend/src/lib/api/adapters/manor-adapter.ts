import { API_MODE } from '@/lib/api/client';
import type { ManorAnalyzeRequest, ManorAnalyzeResult, ManorDomain } from '@/types/manor';
import { inferManorDomain } from '@/lib/routing/infer-manor-domain';

export { inferManorDomain };

const MOCK_RESULTS: Record<ManorDomain, Omit<ManorAnalyzeResult, 'task_id' | 'domain'>> = {
  legal: {
    summary: '合同条款存在对我方不利的举证风险，建议优先完成证据固化，本周内发律师函明确立场，并评估仲裁管辖条款的适用性。综合来看，我方具备一定胜诉基础，但需谨慎处理质量验收标准的争议焦点。',
    requires_departments: ['xingbu', 'libu_hr'],
    risks: [
      {
        level: 'high',
        title: '举证责任分配对我方不利，间接证据证明力存疑',
        mitigation: '优先完成证据固化与公证存证，锁定关键交付节点。',
      },
      {
        level: 'medium',
        title: '管辖法院选择若失误将拖慢整体节奏',
        mitigation: '事先确认争议解决条款，优先选择对我方有利的仲裁机构。',
      },
      {
        level: 'low',
        title: '合同质量验收标准表述模糊，对方可能以此为由继续拖延',
        mitigation: '整理合同附件中的验收标准证据，形成书面确认函。',
      },
    ],
    action_cards: [
      { title: '证据固化', when: '今天就做', light: 'green', why: '证据灭失不可逆，这是所有后续动作的地基。' },
      { title: '律师函起草', when: '本周内', light: 'green', why: '正式表明立场，为后续谈判保留关键节点。' },
      { title: '合规自查', when: '本周内', light: 'yellow', why: '在对方反击前先堵上自己的漏洞。' },
      { title: '仲裁可行性评估', when: '两周内', light: 'yellow', why: '提前准备仲裁申请，缩短启动周期。' },
    ],
    citations: [
      {
        id: 'cit-001',
        code: '《中华人民共和国民法典》第五百七十七条',
        title: '违约责任',
        fullText: '当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。',
      },
      {
        id: 'cit-002',
        code: '《中华人民共和国民法典》第五百八十四条',
        title: '损失赔偿范围',
        fullText: '当事人一方不履行合同义务或者履行合同义务不符合约定，造成对方损失的，损失赔偿额应当相当于因违约所造成的损失，包括合同履行后可以获得的利益；但是，不得超过违约一方订立合同时预见到或者应当预见到的因违约可能造成的损失。',
      },
      {
        id: 'cit-003',
        code: '《中华人民共和国仲裁法》第四条',
        title: '仲裁协议要求',
        fullText: '当事人采用仲裁方式解决纠纷，应当双方自愿，达成仲裁协议。没有仲裁协议，一方申请仲裁的，仲裁委员会不予受理。',
      },
    ],
  },
  hr: {
    summary: '劳动仲裁场景中，企业需在举证和时效上占据主动。当前案件举证链存在薄弱环节，加班记录与薪资核算口径不一致，建议立即启动证据固化，并在仲裁委立案前完成书面和解评估。综合判断：本案有 60-70% 可能以和解收尾，诉讼风险可控。',
    requires_departments: ['libu_hr', 'xingbu'],
    risks: [
      { level: 'high', title: '加班记录缺失将导致仲裁被动', mitigation: '立即整理打卡记录、邮件时间戳及审批单，形成完整时间线。' },
      { level: 'medium', title: '补偿方案过低可能激化矛盾并公开化', mitigation: '内部评估 N+1 与 2N 两个方案，在员工要求升级前主动接触。' },
      { level: 'low', title: '竞业协议条款未经清晰告知，可执行性存疑', mitigation: '重新确认签署日期与员工知情同意证明文件。' },
    ],
    action_cards: [
      { title: '证据固化', when: '今天', light: 'green', why: '仲裁时效短，证据灭失不可逆。' },
      { title: '法律意见书', when: '三天内', light: 'green', why: '了解最坏场景，精准定价谈判空间。' },
      { title: '和解方案评估', when: '一周内', light: 'yellow', why: '仲裁成本与声誉损失往往大于和解金额。' },
      { title: '劳动合同规范复查', when: '本月', light: 'yellow', why: '同类风险可能在其他员工中重现。' },
    ],
    citations: [
      {
        id: 'hr-cit-001',
        code: '《中华人民共和国劳动争议调解仲裁法》第二十七条',
        title: '仲裁时效',
        fullText: '劳动争议申请仲裁的时效期间为一年。仲裁时效期间从当事人知道或者应当知道其权利被侵害之日起计算。',
      },
      {
        id: 'hr-cit-002',
        code: '《中华人民共和国劳动合同法》第四十七条',
        title: '经济补偿标准',
        fullText: '经济补偿按劳动者在本单位工作的年限，每满一年支付一个月工资的标准向劳动者支付。六个月以上不满一年的，按一年计算；不满六个月的，向劳动者支付半个月工资的经济补偿。',
      },
    ],
  },
  finance: {
    summary: '财务体检发现三处隐性压力：应收账款账期平均延长 18 天、现金流覆盖率跌至 1.3x（安全线以下）、部分费用归口混乱导致报表失真。短期内现金流可控，但若大客户账期继续拖延，Q3 将出现短暂流动性紧张窗口，需提前准备应急融资授信。',
    requires_departments: ['hubu', 'shangshu'],
    risks: [
      { level: 'high', title: '现金流覆盖率跌破 1.5x 安全线', mitigation: '启动应急授信申请，同时加强大客户账款催收。' },
      { level: 'medium', title: '应收账款前三大客户集中度超 60%', mitigation: '分散客户结构，对头部客户设置账期上限并纳入合同条款。' },
      { level: 'medium', title: '费用归口混乱，ROI 核算失真', mitigation: '重新梳理成本中心划分，启动季度财务复盘。' },
    ],
    action_cards: [
      { title: '应收账款专项核查', when: '本周', light: 'green', why: '现金流安全是公司生命线，优先级最高。' },
      { title: '应急授信申请', when: '两周内', light: 'yellow', why: '授信周期长，需提前布局，不能等到紧缺时才行动。' },
      { title: '费用归口整改', when: '本月', light: 'yellow', why: '报表失真将误导所有下游决策。' },
      { title: '季度财务复盘机制', when: '下季度前', light: 'green', why: '建立长效机制，防止问题积累。' },
    ],
  },
  ecommerce: {
    summary: '电商运营诊断发现：流量质量下降（付费流量 CPA 上升 35%）、退款率集中在 3 个 SKU（占总退款量 62%）、复购率低于行业均值。核心问题是品控与商品描述的落差，而非流量本身。建议先治退款再扩投放，避免烧钱放大问题。',
    requires_departments: ['gongbu', 'shangshu'],
    risks: [
      { level: 'high', title: '高退款 SKU 持续将触发平台算法降权', mitigation: '立即下架或限流高退款 SKU，优先处理描述与实物差异问题。' },
      { level: 'medium', title: 'CPA 上升 35% 导致投放 ROI 转负', mitigation: '暂停低 ROI 渠道，聚焦自然流量和私域运营。' },
      { level: 'low', title: '复购率低于行业均值 2 个百分点', mitigation: '建立售后跟踪和会员积分体系，提升用户粘性。' },
    ],
    action_cards: [
      { title: '高退款 SKU 紧急处理', when: '今天', light: 'red', why: '平台降权一旦触发，恢复需要 4-8 周。' },
      { title: '品控流程复查', when: '本周', light: 'green', why: '退款根因在品控，不在描述优化。' },
      { title: '投放策略收缩', when: '本周', light: 'yellow', why: '在退款率未降下来前扩投放是亏损放大器。' },
      { title: '私域建设启动', when: '本月', light: 'yellow', why: '降低对平台流量的依赖，提升复购。' },
    ],
  },
  ops: {
    summary: '运维健康度评估发现：监控覆盖率仅 64%（P0 服务中有 3 个完全无告警）、变更管理流程缺失导致近 30 天 3 次故障均来自无审批的变更、MTTR 平均 47 分钟，高于行业基准 25 分钟。核心风险是缺乏变更审批和告警盲区并存。',
    requires_departments: ['gongbu'],
    risks: [
      { level: 'high', title: '3 个 P0 服务完全无告警覆盖', mitigation: '立即为核心服务添加可用性和延迟告警，设置 oncall 轮值。' },
      { level: 'high', title: '变更无审批流程，是近期 3 次故障直接原因', mitigation: '强制变更审批，启用 feature flag 和灰度发布流程。' },
      { level: 'medium', title: 'MTTR 47min 超行业基准近一倍', mitigation: '建立 runbook 库，缩短故障定位时间。' },
    ],
    action_cards: [
      { title: '补全 P0 告警规则', when: '今天', light: 'red', why: '无告警等于无保障，生产故障无法及时感知。' },
      { title: '变更审批流程上线', when: '本周', light: 'red', why: '三次故障均来自无审批变更，必须切断风险来源。' },
      { title: 'Runbook 建设', when: '两周内', light: 'yellow', why: '减少故障恢复依赖个人经验，降低 MTTR。' },
      { title: 'Oncall 轮值机制建立', when: '本月', light: 'green', why: '确保 7×24 小时响应能力。' },
    ],
  },
  compliance: {
    summary: '合规审查发现数据处理流程存在 3 处 GDPR/个人信息保护法风险点：未经明确授权的数据收集、第三方数据共享未签署 DPA 协议、数据留存期限超过业务必要期限。若监管检查发生，最高面临营业额 4% 的罚款。建议在下一个监管窗口（约 6 周）前完成整改。',
    requires_departments: ['libu_hr', 'shangshu', 'xingbu'],
    risks: [
      { level: 'high', title: '用户数据采集未获明确授权', mitigation: '修订隐私政策，补充双重确认授权流程，下线超范围采集。' },
      { level: 'high', title: '第三方数据共享无 DPA 协议', mitigation: '立即与主要数据处理商签署 DPA，无法签署者停止数据共享。' },
      { level: 'medium', title: '数据留存超过必要期限', mitigation: '设置自动清理策略，按数据类型设定最长留存期。' },
    ],
    action_cards: [
      { title: '隐私政策修订', when: '两周内', light: 'red', why: '现行政策无法覆盖实际数据处理行为，是最直接的法律敞口。' },
      { title: 'DPA 协议签署', when: '两周内', light: 'red', why: '未签 DPA 的数据共享在监管检查时将被直接认定为违规。' },
      { title: '数据留存自动清理', when: '一个月内', light: 'yellow', why: '减少数据泄露风险面，同时符合最小化原则。' },
      { title: '合规内审机制建立', when: '季度末', light: 'green', why: '主动合规优于被动应对，建立定期内审可显著降低监管风险。' },
    ],
    citations: [
      {
        id: 'comp-cit-001',
        code: '《中华人民共和国个人信息保护法》第十三条',
        title: '处理个人信息的合法性基础',
        fullText: '符合下列情形之一的，个人信息处理者方可处理个人信息：（一）取得个人的同意；（二）为订立、履行个人作为一方当事人的合同所必要，或者按照依法制定的劳动规章制度和依法签订的集体合同实施人力资源管理所必要...',
      },
      {
        id: 'comp-cit-002',
        code: '《中华人民共和国个人信息保护法》第五十一条',
        title: '处理者安全保护义务',
        fullText: '个人信息处理者应当根据个人信息的处理目的、处理方式、个人信息的种类以及对个人权益的影响、可能存在的安全风险等，采取必要措施确保个人信息处理活动符合法律、行政法规的规定。',
      },
    ],
  },
  sales: {
    summary: '销售漏斗诊断显示：MQL→SQL 转化率 12%（行业均值 22%）、大客户（>500 万）决策链触达仅覆盖 C-1 层、平均销售周期 4.2 个月（目标 3 个月）。核心瓶颈不在线索量，而在高层决策人接触策略和提案质量。建议收缩中小客户资源，集中火力攻坚 10 个目标大客户。',
    requires_departments: ['shangshu', 'libu_hr'],
    risks: [
      { level: 'high', title: 'MQL→SQL 转化率 12% 远低于行业基准', mitigation: '优化资质评分模型，聚焦预算明确、决策周期匹配的高意向客户。' },
      { level: 'medium', title: '大客户决策链触达层级不足，止步于 C-1', mitigation: '设计高管对高管接触计划，借助第三方关系触达 CEO/CFO。' },
      { level: 'medium', title: '提案与客户痛点对齐度低，复购率不足', mitigation: '建立客户成功体系，让案例数据说话。' },
    ],
    action_cards: [
      { title: '目标大客户名单锁定', when: '本周', light: 'green', why: '资源有限，必须聚焦。10 个目标 > 100 个机会。' },
      { title: '高管触达计划制定', when: '两周内', light: 'green', why: '绕过 C-1 层是缩短销售周期的核心杠杆。' },
      { title: 'MQL 评分模型优化', when: '本月', light: 'yellow', why: '把错误的线索过滤掉，比追更多线索更有价值。' },
      { title: '客户成功案例库建设', when: '季度末', light: 'yellow', why: '真实数据是最好的提案，能显著提升转化率。' },
    ],
  },
  marketing: {
    summary: '营销效能审查发现：付费渠道整体 ROI 降至 1.8x（目标 3x）、SEO 有机流量占比仅 18%（行业均值 40%）、内容产出量大但传播率低（平均分享率 0.3%）。问题根源是创作质量不足和渠道分散，而非预算规模。建议砍掉低 ROI 渠道，重投内容质量和 SEO 基础建设。',
    requires_departments: ['shangshu'],
    risks: [
      { level: 'medium', title: '付费渠道 ROI 降至 1.8x，接近临界点', mitigation: '停止 ROI 低于 2x 的渠道投放，重新分配预算至高效渠道。' },
      { level: 'medium', title: 'SEO 流量仅 18%，过度依赖付费流量', mitigation: '建立内容 SEO 工厂，优先覆盖核心关键词聚合页。' },
      { level: 'low', title: '内容传播率低，品牌心智建设缓慢', mitigation: '聚焦垂直深度内容，而非泛化浅层内容。' },
    ],
    action_cards: [
      { title: '低 ROI 渠道暂停', when: '本周', light: 'yellow', why: '先止血再寻增量，避免预算浪费放大。' },
      { title: 'SEO 核心词布局', when: '本月', light: 'green', why: '有机流量是长期资产，越早建设复利越大。' },
      { title: '内容质量标准建立', when: '本月', light: 'green', why: '10 篇深度内容的传播力 > 100 篇浅层内容。' },
      { title: '品牌内容矩阵规划', when: '季度末', light: 'yellow', why: '内容生态需要系统规划，防止碎片化。' },
    ],
  },
  battery_pack: {
    summary: 'Pack 生产线健康评估发现：电芯一致性 CV 值超标（当前 3.2%，目标 2%）、BMS 固件版本分散（4 个版本并存）、良率 94.6%（目标 97%）。核心问题是来料管控和 BMS 版本治理，而非产线设备本身。建议本周完成 BMS 统一升级，同时升级入厂检验标准。',
    requires_departments: ['gongbu', 'hubu'],
    risks: [
      { level: 'high', title: '电芯一致性 CV 值 3.2% 超标，良率下降', mitigation: '升级入厂检验 CV 阈值至 2% 以下，拒收不合格批次。' },
      { level: 'high', title: 'BMS 固件 4 个版本并存，批次质量不可追溯', mitigation: '本周内统一升级至最新稳定版本，建立固件版本管控流程。' },
      { level: 'medium', title: '良率 94.6% 低于目标 2.4 个百分点', mitigation: '电芯分选精度提升 + BMS 统一后可回收约 1.5% 良率。' },
    ],
    action_cards: [
      { title: 'BMS 固件统一升级', when: '本周', light: 'red', why: '版本分散是最直接的追溯风险，影响批次一致性。' },
      { title: '入厂检验 CV 标准升级', when: '本周', light: 'green', why: '来料管控是良率的根本，不能靠过程弥补。' },
      { title: '电芯分选精度提升', when: '两周内', light: 'yellow', why: '与 BMS 升级协同可最大化良率提升效果。' },
      { title: '产线 SPC 管控体系建立', when: '本月', light: 'yellow', why: '统计过程控制是持续维持良率的基础设施。' },
    ],
  },
  'supply-chain': {
    summary: '供应链风险审查发现：3 类关键物料依赖单一供应商（总采购额占比 58%）、备货安全库存覆盖率仅 11 天（目标 30 天）、供应商集中于单一产区导致自然灾害和政策风险敞口大。建议本季度完成核心物料双源备份，并建立滚动库存预警机制。',
    requires_departments: ['gongbu', 'hubu'],
    risks: [
      { level: 'high', title: '3 类关键物料单一供应商，断供风险高', mitigation: '本季度内为每类关键物料开发至少 1 个备选合格供应商。' },
      { level: 'high', title: '安全库存覆盖仅 11 天，低于行业最低标准', mitigation: '提升备货至 25-30 天，关键物料建立战略库存。' },
      { level: 'medium', title: '供应商地理集中，系统性风险敞口大', mitigation: '引入跨地域供应商，尤其针对受政策影响的敏感品类。' },
    ],
    action_cards: [
      { title: '关键物料备选供应商开发', when: '本季度', light: 'red', why: '单源断供一旦发生，损失远超开发备选供应商的成本。' },
      { title: '安全库存提升计划', when: '本月', light: 'yellow', why: '11 天覆盖率是危险警戒线，需尽快提升至安全水位。' },
      { title: '供应商地理分散策略', when: '半年内', light: 'yellow', why: '系统性风险（地缘、政策、自然灾害）无法靠单一供应商对冲。' },
      { title: '滚动库存预警机制', when: '本月', light: 'green', why: '建立可视化预警，防止风险积累到临界点才发现。' },
    ],
  },
  investment: {
    summary: '投资组合健康诊断：仓位集中度高（前 3 标的占比 71%）、现金储备率 6%（建议 10-15%）、近 90 天最大回撤 -18%，夏普比率 0.67（低于目标 1.0）。核心问题是配置结构失衡而非个股选择，建议在不改变长期看法的前提下，适度降低头部仓位集中度并补充防御性资产。',
    requires_departments: ['hubu', 'qin_tian_jian'],
    risks: [
      { level: 'high', title: '前 3 标的集中度 71%，单一事件可导致组合重创', mitigation: '分批减仓至单一标的不超过 25%，分散至低相关资产。' },
      { level: 'medium', title: '现金储备不足 10%，机会成本与流动性双向受损', mitigation: '提升现金比例至 12-15%，为波动创造再配置窗口。' },
      { level: 'medium', title: '夏普比率 0.67，风险收益比低于目标', mitigation: '增加防御性资产（债券、黄金）至 15-20% 比例。' },
    ],
    action_cards: [
      { title: '止损线与仓位上限设定', when: '今天', light: 'red', why: '控制最大回撤是首要原则，规则优先于情绪。' },
      { title: '头部仓位分批减持', when: '两周内', light: 'yellow', why: '集中度过高是最大的系统性风险，分批减持可降低冲击成本。' },
      { title: '防御性资产配置', when: '本月', light: 'yellow', why: '提升夏普比率同时保留上行空间，不是放弃收益。' },
      { title: '现金储备补充', when: '本月', light: 'green', why: '市场波动时现金是最好的期权，机会窗口随时出现。' },
    ],
  },
};

const FETCH_TIMEOUT_MS = 8000;

async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 1): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return res;
      if (res.status >= 400 && res.status < 500) {
        throw new Error(`manor analyze ${res.status} (client error, no retry)`);
      }
      lastError = new Error(`manor analyze ${res.status}`);
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (err instanceof Error && err.message.includes('client error')) throw err;
    }
  }
  throw lastError;
}

/** SSE 流式事件 · 给 UI 逐个显示"7 位律师就位"的观感 */
export type ManorStreamEvent =
  | { type: 'open'; requestId: string; domain: string }
  | { type: 'stage_add'; name: string }
  | { type: 'stage_update'; name: string; status: string; message?: string }
  | { type: 'done'; plan?: Record<string, unknown>; planId?: string }
  | { type: 'error'; message: string }
  | { type: 'fallback'; reason: string; message: string }
  | { type: 'eof'; frames: number };

export const manorAdapter = {
  async analyze(req: ManorAnalyzeRequest): Promise<ManorAnalyzeResult> {
    if (API_MODE === 'mock') {
      await new Promise<void>((r) => setTimeout(r, 900));
      const mockBase = MOCK_RESULTS[req.domain] ?? MOCK_RESULTS.legal;
      return { ...mockBase, task_id: `mock-${Date.now()}`, domain: req.domain };
    }

    const res = await fetchWithRetry('/api/manor/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });

    return res.json() as Promise<ManorAnalyzeResult>;
  },

  /**
   * 流式调用 · 逐帧回调 · 拿不到 final result
   * 如需 final result，流结束后再调 `analyze()` 或从事件中自行聚合。
   *
   * 调用方负责传 AbortSignal 处理组件卸载 / 用户取消。
   */
  async *stream(
    req: ManorAnalyzeRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<ManorStreamEvent, void, void> {
    const res = await fetch('/api/manor/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`manor stream ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const chunks = buf.split('\n\n');
        buf = chunks.pop() ?? '';
        for (const chunk of chunks) {
          const lines = chunk.split('\n');
          let eventName = 'message';
          let data = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) eventName = line.slice(7).trim();
            else if (line.startsWith('data: ')) data += line.slice(6);
          }
          if (!data) continue;
          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(data);
          } catch {
            continue; // 不是 JSON 的心跳或注释
          }
          // 本端 BFF 自发事件（open / eof / fallback）· event name 带前缀
          if (eventName === 'open') {
            yield {
              type: 'open',
              requestId: String(payload.request_id ?? ''),
              domain: String(payload.domain ?? ''),
            };
            continue;
          }
          if (eventName === 'eof') {
            yield { type: 'eof', frames: Number(payload.frames ?? 0) };
            continue;
          }
          if (eventName === 'fallback') {
            yield {
              type: 'fallback',
              reason: String(payload.reason ?? ''),
              message: String(payload.message ?? ''),
            };
            continue;
          }
          // legal-agent 原生事件（默认 event=message）· 按 payload.type 分发
          const t = String(payload.type ?? '');
          if (t === 'stage_add') {
            yield { type: 'stage_add', name: String(payload.name ?? '') };
          } else if (t === 'stage_update') {
            yield {
              type: 'stage_update',
              name: String(payload.name ?? ''),
              status: String(payload.status ?? ''),
              message: payload.message as string | undefined,
            };
          } else if (t === 'done') {
            yield {
              type: 'done',
              plan: payload.plan as Record<string, unknown> | undefined,
              planId: payload.plan_id as string | undefined,
            };
          } else if (t === 'error') {
            yield { type: 'error', message: String(payload.message ?? 'upstream error') };
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },
};
