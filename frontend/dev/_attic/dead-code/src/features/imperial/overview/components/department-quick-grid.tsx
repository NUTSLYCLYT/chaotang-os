/**
 * 朝堂 OS V2 · 大殿 · 11 部直通卡片网格
 *
 * 给陛下一眼看清群臣谁在忙、谁有急事、直接点击进入对应部门。
 * 每卡片：accent 竖条 + persona 小头像 + 部门名 + 简讯 + 主 metric。
 */

'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  Crown,
  Shield,
  Search,
  Scale,
  Building2,
  Globe,
  Stamp,
  Stethoscope,
  Telescope,
  BookOpen,
  Users,
  ChevronRight,
} from 'lucide-react';
import { DEPT_HERO_CONFIG, type DeptHeroKey } from '@/features/shared/components/dept-hero-card';

interface QuickEntry {
  key: DeptHeroKey;
  href: string;
  icon: LucideIcon;
}

/** 排序 = 大殿出发的自然深入顺序 · 丞相决策 → 各部门 */
const QUICK_ENTRIES: QuickEntry[] = [
  { key: 'command-center', href: '/command-center', icon: Crown },
  { key: 'governance', href: '/governance', icon: Scale },
  { key: 'archive', href: '/archive', icon: Search },
  { key: 'intel', href: '/intel', icon: Globe },
  { key: 'forecast', href: '/forecast', icon: Telescope },
  { key: 'health', href: '/health', icon: Stethoscope },
  { key: 'manors', href: '/manors', icon: Building2 },
  { key: 'reports', href: '/reports', icon: Stamp },
  { key: 'scribe', href: '/scribe', icon: BookOpen },
  { key: 'study', href: '/study', icon: Shield },
  { key: 'departments', href: '/departments', icon: Users },
];

export function DepartmentQuickGrid() {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.28em]"
            style={{ color: '#F0C66A' }}
          >
            Direct Access · 直通各部
          </div>
          <h2
            className="mt-1 text-[18px] font-bold tracking-[0.06em]"
            style={{ color: '#F5E9C9', fontFamily: '"Noto Serif SC", serif' }}
          >
            点一下进入任何部门，简讯一目了然
          </h2>
        </div>
        <div className="text-[11px] tracking-[0.18em] text-[#8A92AC]">
          {QUICK_ENTRIES.length} 部 · 一屏直达
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {QUICK_ENTRIES.map((entry) => (
          <QuickCard key={entry.key} entry={entry} />
        ))}
      </div>
    </section>
  );
}

function QuickCard({ entry }: { entry: QuickEntry }) {
  const config = DEPT_HERO_CONFIG[entry.key];
  const Icon = entry.icon;
  const hookText = config.hookHtml.replace(/<\/?strong>/g, '');

  return (
    <Link
      href={entry.href}
      className="group relative flex flex-col gap-2.5 overflow-hidden rounded-xl border bg-white/[0.02] px-4 py-3.5 transition-all hover:bg-white/[0.05]"
      style={{
        borderColor: `${config.accent}33`,
      }}
    >
      {/* 左侧 accent 竖条 */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: `linear-gradient(180deg, ${config.accent}, ${config.accent}44)` }}
      />

      {/* hover 渐显的 accent 柔光 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at 15% 50%, ${config.accent}18, transparent 60%)`,
        }}
      />

      {/* 行 1：图标 + 名号 */}
      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border"
          style={{
            background: `${config.accent}18`,
            borderColor: `${config.accent}55`,
            color: config.accent,
          }}
        >
          <Icon size={13} />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[13.5px] font-bold tracking-[0.06em]"
            style={{ color: '#F5E9C9', fontFamily: '"Noto Serif SC", serif' }}
          >
            {config.tag.split(' · ')[1] ?? config.tag}
          </div>
          <div
            className="truncate text-[11px] uppercase tracking-[0.18em]"
            style={{ color: `${config.accent}cc`, opacity: 0.85 }}
          >
            {config.personaName}
          </div>
        </div>
        <ChevronRight
          size={14}
          className="shrink-0 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-80"
          style={{ color: config.accent }}
        />
      </div>

      {/* 行 2：简讯 */}
      <div
        className="line-clamp-2 text-[11.5px] leading-[17px]"
        style={{ color: '#C8CDD8' }}
      >
        {hookText}
      </div>

      {/* 行 3：metric */}
      <div className="flex items-center justify-between border-t pt-2" style={{ borderColor: `${config.accent}22` }}>
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.24em]"
          style={{ color: `${config.accent}cc` }}
        >
          {config.metric.label}
        </span>
        <span
          className="font-mono text-[15px] font-black"
          style={{
            color: '#F5E9C9',
            textShadow: `0 0 8px ${config.accent}66`,
          }}
        >
          {config.metric.value}
        </span>
      </div>
    </Link>
  );
}
