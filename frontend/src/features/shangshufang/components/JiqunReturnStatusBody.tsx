import { AlertTriangle, CheckCircle2, Waypoints } from 'lucide-react';
import type { JiqunRunProgress } from '../hooks/useJiqunRunProgress';

function jiqunReturnProgressCopy(progress: JiqunRunProgress): {
  label: string;
  body: string;
  accent: string;
} {
  if (progress.status === 'done') {
    return {
      label: '蜂群已回奏',
      body: progress.sessionId
        ? `编排会话〔${progress.sessionId}〕已完成，回奏正在写回本卷。`
        : '后端蜂群已完成，回奏正在写回本卷。',
      accent: '#2D8A5B',
    };
  }
  if (progress.status === 'error') {
    return {
      label: '蜂群执行失败',
      body: progress.error ?? '后端蜂群执行失败，请查看军机处流程或稍后重试。',
      accent: '#9B2F25',
    };
  }

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

  return {
    label: '蜂群执行中',
    body: parts.length > 0 ? parts.join(' · ') : '后端蜂群已接旨，正在调度…',
    accent: '#8A6A2A',
  };
}

export function JiqunReturnStatusBody({
  progress,
  taskId,
  traceId,
}: {
  progress: JiqunRunProgress;
  taskId?: string;
  traceId?: string;
}) {
  const copy = jiqunReturnProgressCopy(progress);
  const running = progress.status === 'idle' || progress.status === 'running';
  const StatusIcon = progress.status === 'error' ? AlertTriangle : progress.status === 'done' ? CheckCircle2 : Waypoints;

  return (
    <div
      data-testid="ssf-jiqun-return-status"
      className="flex min-h-0 flex-1 flex-col justify-center gap-5 px-1 py-2 md:px-6"
      style={{ fontFamily: 'var(--font-serif)' }}
    >
      <section
        className="relative overflow-hidden rounded-[18px] border px-5 py-5 md:px-7 md:py-6"
        style={{
          borderColor: `${copy.accent}55`,
          background:
            'linear-gradient(180deg, rgba(255,248,224,0.18), rgba(255,248,224,0.06))',
          boxShadow: 'inset 0 1px 0 rgba(255,250,235,0.28), 0 18px 42px rgba(58,33,8,0.12)',
        }}
      >
        <div
          aria-hidden
          className="absolute -right-10 -top-14 h-36 w-36 rounded-full"
          style={{ background: `${copy.accent}14` }}
        />
        <div className="relative z-10 flex items-start gap-4">
          <span
            className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full border"
            style={{
              borderColor: `${copy.accent}55`,
              background: `${copy.accent}10`,
              color: copy.accent,
            }}
          >
            {running ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
            ) : (
              <StatusIcon size={18} aria-hidden />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className="text-[12px] font-black tracking-[0.18em]"
                style={{ color: copy.accent }}
              >
                {copy.label}
              </span>
              <span
                className="rounded-full border px-2.5 py-0.5 text-[10px] font-bold"
                style={{
                  borderColor: `${copy.accent}40`,
                  background: `${copy.accent}0F`,
                  color: copy.accent,
                }}
              >
                蜂群调度
              </span>
            </div>
            <p
              className="text-[19px] font-semibold leading-[1.85] md:text-[23px]"
              style={{
                color: '#211406',
                letterSpacing: '0.02em',
                textShadow: '0 1px 0 rgba(255,250,232,0.52)',
              }}
            >
              {copy.body}
            </p>
          </div>
        </div>
      </section>

      <div
        className="grid gap-2 rounded-[14px] border px-4 py-3 text-[11px] leading-6 md:grid-cols-2"
        style={{
          borderColor: 'rgba(120,90,40,0.22)',
          background: 'rgba(120,90,40,0.045)',
          color: '#5F3C12',
        }}
      >
        {taskId && <span className="truncate">案号：{taskId}</span>}
        {traceId && <span className="truncate">Trace：{traceId}</span>}
        {progress.taskId && <span className="truncate">后端任务：{progress.taskId}</span>}
        {progress.sessionId && <span className="truncate">会话：{progress.sessionId}</span>}
      </div>
    </div>
  );
}
