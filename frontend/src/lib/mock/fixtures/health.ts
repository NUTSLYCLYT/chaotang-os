import type { HealthProfile } from '@/types/health'

export const mockHealthProfile: HealthProfile = {
  id: 'health_001',
  subjectName: '陛下',
  totalScore: 82,
  riskLevel: 'watch',
  updatedAt: '2026-04-06T09:02:00Z',
  metrics: [
    { code: 'LDL', name: '低密度脂蛋白', value: 3.8, unit: 'mmol/L', referenceRange: '< 3.4', status: 'abnormal_high', trend: 'up', trendSeries: [3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8] },
    { code: 'HDL', name: '高密度脂蛋白', value: 1.3, unit: 'mmol/L', referenceRange: '> 1.0', status: 'normal', trend: 'stable', trendSeries: [1.2, 1.25, 1.3, 1.28, 1.3, 1.32, 1.3] },
    { code: 'GLU', name: '空腹血糖', value: 5.4, unit: 'mmol/L', referenceRange: '3.9-6.1', status: 'normal', trend: 'stable', trendSeries: [5.5, 5.4, 5.3, 5.4, 5.5, 5.4, 5.4] },
    { code: 'ALT', name: '谷丙转氨酶', value: 32, unit: 'U/L', referenceRange: '< 40', status: 'normal', trend: 'down', trendSeries: [38, 37, 36, 35, 34, 33, 32] },
    { code: 'BP_S', name: '收缩压', value: 128, unit: 'mmHg', referenceRange: '< 130', status: 'borderline', trend: 'up', trendSeries: [122, 123, 125, 124, 126, 127, 128] },
    { code: 'BMI', name: 'BMI', value: 24.1, unit: '', referenceRange: '18.5-24', status: 'borderline', trend: 'stable', trendSeries: [24.0, 24.1, 24.2, 24.1, 24.0, 24.1, 24.1] },
  ],
  alerts: [
    {
      id: 'alert_001',
      level: 'watch',
      title: 'LDL 连续两次偏高',
      description: '建议饮食减少红肉与油炸，4 周后复查',
      createdAt: '2026-04-06T09:00:00Z',
      actionRequired: true,
    },
    {
      id: 'alert_002',
      level: 'watch',
      title: '收缩压呈持续上升趋势',
      description: '近 7 日平均 126 mmHg，建议减少钠摄入并监控',
      createdAt: '2026-04-06T08:30:00Z',
      actionRequired: true,
    },
    {
      id: 'alert_003',
      level: 'normal',
      title: 'ALT 指标稳步下降',
      description: '4 周内从 38 降至 32，肝功能改善，继续保持',
      createdAt: '2026-04-06T07:00:00Z',
      actionRequired: false,
    },
  ],
  interventions: [
    {
      id: 'plan_001',
      title: '4 周血脂干预计划',
      scheduledAt: '2026-04-07T00:00:00Z',
      durationDays: 28,
      ownerAgent: 'tai_yi_yuan',
      actions: [
        { id: 'a1', description: '每日步行 8000 步', category: 'exercise', status: 'planned' },
        { id: 'a2', description: '每周 3 次深海鱼类', category: 'diet', status: 'planned' },
        { id: 'a3', description: '减少精制碳水摄入', category: 'diet', status: 'planned' },
        { id: 'a4', description: '4 周后复查血脂', category: 'checkup', status: 'planned' },
      ],
    },
  ],
  visitRecommendations: [
    {
      id: 'visit_001',
      department: '内分泌科',
      specialty: '血脂管理',
      urgency: 'watch',
      reason: 'LDL 连续偏高，建议专科评估',
      suggestedWithinDays: 14,
    },
  ],
  followups: [
    { id: 'f1', title: '4 周后复查血脂', dueAt: '2026-05-04T00:00:00Z', completed: false },
    { id: 'f2', title: '年度全身体检', dueAt: '2026-10-01T00:00:00Z', completed: false },
  ],
}
