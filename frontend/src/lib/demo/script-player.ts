/**
 * 朝堂 OS V2 · 剧本客户端播放器
 *
 * 纯前端播放：按 timeline mutate app-store，
 * 让 /overview 和 /command-center 看起来像真实运行。
 *
 * 不依赖后端，不需要 WebSocket，不需要 SSE。
 */

import type { DemoScript } from './demo-scripts';
import type { Task, TaskPlan, TaskStatus } from '@/types/task';
import type { AgentRun, AgentCode, RiskLevel } from '@/types/agent';
import type { Report } from '@/types/report';
import { useAppStore } from '@/lib/store/app-store';

/* ==========================================================================
   辅助函数
   ========================================================================== */

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();

function makeTaskId() {
  return `task_demo_${Date.now()}`;
}

function inferRiskLevel(riskFlags: string[]): RiskLevel | undefined {
  if (riskFlags.length === 0) return undefined;
  const text = riskFlags.join(' ');
  if (/严重|危急|critical|danger|重大/.test(text)) return 'critical';
  if (/连续|下滑|下降|警报|高风险/.test(text)) return 'high';
  if (riskFlags.length >= 2) return 'medium';
  return 'low';
}

/* ==========================================================================
   播放器控制
   ========================================================================== */

let cancelToken = { cancelled: false };

/**
 * 停止当前播放
 */
export function stopDemoScript() {
  cancelToken.cancelled = true;
  useAppStore.setState({ demoPlayingScriptId: null });
}

/**
 * 播放剧本 —— 异步函数，调用方可不 await
 *
 * 生命周期：
 *   submitted (0ms)
 *     → interpreting (immediately)
 *     → planning (interpretingDelay)    ← TaskPlan 落盘
 *     → assigned (planningDelay)        ← AgentRun 创建
 *     → running (immediately)
 *       └─ 逐部门：running → completed (perDepartmentDelay)
 *     → aggregating (after all depts)
 *     → report_ready (aggregatingDelay) ← Report 落盘
 */
