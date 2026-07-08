'use client';

/**
 * 军机处会审直播（占位态）· P2 反应时间核心。
 *
 * 老板问完 → 首秒亮六部 → 渐进出块（户部先算完成本亮一块、刑部合规再亮）。
 * 把后端 6 分钟真会审从"空等"翻成"看着内阁真在为我干活"——TTFV 感知压到每几十秒出一块。
 * 数据来自后端 swarm stage 事件（P1 接通真 adapter 后喂真；现可对 mock stage 先渲染）。
 *
 * 边界：本组件纯展示，不算不判、不碰产线；stage 真伪由上游 sourceLabel 负责，禁在此伪造完成态。
 */
import type { AgentCode } from '@/lib/contracts/agent';
import { AGENT_META } from '@/lib/contracts/agent';

export type DeliberationStatus = 'done' | 'running' | 'queued';

export interface DeliberationStage {
  code: AgentCode;
  /** 该部门正在做什么，一句人话 */
  detail: string;
  status: DeliberationStatus;
  /** done 时的一句产出摘要（真产出，禁占位冒充） */
  result?: string;
  /** 完成/更新时刻，如 "03:14" */
  at?: string;
}

interface SwarmDeliberationLiveProps {
  stages: DeliberationStage[];
  /** 已耗时展示，如 "已会审 2 分 10 秒" */
  elapsedLabel?: string;
}

const STATUS_DOT: Record<DeliberationStatus, string> = {
  done: '#3DD68C', // 翠绿·已完成
  running: '#F0C66A', // 帝金·进行中
  queued: '#5a5340', // 暗·排队
};

export function SwarmDeliberationLive({ stages, elapsedLabel }: SwarmDeliberationLiveProps) {
  const doneCount = stages.filter((s) => s.status === 'done').length;

  return (
    <section
      className="mx-auto flex w-full max-w-[920px] flex-col overflow-hidden rounded-2xl border"
      style={{
        borderColor: 'rgba(240,198,106,0.24)',
        background: 'linear-gradient(180deg, rgba(9,11,18,0.72), rgba(5,7,13,0.66))',
        backdropFilter: 'blur(14px)',
        boxShadow: '0 18px 48px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
      aria-label="军机处会审直播"
    >
      {/* 头：会审中 + 进度 + 呼吸 */}
      <header className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'rgba(240,198,106,0.18)' }}>
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: '#F0C66A' }} />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: '#F0C66A' }} />
          </span>
          <span className="text-[13px] font-semibold tracking-[0.06em] text-[#F5E9C9]" style={{ fontFamily: 'var(--font-serif)' }}>
            军机处会审中
          </span>
          <span className="text-[11px] text-[#8F835F]">
            {doneCount}/{stages.length} 部已复
          </span>
        </div>
        {elapsedLabel ? <span className="text-[10.5px] tracking-[0.08em] text-[#8F835F]">{elapsedLabel}</span> : null}
      </header>

      {/* 部门渐进出块 */}
      <ul className="flex flex-col divide-y" style={{ borderColor: 'rgba(240,198,106,0.08)' }}>
        {stages.map((s) => {
          const meta = AGENT_META[s.code];
          const dot = STATUS_DOT[s.status];
          const dim = s.status === 'queued';
          return (
            <li
              key={s.code}
              className="flex items-start gap-3 px-4 py-3 transition-opacity"
              style={{ opacity: dim ? 0.5 : 1 }}
            >
              {/* 状态点 */}
              <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center">
                {s.status === 'running' ? (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: dot }} />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
                  </span>
                ) : s.status === 'done' ? (
                  <span className="text-[12px] font-bold" style={{ color: dot }}>✓</span>
                ) : (
                  <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
                )}
              </span>

              {/* 部门 + 动作 + 产出 */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta?.color ?? '#F0C66A' }} aria-hidden />
                  <span className="text-[12px] font-semibold" style={{ color: meta?.color ?? '#F0C66A', fontFamily: 'var(--font-serif)' }}>
                    {meta?.nameCn ?? s.code}
                  </span>
                  <span className="text-[11px] text-[#C6BB9D]">· {s.detail}</span>
                  {s.at ? <span className="ml-auto shrink-0 font-mono text-[10px] text-[#6A7299]">{s.at}</span> : null}
                </div>
                {s.status === 'done' && s.result ? (
                  <div className="mt-1 rounded-md border px-2 py-1 text-[11px] leading-[1.6] text-[#EBD9A6]" style={{ borderColor: 'rgba(240,198,106,0.16)', background: 'rgba(240,198,106,0.05)' }}>
                    {s.result}
                  </div>
                ) : s.status === 'running' ? (
                  <div className="mt-0.5 text-[10.5px] text-[#8a7a52]">…核算中</div>
                ) : (
                  <div className="mt-0.5 text-[10.5px] text-[#6A7299]">排队中</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* 可走开提示（把"等待"变"你不用盯着"） */}
      <footer className="border-t px-4 py-2.5 text-center text-[10.5px] tracking-[0.1em] text-[#8F835F]" style={{ borderColor: 'rgba(240,198,106,0.18)', fontFamily: 'var(--font-serif)' }}>
        陛下可先处置他事 · 六部会审毕，自当呈上
      </footer>
    </section>
  );
}
