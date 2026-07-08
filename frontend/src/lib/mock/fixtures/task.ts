import type { Task, CreateTaskDto } from '@/types/task'

export const mockTasks: Task[] = [
  {
    id: 'task_001',
    title: '制定 2027 年新品发布战略',
    rawCommand:
      '制定 2027 年新品发布战略，需要财务评估、技术可行性、营销策略、竞品扫描、全球监管情报和未来推演',
    status: 'running',
    mode: 'hybrid',
    createdAt: '2026-04-06T10:11:00Z',
    updatedAt: '2026-04-06T10:14:30Z',
    plan: {
      id: 'plan_001',
      taskId: 'task_001',
      intent:
        '用户要求制定 2027 年新品发布战略，属战略规划类任务，需户部、工部、礼部、兵部、锦衣卫、钦天监六方协同完成。',
      taskType: 'strategy',
      assignedAgents: [
        'hu_bu',
        'gong_bu',
        'li_bu_rites',
        'bing_bu',
        'jin_yi_wei',
        'qin_tian_jian',
      ],
      dependencyGraph: {
        st_6: ['st_1', 'st_2', 'st_4', 'st_5'],
      },
      aggregationStrategy: 'weighted_merge',
      escalationFlags: ['strategic_with_forecast', 'multi_department_coordination'],
      clarificationNeeded: false,
      createdAt: '2026-04-06T10:12:00Z',
    },
  },
  {
    id: 'task_002',
    title: '组织架构季度复盘',
    rawCommand: '对当前组织架构做 Q1 复盘，识别岗位缺口和绩效瓶颈',
    status: 'draft',
    mode: 'hybrid',
    createdAt: '2026-04-06T11:05:00Z',
    updatedAt: '2026-04-06T11:05:00Z',
  },
  {
    id: 'task_003',
    title: '陛下本周健康体检解读',
    rawCommand: '解读本周体检报告，重点看血脂与肝功能指标',
    status: 'report_ready',
    mode: 'hybrid',
    createdAt: '2026-04-06T08:40:00Z',
    updatedAt: '2026-04-06T09:02:00Z',
  },
  {
    id: 'task_004',
    title: '美股 NVIDIA 估值研判',
    rawCommand: '评估当前 NVIDIA 股价是否高估，同时扫描全球 AI 监管动态',
    status: 'archived',
    mode: 'hybrid',
    createdAt: '2026-04-05T15:22:00Z',
    updatedAt: '2026-04-05T16:10:00Z',
  },
  {
    id: 'task_005',
    title: '东南亚渠道试点是否立即扩编',
    rawCommand: '评估东南亚渠道试点是否要从验证阶段进入全面扩编，补齐财务、交付与风险边界判断',
    status: 'report_ready',
    mode: 'hybrid',
    createdAt: '2026-04-06T09:10:00Z',
    updatedAt: '2026-04-06T09:28:00Z',
    plan: {
      id: 'plan_005',
      taskId: 'task_005',
      intent:
        '用户要求判断东南亚渠道试点是否应立即扩编，属扩张决策类任务，需财务、交付、法务与市场协同给出可执行边界。',
      taskType: 'strategy',
      assignedAgents: ['hu_bu', 'gong_bu', 'li_bu_rites', 'jin_yi_wei'],
      dependencyGraph: {},
      aggregationStrategy: 'weighted_merge',
      escalationFlags: ['market-expansion', 'cross-border-risk'],
      clarificationNeeded: false,
      createdAt: '2026-04-06T09:12:00Z',
    },
  },
  {
    id: 'task_006',
    title: '北美法律顾问团队是否前置扩容',
    rawCommand:
      '评估北美法律顾问团队是否应在下季度前置扩容，补齐预算、交付压力与跨境合规判断',
    status: 'report_ready',
    mode: 'hybrid',
    createdAt: '2026-04-06T09:32:00Z',
    updatedAt: '2026-04-06T09:46:00Z',
    plan: {
      id: 'plan_006',
      taskId: 'task_006',
      intent:
        '用户要求判断北美法律顾问团队是否应提前扩容，属资源配置类决策，需财务、交付与合规多方联合给出边界。',
      taskType: 'strategy',
      assignedAgents: ['hu_bu', 'gong_bu', 'xing_bu', 'jin_yi_wei'],
      dependencyGraph: {},
      aggregationStrategy: 'weighted_merge',
      escalationFlags: ['legal-ops-scaling', 'cross-border-compliance'],
      clarificationNeeded: false,
      createdAt: '2026-04-06T09:34:00Z',
    },
  },
  {
    id: 'task_007',
    title: '欧洲交付支持团队是否提前扩岗',
    rawCommand:
      '判断欧洲交付支持团队是否应在旺季前提前扩岗，补齐预算、服务压力与制度边界分析',
    status: 'report_ready',
    mode: 'hybrid',
    createdAt: '2026-04-06T09:48:00Z',
    updatedAt: '2026-04-06T10:02:00Z',
    plan: {
      id: 'plan_007',
      taskId: 'task_007',
      intent:
        '用户要求判断欧洲交付支持团队是否应提前扩岗，属交付资源配置决策，需财务、组织与风险控制联合给出建议。',
      taskType: 'strategy',
      assignedAgents: ['hu_bu', 'li_bu', 'gong_bu', 'xing_bu'],
      dependencyGraph: {},
      aggregationStrategy: 'weighted_merge',
      escalationFlags: ['delivery-scaling', 'seasonal-capacity'],
      clarificationNeeded: false,
      createdAt: '2026-04-06T09:50:00Z',
    },
  },
]

export function createMockTask(dto: CreateTaskDto): Task {
  const id = `task_${Date.now()}`
  const now = new Date().toISOString()
  const task: Task = {
    id,
    title: dto.title ?? dto.rawCommand.slice(0, 40),
    rawCommand: dto.rawCommand,
    description: dto.description,
    status: 'submitted',
    mode: dto.mode ?? 'hybrid',
    createdAt: now,
    updatedAt: now,
  }
  mockTasks.unshift(task)
  return task
}
