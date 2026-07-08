/**
 * 朝堂 OS V2 · 复盘合成器
 *
 * 在 V1 后端尚未提供 retrospective 字段前，根据 Task 的现有属性
 * （status / taskType / 参与部门 / 时间）合成一份占位复盘。
 *
 * 标记 synthetic=true，UI 必须明确显示"演示数据"，避免误导。
 *
 * 触发条件：
 * - 任务处于归档态（archived / reviewed / report_ready）
 * - 任务尚无 retrospective 字段
 *
 * 一旦后端提供真数据，此合成器自动让位（不覆盖真数据）。
 */

import type { Task, TaskRetrospective } from '@/types/task';
import { AGENT_META } from '@/types/agent';

const ARCHIVED_STATUSES = new Set(['archived', 'reviewed', 'report_ready']);

/** 任务类型 → 占位复盘模板 */
const TYPE_TEMPLATES: Record<
  string,
  Pick<TaskRetrospective, 'successes' | 'failures' | 'lessons'>
> = {
  analysis: {
    successes: ['多源数据交叉验证完成', '关键指标口径已统一'],
    failures: ['原始数据时延 24h，未纳入最新窗口'],
    lessons: ['分析任务固定每日 09:00 启动以保证数据时效'],
  },
  strategy: {
    successes: ['多部门联合编排，无依赖断点', '决策选项呈三档对比'],
    failures: ['长期影响评估缺少敏感度分析'],
    lessons: ['战略类任务必须包含 3 个情景 + 各情景置信度'],
  },
  intel: {
    successes: ['信号交叉验证 ≥3 源', '可信度评分覆盖完整'],
    failures: ['部分国别情报源时延偏高'],
    lessons: ['情报合规要求 72h 内时效'],
  },
  forecast: {
    successes: ['情景树覆盖 3 档', '触发条件量化清晰'],
    failures: ['长尾情景缺乏数据支撑'],
    lessons: ['推演任务必须明示"非事实"免责'],
  },
  health: {
    successes: ['指标解读基于权威指南', '风险分层清晰'],
    failures: [],
    lessons: ['健康任务全程脱敏，导出前二次确认'],
  },
  execution: {
    successes: ['任务分解到周粒度', '里程碑责任到部'],
    failures: ['资源占用预估偏低'],
    lessons: ['执行类任务必须含资源消耗台账'],
  },
  compliance: {
    successes: ['合规清单覆盖完整', '风险窗口标注清晰'],
    failures: ['跨司法辖区差异未充分对比'],
    lessons: ['合规任务必须按辖区分组结论'],
  },
  creative: {
    successes: ['创意方向 ≥3 个'],
    failures: ['执行成本评估缺失'],
    lessons: ['创意类必须配执行可行性评分'],
  },
};

/** 任务类型 → 评分（保守估计） */
const TYPE_SCORE: Record<string, 1 | 2 | 3 | 4 | 5> = {
  analysis: 4,
  strategy: 4,
  intel: 4,
  forecast: 3,
  health: 4,
  execution: 4,
  compliance: 3,
  creative: 3,
  general: 3,
};

/**
 * 根据任务现状合成复盘。**仅在缺失时调用**。
 * 调用方负责保证 task.retrospective 不存在。
 */
export function synthesizeRetrospective(task: Task): TaskRetrospective {
  const taskType = task.plan?.taskType ?? 'general';
  const template = TYPE_TEMPLATES[taskType] ?? {
    successes: ['任务完成基本目标'],
    failures: [],
    lessons: ['复用本次编排路径作为模板'],
  };
  const score = TYPE_SCORE[taskType] ?? 3;

  // 基于参与部门生成 playbook
  const agents = task.plan?.assignedAgents ?? [];
  const playbook =
    agents.length > 0
      ? agents
          .slice(0, 4)
          .map((c) => AGENT_META[c]?.nameCn ?? c)
          .join(' → ')
      : undefined;

  return {
    score,
    successes: template.successes,
    failures: template.failures,
    lessons: template.lessons,
    ...(playbook && { playbook }),
    authoredBy: '丞相 · 自动归纳',
    authoredAt: task.updatedAt,
    synthetic: true,
  };
}

/**
 * 给一组任务批量补齐合成复盘。
 * - 已有 retrospective 的任务**不动**
 * - 非归档态任务**不动**
 */
export function backfillRetrospectives(tasks: Task[]): Task[] {
  return tasks.map((task) => {
    if (task.retrospective) return task;
    if (!ARCHIVED_STATUSES.has(task.status)) return task;
    return { ...task, retrospective: synthesizeRetrospective(task) };
  });
}
