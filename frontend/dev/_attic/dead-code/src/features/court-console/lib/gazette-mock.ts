/**
 * 朝报 · mock 数据（CC-013）
 *
 * 每份朝报包含：日期 + 核心指标 + 六部排行 + 红蓝队摘要 + 公文正文
 */

export interface DailyKPI {
  label: string
  value: string
  unit: string
  delta: number   // 相比前日，正增负降
  deltaLabel: string
}

export interface ManorRank {
  rank: number
  name: string
  code: string
  domain: string
  casesTotal: number
  approvedRate: number
  avgElapsedMs: number
  highlight: string
}

export interface TeamSummary {
  team: 'red' | 'blue'
  label: string
  score: number
  wins: number
  insights: string[]
  recommendation: string
}

export interface GazetteReport {
  date: string          // YYYY-MM-DD
  dateLabel: string     // 甲子年三月廿九 style
  headline: string
  kpis: DailyKPI[]
  manorRanks: ManorRank[]
  redTeam: TeamSummary
  blueTeam: TeamSummary
  bodyText: string[]    // 公文正文，每段一项
}

const REPORTS: Record<string, GazetteReport> = {
  '2026-04-18': {
    date: '2026-04-18',
    dateLabel: '丙午年三月廿一',
    headline: '今日奏折流转顺畅，法衡台处理效率创近期新高，度支台留中待议案卷激增需关注',
    kpis: [
      { label: '今日奏折总量', value: '47', unit: '件', delta: 3, deltaLabel: '+3 件' },
      { label: '平均处理时长', value: '11.2', unit: 's', delta: -1.4, deltaLabel: '-1.4s' },
      { label: '批红率', value: '76', unit: '%', delta: 2, deltaLabel: '+2pp' },
      { label: '留中率', value: '14', unit: '%', delta: 4, deltaLabel: '+4pp ⚠' },
      { label: '最快结案', value: '3.1', unit: 's', delta: -0.8, deltaLabel: '-0.8s' },
      { label: '六部响应均值', value: '1.8', unit: 's', delta: -0.2, deltaLabel: '-0.2s' },
    ],
    manorRanks: [
      { rank: 1, name: '法衡台', code: 'falv',    domain: '法律合规', casesTotal: 12, approvedRate: 91, avgElapsedMs: 9200,  highlight: '连续 3 日批红率超 90%' },
      { rank: 2, name: '军务台', code: 'junwu',   domain: '安全风控', casesTotal: 8,  approvedRate: 87, avgElapsedMs: 10500, highlight: '驳回质量高，整改建议精准' },
      { rank: 3, name: '度支台', code: 'caizheng', domain: '财务审计', casesTotal: 9,  approvedRate: 78, avgElapsedMs: 15400, highlight: '留中率升高，等待补充材料' },
      { rank: 4, name: '外交台', code: 'waijiao', domain: '对外事务', casesTotal: 6,  approvedRate: 83, avgElapsedMs: 8900,  highlight: '处理效率稳定' },
      { rank: 5, name: '人和台', code: 'renhe',   domain: 'HR 管理',  casesTotal: 5,  approvedRate: 80, avgElapsedMs: 7100,  highlight: '平均耗时最低' },
      { rank: 6, name: '工造台', code: 'gongzao', domain: '工程技术', casesTotal: 4,  approvedRate: 75, avgElapsedMs: 11200, highlight: '复杂案件多，耗时合理' },
      { rank: 7, name: '文宣台', code: 'wenxuan', domain: '品牌传播', casesTotal: 2,  approvedRate: 100,avgElapsedMs: 5800,  highlight: '案件数少但全部批红' },
      { rank: 8, name: '商情台', code: 'shangqing',domain: '商业情报',casesTotal: 1,  approvedRate: 100,avgElapsedMs: 6400,  highlight: '深度分析获高度认可' },
    ],
    redTeam: {
      team: 'red',
      label: '红队（攻方）',
      score: 78,
      wins: 3,
      insights: [
        'GDPR 合规复查中发现赔偿上限条款漏洞，直接推动合同修改',
        '灰度切换方案驳回：错误率 2.1% 超阈，保护存量用户约 8%',
        '知识产权攻防推演：攻方胜诉概率评估达 65%',
      ],
      recommendation: '建议红队持续深化合规类审查，下周重点关注数据安全方向',
    },
    blueTeam: {
      team: 'blue',
      label: '蓝队（守方）',
      score: 72,
      wins: 2,
      insights: [
        '供应商 B 轮尽调：识别客户集中度风险，守方策略成功争取 30 天补充期',
        '知产纠纷守方：现有技术抗辩路径可行，技术规避方案完备',
      ],
      recommendation: '蓝队在财务类案件的防御表现突出，建议加强技术合规场景演练',
    },
    bodyText: [
      '臣等谨按今日朝堂运转情况，整录如下，恭呈御览。',
      '今日共受理奏折四十七件，较昨日增三件。批红三十六件，驳回四件，留中七件。法衡台居功至伟，一十二件案卷中批红十一件，批红率高达九成有余，连续三日保持高效。',
      '度支台今日留中案卷激增，主因在于数件供应商尽调奏折需补充财务资料，建议明日起加强对补充期限的催办机制，避免积压。',
      '红蓝两队今日各有斩获。红队在合规审查方向成效显著，蓝队于财务防御方向表现稳健。综合得分红队七十八分，蓝队七十二分，红队略胜。',
      '六部响应均值一点八秒，较昨日下降零点二秒，整体响应效率持续改善，系统运转良好。',
      '伏惟圣览，谨报。',
    ],
  },
  '2026-04-17': {
    date: '2026-04-17',
    dateLabel: '丙午年三月二十',
    headline: '昨日批红率回落，军务台驳回效率显著，人和台绩效方案顺利归档',
    kpis: [
      { label: '今日奏折总量', value: '44', unit: '件', delta: -2, deltaLabel: '-2 件' },
      { label: '平均处理时长', value: '12.6', unit: 's', delta: 0.8, deltaLabel: '+0.8s' },
      { label: '批红率', value: '74', unit: '%', delta: -1, deltaLabel: '-1pp' },
      { label: '留中率', value: '10', unit: '%', delta: 0, deltaLabel: '持平' },
      { label: '最快结案', value: '3.9', unit: 's', delta: 0.2, deltaLabel: '+0.2s' },
      { label: '六部响应均值', value: '2.0', unit: 's', delta: 0.1, deltaLabel: '+0.1s' },
    ],
    manorRanks: [
      { rank: 1, name: '军务台', code: 'junwu',    domain: '安全风控', casesTotal: 10, approvedRate: 80, avgElapsedMs: 11000, highlight: '驳回精准，整改建议详尽' },
      { rank: 2, name: '法衡台', code: 'falv',     domain: '法律合规', casesTotal: 11, approvedRate: 82, avgElapsedMs: 9800,  highlight: '稳定高效' },
      { rank: 3, name: '人和台', code: 'renhe',    domain: 'HR 管理',  casesTotal: 6,  approvedRate: 83, avgElapsedMs: 7200,  highlight: '绩效方案顺利归档' },
      { rank: 4, name: '外交台', code: 'waijiao',  domain: '对外事务', casesTotal: 5,  approvedRate: 80, avgElapsedMs: 9100,  highlight: '处理稳定' },
      { rank: 5, name: '度支台', code: 'caizheng', domain: '财务审计', casesTotal: 8,  approvedRate: 75, avgElapsedMs: 14200, highlight: '耗时偏长' },
      { rank: 6, name: '工造台', code: 'gongzao',  domain: '工程技术', casesTotal: 3,  approvedRate: 67, avgElapsedMs: 13400, highlight: '灰度切换驳回拉低指标' },
      { rank: 7, name: '文宣台', code: 'wenxuan',  domain: '品牌传播', casesTotal: 1,  approvedRate: 100,avgElapsedMs: 4900,  highlight: '快速归档' },
      { rank: 8, name: '商情台', code: 'shangqing', domain: '商业情报',casesTotal: 0,  approvedRate: 0,  avgElapsedMs: 0,    highlight: '今日无案卷' },
    ],
    redTeam: {
      team: 'red',
      label: '红队（攻方）',
      score: 71,
      wins: 2,
      insights: [
        '灰度切换审查：发现预发环境错误率超阈，精准拦截上线风险',
        'HR 绩效合规审核：识别 3 项劳动法边界问题',
      ],
      recommendation: '建议红队下周加强技术部署方向的风险审查深度',
    },
    blueTeam: {
      team: 'blue',
      label: '蓝队（守方）',
      score: 68,
      wins: 1,
      insights: [
        '灰度切换守方：提出旧版本兼容修复路径，预计 72h 内完成整改',
      ],
      recommendation: '蓝队需加快整改响应速度，争取明日前完成旧版本兼容修复',
    },
    bodyText: [
      '臣等谨按昨日朝堂运转情况，整录如下。',
      '昨日共受理奏折四十四件，批红三十三件，驳回五件，留中六件。军务台今日表现突出，驳回生产灰度切换奏折，理由充分，整改建议详尽具体。',
      '人和台 Q2 绩效三主线方案顺利归档，技术、产品、运营三条线评估标准已确立，即日起执行。',
      '六部响应均值二秒，较前日略有上升，需关注是否存在系统性延迟。',
      '伏惟圣览，谨报。',
    ],
  },
}

const DATES = ['2026-04-18', '2026-04-17']

export function getGazetteReport(date: string): GazetteReport {
  return REPORTS[date] ?? REPORTS['2026-04-18']!
}

export function getAvailableDates(): string[] {
  return DATES
}

export function formatDateLabel(date: string): string {
  const r = REPORTS[date]
  return r ? r.dateLabel : date
}
