/**
 * 陛下视图 · 白话翻译器
 *
 * 把技术化的状态字符串翻译成决策者听得懂的话。
 * 所有面向 /throne 的组件都应该走这里，避免直接暴露 enum value。
 */

import type { TaskStatus, ExecutionMode, TaskType, AggregationStrategy } from '@/types/task';
import type { IntelLevel, IntelCategory, IntelCredibility } from '@/types/intel';
import type { AgentState } from '@/types/agent';
import type { HealthRiskLevel } from '@/types/health';

/* ==========================================================================
   Task status
   ========================================================================== */

export function taskStateInPlainWords(status: TaskStatus): string {
  switch (status) {
    case 'draft':         return '尚未发出';
    case 'submitted':     return '已呈上';
    case 'interpreting':  return '丞相正在研判意图';
    case 'planning':      return '丞相正在分派差事';
    case 'assigned':      return '各部已就位';
    case 'running':       return '六部正在办理';
    case 'aggregating':   return '丞相正在汇总结论';
    case 'report_ready':  return '呈报已备好 · 待陛下过目';
    case 'reviewed':      return '陛下已批示';
    case 'archived':      return '已入史馆';
    case 'failed':        return '庄园暂时无响应';
  }
}

export function taskStateEmoji(status: TaskStatus): string {
  switch (status) {
    case 'draft':
    case 'submitted':
      return '📜';
    case 'interpreting':
    case 'planning':
      return '🤔';
    case 'assigned':
    case 'running':
      return '⚙️';
    case 'aggregating':
      return '📊';
    case 'report_ready':
      return '📨';
    case 'reviewed':
      return '✅';
    case 'archived':
      return '📚';
    case 'failed':
      return '⚠️';
  }
}

export function executionModeInPlainWords(mode: ExecutionMode): string {
  switch (mode) {
    case 'scripted': return '照本宣科';
    case 'hybrid':   return '规矩+变通';
    case 'live':     return '随机应变';
  }
}

export function taskTypeInPlainWords(type: TaskType): string {
  switch (type) {
    case 'strategy':
      return '谋略筹划';
    case 'analysis':
      return '研判分析';
    case 'execution':
      return '推进执行';
    case 'creative':
      return '内容创作';
    case 'compliance':
      return '规制审校';
    case 'forecast':
      return '趋势推演';
    case 'intel':
      return '情报侦研';
    case 'health':
      return '健康问诊';
    case 'general':
      return '综合事务';
  }
}

export function aggregationStrategyInPlainWords(strategy: AggregationStrategy): string {
  switch (strategy) {
    case 'merge':
      return '并行汇总';
    case 'weighted_merge':
      return '权重裁断';
    case 'sequential':
      return '逐步推进';
  }
}

export function agentStateInPlainWords(state: AgentState): string {
  switch (state) {
    case 'idle':
      return '待命';
    case 'assigned':
      return '已受命';
    case 'running':
      return '正在办理';
    case 'waiting_dependency':
      return '等候前令';
    case 'summarizing':
      return '正在回报';
    case 'completed':
      return '已办毕';
    case 'failed':
      return '办理受阻';
    case 'fallback_completed':
      return '已转后备办结';
    case 'archived':
      return '已归档';
  }
}

/* ==========================================================================
   Intel
   ========================================================================== */

export function signalLevelInPlainWords(level: IntelLevel): string {
  switch (level) {
    case 'info':     return '日常消息';
    case 'watch':    return '需留意';
    case 'warning':  return '警讯';
    case 'critical': return '急报';
  }
}

export function signalLevelColor(level: IntelLevel): string {
  switch (level) {
    case 'info':     return '#6BA0FF';
    case 'watch':    return '#6BA0FF';
    case 'warning':  return '#F5A524';
    case 'critical': return '#F43F5E';
  }
}

export function signalCategoryInPlainWords(category: IntelCategory): string {
  switch (category) {
    case 'risk':        return '风险';
    case 'opportunity': return '机会';
    case 'neutral':     return '中性';
  }
}

export function credibilityInPlainWords(c: IntelCredibility): string {
  switch (c) {
    case 'low':      return '存疑';
    case 'medium':   return '参考';
    case 'high':     return '可靠';
    case 'verified': return '已核实';
  }
}

/* ==========================================================================
   Health
   ========================================================================== */

export function healthRiskInPlainWords(r: HealthRiskLevel): string {
  switch (r) {
    case 'normal':  return '安康';
    case 'watch':   return '需调养';
    case 'warning': return '有隐忧';
    case 'danger':  return '急需医治';
  }
}

/* ==========================================================================
   Confidence
   ========================================================================== */

export function confidenceInPlainWords(c: number): {
  label: string;
  tone: 'green' | 'gold' | 'red';
  advice: string;
} {
  const pct = c * 100;
  if (pct >= 85) {
    return {
      label: '十分有把握',
      tone: 'green',
      advice: '臣以为可直接准奏',
    };
  }
  if (pct >= 70) {
    return {
      label: '大致有把握',
      tone: 'green',
      advice: '细节稳妥，请陛下过目无误后批示',
    };
  }
  if (pct >= 55) {
    return {
      label: '有待斟酌',
      tone: 'gold',
      advice: '存在若干不确定，建议与丞相细议',
    };
  }
  return {
    label: '尚无定论',
    tone: 'red',
    advice: '把握不足，不宜仓促定夺',
  };
}

/* ==========================================================================
   Time
   ========================================================================== */

export function timeAgoInPlainWords(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 个时辰前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 日前`;
  if (days < 30) return `${Math.floor(days / 7)} 旬前`;
  return `${Math.floor(days / 30)} 月前`;
}

export function imperialDateToday(): string {
  const d = new Date();
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · ${weekday}`;
}

export function greetingByTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 6) return '陛下早朝已近';
  if (h < 11) return '陛下早安';
  if (h < 14) return '陛下午安';
  if (h < 18) return '陛下日安';
  if (h < 22) return '陛下晚安';
  return '陛下夜深请歇';
}
