'use client';

/**
 * 陛下视图桥接条 · Throne Bridge Banner
 *
 * 嵌入在专业面板的顶部（如 /overview），告诉运营团队：
 *   "今日一件事"已经在陛下视图展开 — 一键切换即可。
 *
 * 这个组件是两套视图之间的软链接。若无急务则显示安静版。
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Crown, ArrowRight, Bell } from 'lucide-react';
import { chaotang } from '@/lib/api/chaotang';
import { pickTodayFocus, type TodayFocus } from '@/features/throne/lib/today-picker';
import type { Task } from '@/types/task';
import type { IntelSignal } from '@/types/intel';
import type { ForecastScenario } from '@/types/forecast';

export function ThroneBridgeBanner() {
  const [focus, setFocus] = useState<TodayFocus | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // chaotang.tasks() → /api/court/chaotang/tasks (BFF → jiqun_ai :8081)
        // intel/forecast 暂无 chaotang.* 等价端点，以空数组兜底
        const rawTasks = await chaotang.tasks();
        if (!mounted) return;
        // 将 chaotang tasks 适配为 pickTodayFocus 期望的 Task 型别（只用到 status/title 字段）
        const t = rawTasks as unknown as Task[];
        const s: IntelSignal[] = [];
        const f: ForecastScenario[] = [];
        setFocus(pickTodayFocus(t, s, f).focus);
      } catch {
        /* silent */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!focus) {
    return <SkeletonBanner />;
  }

  const urgent =
    focus.kind === 'review_task' ||
    focus.kind === 'critical_signal';

  const tint = urgent ? '#F0C66A' : '#6BA0FF';

  return (
    <Link
      href="/throne"
      className="group relative block overflow-hidden rounded-xl border transition-all hover:-translate-y-0.5"
      style={{
        borderColor: `${tint}55`,
        background: `
          radial-gradient(ellipse 60% 120% at 0% 50%, ${tint}18, transparent 50%),
          linear-gradient(90deg, rgba(20, 16, 8, 0.85), rgba(10, 8, 4, 0.5))
        `,
      }}
    >
      <div className="relative flex items-center gap-4 p-4 pr-5">
        {/* Crown badge */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: `linear-gradient(135deg, ${tint}28, ${tint}10)`,
            border: `1px solid ${tint}66`,
          }}
        >
          <Crown size={16} style={{ color: tint }} />
        </div>

        {/* Copy */}
        <div className="min-w-0 flex-1">
          <div
            className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em]"
            style={{ color: tint }}
          >
            {urgent && (
              <span className="relative inline-flex h-1.5 w-1.5">
                <span
                  className="absolute inset-0 animate-ping rounded-full"
                  style={{ background: tint, opacity: 0.7 }}
                />
                <span
                  className="relative inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: tint }}
                />
              </span>
            )}
            陛下视图 · Today's Focus
          </div>
          <div className="display-serif mt-1 line-clamp-1 text-[13px] font-semibold text-[#FBF7EC]">
            {'headline' in focus ? focus.headline : '朝堂清明'}
          </div>
          <div className="mt-0.5 line-clamp-1 text-[11px] text-[#9AA3C4]">
            {'reason' in focus ? focus.reason : '无急务'}
          </div>
        </div>

        {/* CTA */}
        <div
          className="flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-medium transition-all"
          style={{
            borderColor: `${tint}66`,
            background: `${tint}10`,
            color: tint,
          }}
        >
          进大殿
          <ArrowRight
            size={12}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </div>
      </div>

      {/* Bottom hairline */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${tint}66, transparent)`,
        }}
      />
    </Link>
  );
}

function SkeletonBanner() {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border px-4 py-3"
      style={{
        borderColor: 'rgba(240,198,106,0.12)',
        background: 'linear-gradient(90deg, rgba(20, 16, 8, 0.8), rgba(10, 8, 4, 0.42))',
      }}
    >
      <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-[#F0C66A]/10" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-[0.2em] text-[#8A92AC]">
          陛下视图
        </div>
        <div className="mt-1 h-3 w-40 animate-pulse rounded bg-white/[0.06]" />
      </div>
      <div className="text-[11px] text-[#6A7299]">同步今日焦点…</div>
    </div>
  );
}
