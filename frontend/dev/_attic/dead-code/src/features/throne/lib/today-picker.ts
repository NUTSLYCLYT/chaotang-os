/**
 * 陛下视图 · 今日焦点选择器
 *
 * 全局投票机制 — 从 tasks / signals / forecast 中挑出 "今天最该看的一件事"。
 * 按紧迫度 × 影响度排序，返回单一焦点 + 次要简报列表。
 */

import type { Task } from '@/types/task';
import type { IntelSignal } from '@/types/intel';
import type { ForecastScenario } from '@/types/forecast';

export type TodayFocusKind =
  | 'review_task'
  | 'running_task'
  | 'critical_signal'
  | 'warning_signal'
  | 'forecast_trigger'
  | 'empty';

export type TodayFocus =
  | {
      kind: 'review_task';
      task: Task;
      urgency: number;
      headline: string;
      reason: string;
      cta: { label: string; href: string };
      secondaryCta?: { label: string; href: string };
    }
  | {
      kind: 'running_task';
      task: Task;
      urgency: number;
      headline: string;
      reason: string;
      cta: { label: string; href: string };
    }
  | {
      kind: 'critical_signal';
      signal: IntelSignal;
      urgency: number;
      headline: string;
      reason: string;
      cta: { label: string; href: string };
      secondaryCta?: { label: string; href: string };
    }
  | {
      kind: 'warning_signal';
      signal: IntelSignal;
      urgency: number;
      headline: string;
      reason: string;
      cta: { label: string; href: string };
    }
  | {
      kind: 'forecast_trigger';
      scenario: ForecastScenario;
      urgency: number;
      headline: string;
      reason: string;
      cta: { label: string; href: string };
    }
  | {
      kind: 'empty';
      headline: string;
      reason: string;
      cta: { label: string; href: string };
    };

export interface TodayBriefing {
  focus: TodayFocus;
  /** next 3 secondary items the user should know but not act on */
  secondaries: SecondaryBriefing[];
}

export interface SecondaryBriefing {
  id: string;
  kind: 'signal' | 'task' | 'forecast' | 'health';
  title: string;
  summary: string;
  badge: string;
  href: string;
  tint: string;
}

