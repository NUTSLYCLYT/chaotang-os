/**
 * 太医院 · 医讯
 *
 * 前沿医疗进展 + AI 脑机接口 + 专业新闻 feed
 * 聚合策略：
 *   Breakthrough（突破性进展） · Trial（临床试验） · AI（AI 医疗工具） · Policy（政策法规）
 */

'use client';

import { useMemo, useState } from 'react';
import {
  Cpu,
  Microscope,
  FlaskConical,
  BadgeCheck,
  Bookmark,
  Clock,
  ArrowUpRight,
  Radar,
  BrainCircuit,
  Dna,
  Heart,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import type { MedicalNewsItem, MedicalNewsCategory } from '@/lib/contracts/taiyi';

type NewsCategory = MedicalNewsCategory;

// 复用契约中的 MedicalNewsItem 类型，添加计算属性
interface NewsItemDisplay extends MedicalNewsItem {
  /** 相对时间标签（从 publishedAt 计算） */
  timeLabel: string;
  /** 装饰 icon */
  icon: LucideIcon;
}

const CATEGORY_META: Record<NewsCategory, { label: string; color: string; sublabel: string }> = {
  breakthrough: { label: '突破', color: '#F43F5E', sublabel: 'Breakthrough' },
  trial:        { label: '临床',  color: '#6BA0FF', sublabel: 'Clinical Trial' },
  ai:           { label: 'AI',   color: '#B794F4', sublabel: 'AI in Medicine' },
  policy:       { label: '政策',  color: '#F0C66A', sublabel: 'Policy' },
};

const ICON_MAP: Record<NewsCategory, LucideIcon> = {
  breakthrough: Heart,
  trial: Dna,
  ai: Cpu,
  policy: BadgeCheck,
};

function getRelativeTime(isoDate: string): string {
  const publishedAt = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - publishedAt.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffHours < 1) return '刚刚';
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  if (diffWeeks < 4) return `${diffWeeks} 周前`;
  return isoDate.split('T')[0];
}

