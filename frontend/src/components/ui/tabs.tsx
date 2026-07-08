/**
 * 朝堂 OS V2 · Tabs
 *
 * 黑金指挥舱 Tab 胶囊。
 * 每个 Tab 支持图标 + 中文主标 + 英文副标 + 徽章 + 部门配色。
 * 激活：渐变背景 + 发光 + 部门 accent 描边；未激活：低饱和轮廓。
 */

'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { colors } from '@/config/design-tokens';

export interface TabItem {
  id: string;
  /** 中文主标 */
  label: string;
  /** 英文副标（uppercase eyebrow） */
  sublabel?: string;
  /** 左侧图标 */
  icon?: LucideIcon;
  /** 部门主色（不传则用默认金色 token） */
  accent?: string;
  /** 右侧徽章 */
  badge?: string | number;
  /** 内容 */
  children: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  defaultTabId?: string;
  activeTabId?: string;
  onChange?: (tabId: string) => void;
  /** 全局默认 accent（会被 item.accent 覆盖） */
  accent?: string;
  /** Tab bar 与内容区间距 */
  gap?: 'sm' | 'md' | 'lg';
}

const GAP_MAP = { sm: 'mt-4', md: 'mt-6', lg: 'mt-8' } as const;
const GOLD = colors.goldBright;

export function Tabs({
  items,
  defaultTabId,
  activeTabId,
  onChange,
  accent: globalAccent = GOLD,
  gap = 'md',
}: TabsProps) {
  const [internalId, setInternalId] = useState(defaultTabId ?? items[0]?.id ?? '');
  const currentId = activeTabId ?? internalId;
  const current = items.find((t) => t.id === currentId) ?? items[0];

  const handleSelect = (id: string) => {
    if (activeTabId === undefined) setInternalId(id);
    onChange?.(id);
  };

  return (
    <div>
      <div
        role="tablist"
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.06] bg-black/30 p-2 backdrop-blur-md"
      >
        {items.map((item) => {
          const active = item.id === current?.id;
          const accent = item.accent ?? globalAccent;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={[
                'group relative flex items-center gap-2.5 rounded-xl px-4 py-2.5 transition-all duration-200',
                active ? '' : 'hover:bg-white/[0.04]',
              ].join(' ')}
              style={
                active
                  ? {
                      background: `linear-gradient(135deg, ${accent}26, ${accent}0a 60%, transparent)`,
                      border: `1px solid ${accent}66`,
                      boxShadow: `0 6px 22px ${accent}22, inset 0 1px 0 ${accent}40`,
                    }
                  : {
                      border: '1px solid rgba(255,255,255,0.06)',
                    }
              }
            >
              {/* Glow underline on active */}
              {active && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-3 -bottom-[1px] h-[2px] rounded-full"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
                    filter: `drop-shadow(0 0 6px ${accent})`,
                  }}
                />
              )}

              {/* Icon capsule */}
              {Icon && (
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                  style={{
                    background: active
                      ? `linear-gradient(135deg, ${accent}33, ${accent}0f)`
                      : 'rgba(255,255,255,0.04)',
                    border: active
                      ? `1px solid ${accent}55`
                      : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <Icon
                    size={14}
                    style={{ color: active ? accent : colors.textDim }}
                    className="transition-colors"
                  />
                </span>
              )}

              {/* Label stack */}
              <span className="flex flex-col items-start leading-tight">
                {item.sublabel && (
                  <span
                    className="text-[11px] uppercase tracking-[0.22em]"
                    style={{ color: active ? accent : colors.textMuted }}
                  >
                    {item.sublabel}
                  </span>
                )}
                <span
                  className={`text-[14px] font-semibold ${
                    active ? '' : 'text-[color:var(--tab-text-inactive)]'
                  }`}
                  style={
                    active
                      ? { color: colors.text }
                      : ({ '--tab-text-inactive': colors.text } as CSSProperties)
                  }
                >
                  {item.label}
                </span>
              </span>

              {/* Badge */}
              {item.badge !== undefined && (
                <span
                  className="ml-1 rounded-full px-2 py-[1px] font-mono text-[11px]"
                  style={{
                    background: active
                      ? `${accent}22`
                      : 'rgba(255,255,255,0.04)',
                    color: active ? accent : colors.textDim,
                    border: active
                      ? `1px solid ${accent}66`
                      : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-labelledby={current?.id} className={GAP_MAP[gap]}>
        {current?.children}
      </div>
    </div>
  );
}