export function pickTodayFocus(
  tasks: Task[],
  signals: IntelSignal[],
  scenarios: ForecastScenario[],
): TodayBriefing {
  // 1. Task awaiting review — highest priority, there's a pending decision
  const awaiting = tasks.find((t) => t.status === 'report_ready');
  if (awaiting) {
    return {
      focus: {
        kind: 'review_task',
        task: awaiting,
        urgency: 100,
        headline: awaiting.title,
        reason: '丞相府已呈上此事的完整呈报，恭候陛下最后定夺。',
        cta: { label: '立即过目呈报', href: `/throne/brief/${awaiting.id}` },
        secondaryCta: { label: '稍后再议', href: '/throne' },
      },
      secondaries: deriveSecondaries(tasks, signals, scenarios, awaiting.id),
    };
  }

  // 2. Critical signal — a fire
  const critical = [...signals]
    .filter((s) => s.level === 'critical')
    .sort((a, b) => (b.impactScore ?? 0) - (a.impactScore ?? 0))[0];
  if (critical) {
    return {
      focus: {
        kind: 'critical_signal',
        signal: critical,
        urgency: 95,
        headline: critical.title,
        reason: `锦衣卫急报 — ${critical.regionLabel} · ${critical.industry}。臣以为当立即定夺对策。`,
        cta: { label: '查看详情并下令', href: `/throne/compose?from=${critical.id}` },
        secondaryCta: { label: '交给丞相办理', href: `/intel/${critical.id}` },
      },
      secondaries: deriveSecondaries(tasks, signals, scenarios, critical.id),
    };
  }

  // 3. Running task — keep user engaged
  const running = tasks.find(
    (t) => t.status === 'running' || t.status === 'aggregating' || t.status === 'planning',
  );
  if (running) {
    return {
      focus: {
        kind: 'running_task',
        task: running,
        urgency: 70,
        headline: running.title,
        reason: '六部正在办理此事，陛下可随时过问进展，亦可稍后等候呈报。',
        cta: { label: '查看办理进展', href: `/command-center/${running.id}` },
      },
      secondaries: deriveSecondaries(tasks, signals, scenarios, running.id),
    };
  }

  // 4. Warning signal
  const warning = [...signals]
    .filter((s) => s.level === 'warning')
    .sort((a, b) => (b.impactScore ?? 0) - (a.impactScore ?? 0))[0];
  if (warning) {
    return {
      focus: {
        kind: 'warning_signal',
        signal: warning,
        urgency: 55,
        headline: warning.title,
        reason: '锦衣卫禀报 — 此事尚未危急，但值得陛下留意。',
        cta: { label: '查看详情', href: `/intel/${warning.id}` },
      },
      secondaries: deriveSecondaries(tasks, signals, scenarios, warning.id),
    };
  }

  // 5. Forecast high-probability
  const forecast = [...scenarios]
    .filter((s) => s.probability > 0.4 && s.riskWindows.length > 0)
    .sort((a, b) => b.probability - a.probability)[0];
  if (forecast) {
    return {
      focus: {
        kind: 'forecast_trigger',
        scenario: forecast,
        urgency: 45,
        headline: forecast.label,
        reason: `钦天监推演 — 此情景概率 ${Math.round(forecast.probability * 100)}%，早作准备为上。`,
        cta: { label: '查看推演详情', href: `/forecast/${forecast.id}` },
      },
      secondaries: deriveSecondaries(tasks, signals, scenarios, forecast.id),
    };
  }

  // 6. Empty — invite user to begin
  return {
    focus: {
      kind: 'empty',
      headline: '今日朝堂清明，尚无急务',
      reason: '陛下可下达新的旨意，或巡视六部近况。',
      cta: { label: '下达新旨', href: '/throne/compose' },
    },
    secondaries: deriveSecondaries(tasks, signals, scenarios, null),
  };
}

function deriveSecondaries(
  tasks: Task[],
  signals: IntelSignal[],
  scenarios: ForecastScenario[],
  excludeId: string | null,
): SecondaryBriefing[] {
  const out: SecondaryBriefing[] = [];

  // Top non-excluded warning signal
  const signal = signals.find(
    (s) => s.id !== excludeId && (s.level === 'warning' || s.level === 'watch'),
  );
  if (signal) {
    out.push({
      id: signal.id,
      kind: 'signal',
      title: signal.title,
      summary: signal.summary.slice(0, 60) + (signal.summary.length > 60 ? '…' : ''),
      badge: signal.regionLabel,
      href: `/intel/${signal.id}`,
      tint: '#F5A524',
    });
  }

  // Base forecast scenario
  const base = scenarios.find((s) => s.name === 'base' && s.id !== excludeId);
  if (base) {
    out.push({
      id: base.id,
      kind: 'forecast',
      title: base.label,
      summary: `中策概率 ${Math.round(base.probability * 100)}% · ${base.riskWindows.length} 个风险窗口`,
      badge: '钦天监',
      href: `/forecast/${base.id}`,
      tint: '#F0C66A',
    });
  }

  // Most recent running or completed task
  const recentTask = tasks.find(
    (t) =>
      t.id !== excludeId &&
      (t.status === 'running' || t.status === 'reviewed' || t.status === 'archived'),
  );
  if (recentTask) {
    out.push({
      id: recentTask.id,
      kind: 'task',
      title: recentTask.title,
      summary: recentTask.rawCommand.slice(0, 60) + (recentTask.rawCommand.length > 60 ? '…' : ''),
      badge: '六部办理',
      href: `/command-center/${recentTask.id}`,
      tint: '#6BA0FF',
    });
  }

  return out.slice(0, 3);
}
