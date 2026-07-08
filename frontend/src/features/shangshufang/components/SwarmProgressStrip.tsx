'use client';

/**
 * SwarmProgressStrip — 后端蜂群执行进度条（御前下旨框上方的细条）
 *
 * 闭环的"执行可见"一段：密旨/圣旨启动 jiqun 蜂群后，此条实时显示
 * 路由入口 → 当前蜂群/步骤 → 终态（回奏可查 / 失败可重试）。
 * 视觉沿用帝金/朱砂色板与 serif 字体，不引新依赖。
 */

import type { JiqunRunProgress } from '../hooks/useJiqunRunProgress';

const GOLD = '#F0C66A';
const CINNABAR = '#C2553D';
const JADE = '#3DD68C';

export function SwarmProgressStrip({
  progress,
  onViewSession,
  onRetry,
  onDismiss,
}: {
  progress: JiqunRunProgress;
  /** done 且有 sessionId 时的庄园主页入口 */
  onViewSession: (sessionId: string) => void;
  /** error 时的重试入口（重新聚焦下旨框） */
  onRetry: () => void;
  onDismiss: () => void;
}) {
  if (progress.status === 'idle') return null;

  const running = progress.status === 'running';
  const done = progress.status === 'done';
  const accent = done ? JADE : progress.status === 'error' ? CINNABAR : GOLD;

  const runningText = (() => {
    const parts: string[] = [];
    if (progress.routedSwarm) parts.push(`入口〔${progress.routedSwarm}〕`);
    if (progress.swarmName) {
      parts.push(
        progress.total > 0
          ? `${progress.swarmName} · 第 ${progress.step}/${progress.total} 步${progress.stepName ? `〔${progress.stepName}〕` : ''}`
          : `${progress.swarmName} 执行中`,
      );
    }
    if (progress.swarmsDone > 0) parts.push(`已成 ${progress.swarmsDone} 群`);
    return parts.length > 0 ? parts.join(' · ') : '后端蜂群已接旨，正在调度…';
  })();

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-2 flex items-center gap-2.5 rounded-lg border px-3 py-2 text-[11.5px]"
      style={{
        borderColor: `${accent}44`,
        background: `${accent}0D`,
        color: '#C6BB9D',
        fontFamily: 'var(--font-serif)',
      }}
    >
      {running ? (
        <span
          className="h-3 w-3 shrink-0 animate-spin rounded-full border-[1.5px] border-current border-t-transparent"
          style={{ color: GOLD }}
          aria-hidden
        />
      ) : (
        <span className="shrink-0 text-[13px]" style={{ color: accent }} aria-hidden>
          {done ? '✓' : '✕'}
        </span>
      )}

      <span className="min-w-0 flex-1 truncate">
        <span className="mr-1.5 tracking-[0.14em]" style={{ color: accent }}>
          {running ? '后端执行中' : done ? '后端已回奏' : '后端执行失败'}
        </span>
        {running
          ? runningText
          : done
            ? progress.sessionId
              ? `编排会话〔${progress.sessionId}〕已完成，丞相栏稍后亦会列入今日要务。`
              : '后端执行完成。'
            : progress.error ?? '原因未知，请重试或查看庄园蜂群主页。'}
      </span>

      {done && progress.sessionId && (
        <button
          type="button"
          onClick={() => onViewSession(progress.sessionId!)}
          className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition-all hover:brightness-110"
          style={{ borderColor: `${JADE}55`, color: JADE, background: `${JADE}10` }}
        >
          查看庄园
        </button>
      )}
      {progress.status === 'error' && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition-all hover:brightness-110"
          style={{ borderColor: `${CINNABAR}55`, color: '#E8B4A6', background: `${CINNABAR}12` }}
        >
          再次下旨
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="收起进度条"
        className="shrink-0 rounded-full px-1.5 text-[12px] text-[#8F835F] transition-colors hover:text-[#F5E9C9]"
      >
        ×
      </button>
    </div>
  );
}