export async function playDemoScript(script: DemoScript): Promise<void> {
  // 取消之前可能正在进行的播放
  cancelToken.cancelled = true;
  const myToken = { cancelled: false };
  cancelToken = myToken;

  const store = useAppStore.getState();
  store.setDemoPlayingScript(script.id);

  const taskId = makeTaskId();
  const createdAt = now();

  /* ----- Phase 1: submitted ----- */
  const baseTask: Task = {
    id: taskId,
    title: script.defaultTitle,
    rawCommand: script.defaultRawCommand,
    status: 'submitted' as TaskStatus,
    mode: 'scripted',
    createdAt,
    updatedAt: createdAt,
  };
  store.addTask(baseTask);
  store.selectTask(taskId);

  await delay(300);
  if (myToken.cancelled) return;

  /* ----- Phase 2: interpreting ----- */
  store.updateTask(taskId, { status: 'interpreting', updatedAt: now() });
  await delay(script.timeline.interpretingDelay);
  if (myToken.cancelled) return;

  /* ----- Phase 3: planning (attach plan) ----- */
  const plan: TaskPlan = {
    id: `plan_${taskId}`,
    taskId,
    intent: script.plan.intent,
    taskType: script.plan.taskType,
    assignedAgents: script.plan.departments,
    dependencyGraph: script.plan.subtasks.reduce<Record<string, string[]>>((acc, st) => {
      if (st.dependsOn.length > 0) acc[st.id] = st.dependsOn;
      return acc;
    }, {}),
    aggregationStrategy: script.plan.aggregationStrategy,
    escalationFlags: script.plan.escalationFlags,
    clarificationNeeded: false,
    createdAt: now(),
  };
  store.updateTask(taskId, { status: 'planning', plan, updatedAt: now() });
  await delay(script.timeline.planningDelay);
  if (myToken.cancelled) return;

  /* ----- Phase 4: assigned (create AgentRun for each subtask) ----- */
  store.updateTask(taskId, { status: 'assigned', updatedAt: now() });

  // 为每个子任务创建一个 AgentRun
  const subtaskToRunId = new Map<string, string>();
  for (const st of script.plan.subtasks) {
    const runId = `run_${taskId}_${st.id}`;
    subtaskToRunId.set(st.id, runId);
    const run: AgentRun = {
      id: runId,
      taskId,
      subtaskId: st.id,
      agentCode: st.assignedDepartment,
      state: 'assigned',
      progressPct: 0,
      currentTaskTitle: st.description,
      isWaitingDependency: st.dependsOn.length > 0,
      hasReported: false,
    };
    store.upsertAgentRun(run);
  }

  await delay(400);
  if (myToken.cancelled) return;

  /* ----- Phase 5: running ----- */
  store.updateTask(taskId, { status: 'running', updatedAt: now() });

  // 按 priority 分层执行：同层并行，层与层间串行
  const layers = groupByPriority(script.plan.subtasks);
  for (const layer of layers) {
    // 同层的部门依次启动（interleaved），然后统一等待 perDepartmentDelay 后结束
    const runningRuns: { subtaskId: string; agentCode: AgentCode }[] = [];

    // 启动这一层所有子任务：标记为 running
    for (const st of layer) {
      if (myToken.cancelled) return;
      const runId = subtaskToRunId.get(st.id)!;
      store.upsertAgentRun({
        id: runId,
        taskId,
        subtaskId: st.id,
        agentCode: st.assignedDepartment,
        state: 'running',
        progressPct: 20,
        currentTaskTitle: st.description,
        isWaitingDependency: false,
        hasReported: false,
        startedAt: now(),
      });
      runningRuns.push({ subtaskId: st.id, agentCode: st.assignedDepartment });
      // 错开 300ms 让视觉上看到"依次启动"
      await delay(300);
    }

    // 渐进推进 progress
    for (let p = 40; p <= 80; p += 20) {
      if (myToken.cancelled) return;
      for (const st of layer) {
        const runId = subtaskToRunId.get(st.id)!;
        store.upsertAgentRun({
          id: runId,
          taskId,
          subtaskId: st.id,
          agentCode: st.assignedDepartment,
          state: 'running',
          progressPct: p,
          currentTaskTitle: st.description,
          isWaitingDependency: false,
          hasReported: false,
          startedAt: now(),
        });
      }
      await delay(script.timeline.perDepartmentDelay / 4);
    }

    // 每个子任务的 output 收尾
    for (const st of layer) {
      if (myToken.cancelled) return;
      const runId = subtaskToRunId.get(st.id)!;
      const output = script.departmentOutputs.find(
        (o) => o.subtaskId === st.id && o.department === st.assignedDepartment,
      );
      store.upsertAgentRun({
        id: runId,
        taskId,
        subtaskId: st.id,
        agentCode: st.assignedDepartment,
        state: 'completed',
        progressPct: 100,
        currentTaskTitle: st.description,
        latestSummary: output?.summary,
        riskLevel: inferRiskLevel(output?.riskFlags ?? []),
        confidence: output?.confidence,
        isWaitingDependency: false,
        hasReported: true,
        completedAt: now(),
      });
    }

    await delay(400);
  }

  /* ----- Phase 6: aggregating ----- */
  if (myToken.cancelled) return;
  store.updateTask(taskId, { status: 'aggregating', updatedAt: now() });
  await delay(script.timeline.aggregatingDelay);
  if (myToken.cancelled) return;

  /* ----- Phase 7: report_ready ----- */
  const report: Report = {
    id: `report_${taskId}`,
    taskId,
    template: 'executive_digest',
    title: `${script.defaultTitle} · 御前呈报`,
    createdAt: now(),
    sections: [
      { id: 's1', title: '御前摘要', kind: 'text', content: script.report.executiveSummary, order: 1 },
      { id: 's2', title: '核心建议', kind: 'markdown', content: script.report.coreRecommendations, order: 2 },
      { id: 's3', title: '各部结论', kind: 'list', content: script.report.departmentConclusions, order: 3 },
      { id: 's4', title: '风险提示', kind: 'text', content: script.report.riskWarnings, order: 4 },
      { id: 's5', title: '钦天推演', kind: 'text', content: script.report.observatoryForecast, order: 5 },
      { id: 's6', title: '批示动作', kind: 'text', content: script.report.reviewActions, order: 6 },
    ],
    metadata: {
      author: '丞相府',
      audience: '陛下',
      version: 1,
      contributingAgents: ['prime_minister', ...script.plan.departments],
    },
  };

  const taskUpdate: Partial<Task> = { status: 'report_ready', finalReportId: report.id, updatedAt: now() };
  if (script.manorReport) {
    taskUpdate.manorReport = script.manorReport;
  }
  store.updateTask(taskId, taskUpdate);
  store.addReport(report);
  store.setDemoPlayingScript(null);
}

/* ==========================================================================
   辅助：按 priority 分层
   ========================================================================== */

function groupByPriority<T extends { priority: number }>(items: T[]): T[][] {
  const map = new Map<number, T[]>();
  for (const item of items) {
    const arr = map.get(item.priority) ?? [];
    arr.push(item);
    map.set(item.priority, arr);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, arr]) => arr);
}