interface MedicalNewsFeedProps {
  items?: MedicalNewsItem[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

export function MedicalNewsFeed({ items = [], isLoading = false, error = null, onRetry }: MedicalNewsFeedProps) {
  const [activeCat, setActiveCat] = useState<NewsCategory | 'all'>('all');
  const [onlyRelevant, setOnlyRelevant] = useState(false);

  // 将 MedicalNewsItem[] 转换为 NewsItemDisplay[]（添加计算属性）
  const displayItems: NewsItemDisplay[] = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        timeLabel: getRelativeTime(item.publishedAt),
        icon: ICON_MAP[item.category] || Radar,
      })),
    [items],
  );

  const filtered = useMemo(() => {
    return displayItems
      .filter((n) => {
        if (activeCat !== 'all' && n.category !== activeCat) return false;
        if (onlyRelevant && !n.relevant) return false;
        return true;
      })
      .sort((a, b) => b.importance - a.importance);
  }, [displayItems, activeCat, onlyRelevant]);

  const top = filtered[0];
  const rest = filtered.slice(1);

  // Loading 状态
  if (isLoading && items.length === 0) {
    return (
      <div className="space-y-5">
        <GlassPanel tone="deep" padding="md" className="h-12 animate-pulse" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-48 rounded-2xl border border-white/8 bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Error 状态
  if (error && items.length === 0) {
    return (
      <GlassPanel tone="elevated" padding="lg" className="text-center">
        <div className="text-[13px] text-[#C8CDD8] mb-4">
          加载医讯失败：{error.message}
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-[#34D399]/50 bg-[#34D399]/10 px-4 py-2 text-[12px] text-[#34D399] hover:bg-[#34D399]/20 transition"
          >
            重新加载
          </button>
        )}
      </GlassPanel>
    );
  }

  // Empty 状态
  if (items.length === 0) {
    return (
      <GlassPanel tone="elevated" padding="lg" className="text-center">
        <div className="text-[13px] text-[#9AA3C4]">暂无医讯数据</div>
      </GlassPanel>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <GlassPanel tone="deep" padding="md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryChip
              active={activeCat === 'all'}
              color="#F0C66A"
              label="全部"
              onClick={() => setActiveCat('all')}
            />
            {(Object.keys(CATEGORY_META) as NewsCategory[]).map((c) => (
              <CategoryChip
                key={c}
                active={activeCat === c}
                color={CATEGORY_META[c].color}
                label={CATEGORY_META[c].label}
                sublabel={CATEGORY_META[c].sublabel}
                onClick={() => setActiveCat(c)}
              />
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[#9AA3C4]">
            <input
              type="checkbox"
              checked={onlyRelevant}
              onChange={(e) => setOnlyRelevant(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#34D399]"
            />
            只看与我相关
          </label>
        </div>
      </GlassPanel>

      {/* Top story */}
      {top && <TopStory item={top} />}

      {/* Feed list */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {rest.map((n) => (
          <NewsCard key={n.id} item={n} />
        ))}
      </div>
    </div>
  );
}

/* ========================================================================== */

function CategoryChip({
  active,
  color,
  label,
  sublabel,
  onClick,
}: {
  active: boolean;
  color: string;
  label: string;
  sublabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] transition-all"
      style={{
        background: active ? `${color}1a` : 'rgba(255,255,255,0.03)',
        border: active ? `1px solid ${color}66` : '1px solid rgba(255,255,255,0.08)',
        color: active ? color : '#B8C0DA',
        boxShadow: active ? `0 2px 12px ${color}22` : undefined,
      }}
    >
      <span className="font-semibold">{label}</span>
      {sublabel && (
        <span className="text-[9px] uppercase tracking-[0.18em] opacity-70">{sublabel}</span>
      )}
    </button>
  );
}

function TopStory({ item }: { item: NewsItemDisplay }) {
  const meta = CATEGORY_META[item.category];
  const Icon = item.icon;
  return (
    <GlassPanel
      tone="elevated"
      padding="lg"
      className="relative overflow-hidden"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background: `radial-gradient(circle at 85% 0%, ${meta.color}22, transparent 55%)`,
        }}
      />
      <div className="relative grid gap-5 xl:grid-cols-[0.7fr_1.3fr]">
        {/* Left · category + icon */}
        <div className="flex flex-col justify-between gap-4">
          <div>
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{
                background: `${meta.color}1a`,
                color: meta.color,
                border: `1px solid ${meta.color}66`,
              }}
            >
              <BadgeCheck size={10} />
              {meta.sublabel} · Top Story
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{
                  background: `linear-gradient(135deg, ${meta.color}33, ${meta.color}0a)`,
                  border: `1px solid ${meta.color}66`,
                  boxShadow: `0 4px 24px ${meta.color}22`,
                }}
              >
                <Icon size={22} style={{ color: meta.color }} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#6A7299]">
                  Importance
                </div>
                <div className="font-mono text-[32px] font-bold" style={{ color: meta.color }}>
                  {item.importance}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#9AA3C4]">
            <Clock size={11} />
            {item.timeLabel}
            <span>·</span>
            <span>{item.source}</span>
          </div>
        </div>

        {/* Right · content */}
        <div>
          <h3 className="text-[20px] font-semibold leading-snug text-[#F5E9C9]">
            {item.headline}
          </h3>
          <p className="mt-3 text-[13px] leading-7 text-[#C8CDD8]">{item.excerpt}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {item.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-[#9AA3C4]"
              >
                {t}
              </span>
            ))}
            <div className="grow" />
            <button
              type="button"
              className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] transition hover:brightness-110"
              style={{
                borderColor: `${meta.color}66`,
                background: `${meta.color}14`,
                color: meta.color,
              }}
            >
              阅读全文
              <ArrowUpRight size={11} />
            </button>
            <button
              type="button"
              className="flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-[11px] text-[#D6CCB0] transition hover:bg-white/10"
            >
              <Bookmark size={11} />
              收藏
            </button>
          </div>

          {/* Citations */}
          {item.citations && item.citations.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#6A7299]">引用来源</div>
              {item.citations.map((cit, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-[11px] text-[#9AA3C4]"
                >
                  <div className="font-semibold text-[#D6CCB0]">{cit.title}</div>
                  {cit.excerpt && <div className="mt-1 text-[10px]">{cit.excerpt}</div>}
                  {cit.url && (
                    <a
                      href={cit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[#6BA0FF] hover:text-[#8FBEFF] transition"
                    >
                      查看原文
                      <ArrowUpRight size={9} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}

function NewsCard({ item }: { item: NewsItemDisplay }) {
  const meta = CATEGORY_META[item.category];
  const Icon = item.icon;
  return (
    <div
      className="group rounded-2xl border border-white/8 bg-white/[0.02] p-4 transition-all hover:border-white/20 flex flex-col"
      style={{
        background: `linear-gradient(160deg, ${meta.color}06, rgba(20,22,30,0.3))`,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: `${meta.color}1a`,
            border: `1px solid ${meta.color}55`,
          }}
        >
          <Icon size={15} style={{ color: meta.color }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.18em]"
              style={{
                background: `${meta.color}14`,
                color: meta.color,
                border: `1px solid ${meta.color}44`,
              }}
            >
              {meta.label}
            </span>
            {item.relevant && (
              <span
                className="rounded-full border border-[#34D399]/50 bg-[#34D399]/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-[#34D399]"
              >
                与你相关
              </span>
            )}
            <span className="text-[10px] text-[#6A7299]">· {item.timeLabel}</span>
          </div>
          <h4 className="mt-2 text-[13px] font-semibold leading-snug text-[#F5E9C9]">
            {item.headline}
          </h4>
          <p className="mt-1.5 line-clamp-2 text-[11px] leading-6 text-[#9AA3C4]">
            {item.excerpt}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex gap-1.5">
              {item.tags.slice(0, 2).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-[#8A93B0]"
                >
                  {t}
                </span>
              ))}
            </div>
            <span className="text-[10px] text-[#6A7299]">{item.source}</span>
          </div>
        </div>
      </div>

      {/* Citations in card */}
      {item.citations && item.citations.length > 0 && (
        <div className="mt-3 border-t border-white/8 pt-3">
          <div className="text-[9px] uppercase tracking-[0.18em] text-[#6A7299] mb-1.5">来源</div>
          {item.citations.slice(0, 1).map((cit, idx) => (
            <div key={idx} className="text-[10px] text-[#8A93B0]">
              {cit.url ? (
                <a
                  href={cit.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#6BA0FF] hover:text-[#8FBEFF] transition inline-flex items-center gap-1"
                >
                  {cit.title}
                  <ArrowUpRight size={8} />
                </a>
              ) : (
                <span>{cit.title}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
