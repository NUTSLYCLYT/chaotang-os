import type { Report } from '@/types/report'

export const mockReports: Report[] = [
  // ===== 报告 1：2027 战略规划（完整 6 段） =====
  {
    id: 'report_strategy_2027',
    taskId: 'task_001',
    template: 'strategy_report',
    title: '2027 年新品发布战略呈报',
    subtitle: '丞相府奉旨呈报 · 战略规划类',
    createdAt: '2026-04-06T10:30:00Z',
    sections: [
      {
        id: 's1',
        title: '御前摘要',
        kind: 'text',
        content: `陛下御前呈报：制定 2027 年新品发布战略

臣等奉旨研议本案。本案属战略规划类，臣等已调度户部、工部、礼部、钦天监四部协同，并由钦天监推演前瞻。

核心发现：
  · 户部：H1 营收 +22%，但毛利率持续下滑，新品 ROI 测算 2.4x
  · 工部：技术栈复用度 75%，12 周可交付，团队 6 人
  · 礼部：320 万核心人群，建议小红书+抖音双渠道
  · 钦天监：2026 Q4 为关键政策窗口，2027 Q3 后窗口关闭

综合研判：本案具备落地条件，但时间窗口紧迫，需要 Q4 抢跑。`,
        order: 1,
      },
      {
        id: 's2',
        title: '核心建议',
        kind: 'markdown',
        content: `【钦天监】基准情形 +22.5% 增长可期，建议 Q4 抢跑布局，保留悲观情形撤退方案

【户部】严控新品毛利率不低于 35%，避免重蹈 H1 毛利下滑覆辙

【工部】采用复用架构 12 周交付，预留 2 周第三方接口验证

【礼部】小红书+抖音双渠道集中投放，CAC 控制在 ¥285 以内`,
        order: 2,
      },
      {
        id: 's3',
        title: '各部结论',
        kind: 'list',
        content: [
          {
            agentCode: 'hu_bu',
            departmentName: '户部',
            summary: 'H1 营收 ¥2,480 万 +22%，毛利率从 34% 降至 30.2%。新品维持 35% 毛利可达 ROI 2.4x。',
            confidence: 0.88,
            keyPoints: ['revenue: ¥2,480万', 'yoy: +22%', 'projectedROI: 2.4x'],
          },
          {
            agentCode: 'gong_bu',
            departmentName: '工部',
            summary: '技术栈复用 75%，12 周交付，6 人团队，A- 评级',
            confidence: 0.85,
            keyPoints: ['techRating: A-', 'devWeeks: 12', 'teamSize: 6'],
          },
          {
            agentCode: 'li_bu_rites',
            departmentName: '礼部',
            summary: '320 万核心人群，主打「专业×轻奢×懂你」，CAC ¥285',
            confidence: 0.82,
            keyPoints: ['targetSize: 320万', 'estimatedCAC: ¥285'],
          },
          {
            agentCode: 'qin_tian_jian',
            departmentName: '钦天监',
            summary: '2026 Q4 政策红利窗口紧迫，期望 +22.5% 增长，警惕行业集中度上升',
            confidence: 0.7,
            keyPoints: ['horizon: 2026 Q4 - 2027 Q3', 'expectedValue: +22.5% 增长'],
          },
        ],
        order: 3,
      },
      {
        id: 's4',
        title: '风险提示',
        kind: 'text',
        content: `发现以下 4 项风险，请陛下明察：

1. 【户部】毛利率连续两个季度下滑
2. 【工部】第三方接口依赖未完全验证
3. 【钦天监】前瞻威胁：行业集中度加速提升
4. 【钦天监】若错过 Q4 窗口，进入门槛大幅提高`,
        order: 4,
      },
      {
        id: 's5',
        title: '钦天推演',
        kind: 'text',
        content: `钦天监推演：2026 Q4 - 2027 Q3 为关键窗口。监管趋严概率 85%，AI 技术拐点将于 2027 Q1 出现。

关键窗口：
  · 2026 Q4 — 政策红利窗口（紧迫度: high）
  · 2027 Q1 — AI 技术采纳临界点（紧迫度: medium）

概率情景：
  · 乐观情景（概率 30%）: +52% 增长
  · 基准情景（概率 50%）: +22% 增长
  · 悲观情景（概率 20%）: -5% 微跌

期望值: +22.5% 增长

核心威胁：行业 CR3 将从 42% 跃升至 60%，2027 Q3 后窗口关闭`,
        order: 5,
      },
      {
        id: 's6',
        title: '批示动作',
        kind: 'text',
        content: `请陛下批示以下事项：

1. 本案各部研判一致，臣等把握较大，建议陛下准奏推进。
2. 风险共 4 项，主要集中在毛利率与时间窗口，需同步制定应对方案。
3. 时间窗口紧迫（2026 Q4 政策红利期），建议批示后立即启动。
4. 批示后将由史官归档，沉淀为日后参考。`,
        order: 6,
      },
    ],
    metadata: {
      author: '丞相府',
      audience: '陛下 / 董事会',
      version: 1,
      contributingAgents: ['prime_minister', 'hu_bu', 'gong_bu', 'li_bu_rites', 'qin_tian_jian'],
    },
  },

  // ===== 报告 2：Q1 全球情报简报 =====
  {
    id: 'report_q1_intel',
    template: 'intel_brief',
    title: 'Q1 全球情报简报',
    subtitle: '锦衣卫每周呈报 · 第 14 期',
    createdAt: '2026-04-06T08:00:00Z',
    sections: [
      {
        id: 's1',
        title: '本周热点',
        kind: 'text',
        content: `本周锦衣卫共捕获 12 条全球关键信号，涵盖欧盟 / 美国 / 日韩 / 东南亚 / 中东 / 南美六大区域。

核心事件：
  · 欧盟 AI Act 配套细则加速落地（危急级）
  · 韩国三星 HBM4 量产冲击国内存储（危急级）
  · 美联储释放紧缩信号（警报级）
  · 中东地缘紧张度继续上升（警报级）`,
        order: 1,
      },
      {
        id: 's2',
        title: '风险雷达',
        kind: 'text',
        content: `本周捕获 5 条风险信号：

1. 欧盟 AI Act 合规边界收紧 · 影响分 86
2. 韩国三星 HBM4 出货超预期 · 影响分 88
3. 美联储暗示暂缓降息 · 影响分 78
4. 中东航线风险指数 +12% · 影响分 74
5. 俄罗斯能源制裁扩大 · 影响分 76

平均影响分 80.4，整体风险偏高。建议陛下关注欧盟 + 韩国两项危急级信号。`,
        order: 2,
      },
      {
        id: 's3',
        title: '机会捕获',
        kind: 'text',
        content: `本周捕获 6 条机会信号：

1. 东南亚 AI 基础设施投资窗口打开
2. 日本半导体材料出口政策松动
3. 印度股市资金净流入创纪录
4. 巴西 200 亿美元绿色能源计划
5. 澳大利亚稀土出口配额扩容
6. 非洲数字贸易协定生效

东南亚和巴西两个方向值得深度跟踪。`,
        order: 3,
      },
      {
        id: 's4',
        title: '情报建议',
        kind: 'markdown',
        content: `1. 欧盟 + 韩国危急级信号已一键转派兵部 + 刑部
2. 东南亚机会已转派户部 + 兵部评估
3. 建议下周重点跟踪：AI Act 细则草案 / 三星 HBM4 定价 / 美联储会议纪要`,
        order: 4,
      },
    ],
    metadata: {
      author: '锦衣卫',
      audience: '陛下 / 兵部 / 钦天监',
      version: 1,
      contributingAgents: ['jin_yi_wei', 'bing_bu', 'qin_tian_jian'],
    },
  },

  // ===== 报告 3：陛下健康周报 =====
  {
    id: 'report_health_weekly',
    template: 'health_report',
    title: '陛下本周健康简报',
    subtitle: '太医院奉旨呈报',
    createdAt: '2026-04-06T09:15:00Z',
    sections: [
      {
        id: 's1',
        title: '总体评分',
        kind: 'text',
        content: `陛下本周健康总分 82 / 100，风险等级为「关注」。

较上周持平，整体稳定。太医院已识别 2 项需要关注的指标异常，建议启动 4 周干预计划。`,
        order: 1,
      },
      {
        id: 's2',
        title: '异常指标',
        kind: 'text',
        content: `1. LDL 低密度脂蛋白 3.8 mmol/L（参考 < 3.4），连续两周偏高，趋势：上升
2. 收缩压 128 mmHg（参考 < 130），连续 5 日临界，趋势：上升
3. BMI 24.1（参考 18.5-24），临界偏高

其余 4 项指标均在正常范围，其中 ALT 从 38 降至 32，肝功能改善明显。`,
        order: 2,
      },
      {
        id: 's3',
        title: '干预计划',
        kind: 'markdown',
        content: `【4 周血脂干预计划】

Week 1: 每日步行 8000 步
Week 2: 每周 3 次深海鱼类
Week 3: 减少精制碳水摄入
Week 4: 复查血脂`,
        order: 3,
      },
      {
        id: 's4',
        title: '就诊建议',
        kind: 'text',
        content: `建议 14 天内前往内分泌科进行血脂专项评估。

下次全身体检：2026 年 10 月。`,
        order: 4,
      },
    ],
    metadata: {
      author: '太医院',
      audience: '陛下',
      version: 1,
      contributingAgents: ['tai_yi_yuan'],
    },
  },
]
