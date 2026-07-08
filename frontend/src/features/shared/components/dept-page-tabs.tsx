/**
 * 朝堂 OS V2 · 部门页面 TAB 切换器
 * 主页 / 说明 / 资源（可扩展），服务"一页原则"
 */

'use client';

import { useState, type ReactNode } from 'react';

export type DeptPageTabId = 'home' | 'guide' | 'resources' | 'history' | 'surface' | 'terms';

export interface DeptPageTab {
  id: DeptPageTabId;
  label: string;
  badge?: string | number;
}

export interface DeptPageTabsProps {
  tabs: DeptPageTab[];
  active: DeptPageTabId;
  onChange: (id: DeptPageTabId) => void;
  accent: string;
  className?: string;
  density?: 'default' | 'compact';
}

export function DeptPageTabs({
  tabs,
  active,
  onChange,
  accent,
  className,
  density = 'default',
}: DeptPageTabsProps) {
  const compact = density === 'compact';
  return (
    <div
      className={`relative flex items-center gap-1 border-b border-white/10 ${className ?? ''}`}
      role="tablist"
    >
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={`group relative flex items-center gap-2 font-medium tracking-[0.01em] transition-colors ${compact ? 'px-4 py-2 text-[12px]' : 'px-5 py-2.5 text-[13px]'}`}
            style={{
              color: isActive ? '#F5E9C9' : '#8A92AC',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <span>{t.label}</span>
            {t.badge !== undefined && (
              <span
                className={`rounded-full font-mono ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-1.5 py-0.5 text-[11px]'}`}
                style={{
                  background: isActive ? `${accent}33` : 'rgba(255,255,255,0.06)',
                  color: isActive ? accent : '#8A92AC',
                  border: `1px solid ${isActive ? `${accent}55` : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                {t.badge}
              </span>
            )}
            {isActive && (
              <span
                aria-hidden
                className="absolute inset-x-0 -bottom-px h-[2px]"
                style={{
                  background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
                  boxShadow: `0 0 8px ${accent}aa`,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * hook · 让页面简单地管理 tab 状态
 */
export function useDeptPageTab(initial: DeptPageTabId = 'home') {
  const [active, setActive] = useState<DeptPageTabId>(initial);
  return { active, setActive };
}

export function DeptTabPanel({
  active,
  id,
  children,
}: {
  active: DeptPageTabId;
  id: DeptPageTabId;
  children: ReactNode;
}) {
  if (active !== id) return null;
  return (
    <div role="tabpanel" aria-labelledby={`tab-${id}`} className="animate-[fadeIn_0.3s_ease-out]">
      {children}
    </div>
  );
}
