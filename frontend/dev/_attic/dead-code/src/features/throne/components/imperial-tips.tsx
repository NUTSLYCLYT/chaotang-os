'use client';

/**
 * 锦囊三策 · Imperial Tips
 *
 * 每日 AI 生成 3 条 "陛下今日宜做" 的建议。
 * 当前为规则式生成（从 tasks/signals 聚合），后续可接真 LLM。
 *
 * 视觉：金色折卡三张，像从锦囊里抽出。
 */

import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';
import type { Task } from '@/types/task';
import type { IntelSignal } from '@/types/intel';

interface Props {
  tasks: Task[];
  signals: IntelSignal[];
}

interface Tip {
  id: string;
  headline: string;
  body: string;
  href: string;
  ctaLabel: string;
}

export function ImperialTips({ tasks, signals }: Props) {
  const tips = buildTips(tasks, signals);
  return (
    <div className="rounded-2xl border border-[#F0C66A]/20 bg-[#F0C66A]/[0.04] px-5 py-5">
      <div className="flex items-center gap-2">
        <Sparkles size={12} className="text-[#F0C66A]" />
        <div className="text-[11px] uppercase tracking-[0.22em] text-[#8F835F]">
          Imperial Pouch · 锦囊三策
        </div>
      </div>
      <div className="mt-1 text-[15px] font-semibold text-[#F5E9C9]">陛下今日宜做</div>

      <ul className="mt-4 space-y-2">
        {tips.map((t, idx) => (
          <li key={t.id}>
            <Link
              href={t.href}
              className="group block rounded-xl border border-white/8 bg-black/15 px-4 py-3 transition hover:-translate-y-0.5 hover:border-[#F0C66A]/30 hover:bg-white/[0.05]"
            >
              <div className="flex items-start gap-3">
                <span
                  className="display-serif mt-0.5 shrink-0 text-[15px] font-bold text-[#F0C66A]"
                  aria-hidden
                >
                  其{['一', '二', '三'][idx]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold leading-6 text-[#F5E9C9]">
                    {t.headline}
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#AEB6CF]">
                    {t.body}
                  </div>
                </div>
                <ArrowRight
                  size={12}
                  className="mt-1 shrink-0 text-[#6A7299] transition group-hover:text-[#F0C66A]"
                />
              </div>
              <div className="mt-2 pl-7 text-[11px] uppercase tracking-[0.14em] text-[#6A7299]">
                {t.ctaLabel}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildTips(tasks: Task[], signals: IntelSignal[]): Tip[] {
  const tips: Tip[] = [];

  const critical = signals.find((s) => s.level === 'critical');
  if (critical) {
    tips.push({
      id: `tip-crit-${critical.id}`,
      headline: '先处置一桩急报',
      body: `锦衣卫报："${critical.title}"。不必全看，只需先决定是压住还是升级。`,
      href: `/intel/${critical.id}`,
      ctaLabel: '入情报阁',
    });
  }

  const pending = tasks.find((t) => t.status === 'report_ready');
  if (pending) {
    tips.push({
      id: `tip-pending-${pending.id}`,
      headline: '批一份呈报',
      body: `丞相已呈 "${pending.title || pending.rawCommand}"，就等陛下画圈。一次只批一件，省半个时辰。`,
      href: `/throne/brief/${pending.id}`,
      ctaLabel: '入御批',
    });
  }

  const warning = signals.find((s) => s.level === 'warning');
  if (warning) {
    tips.push({
      id: `tip-warn-${warning.id}`,
      headline: '扫一眼警讯',
      body: `${warning.title} — 尚无须亲自动手，若觉得重要按下便可命丞相详查。`,
      href: `/intel/${warning.id}`,
      ctaLabel: '看警讯',
    });
  }

  // Fallback defaults，保证总有 3 条
  const defaults: Tip[] = [
    {
      id: 'tip-default-compose',
      headline: '亲笔下一道新旨',
      body: '若陛下今日心中已有问题，一句话即可下旨。丞相会研判、拆解、分派六部并行办理。',
      href: '/throne/compose',
      ctaLabel: '入朱批',
    },
    {
      id: 'tip-default-manor',
      headline: '巡视一处庄园',
      body: '律师庄 / 财务庄 / 合规庄 — 十庄园随陛下挑一处，看蜂群近三日的动静。',
      href: '/manors',
      ctaLabel: '巡庄园',
    },
    {
      id: 'tip-default-scribe',
      headline: '翻一本旧案',
      body: '史馆按时辰顺序存放所有执行记忆。翻旧案可见六部做过什么、哪些走了弯路。',
      href: '/scribe',
      ctaLabel: '进史馆',
    },
  ];

  for (const d of defaults) {
    if (tips.length >= 3) break;
    tips.push(d);
  }

  return tips.slice(0, 3);
}
