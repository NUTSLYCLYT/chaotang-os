'use client';

import type { CSSProperties, ReactNode } from 'react';

/**
 * ManorFrame — 帝国面板壳
 *
 * 从户部 hubu-client.tsx 的 Frame 组件提取泛化。
 * 绝对定位或流式布局中的面板容器，带四角金线 + 顶部渐变线 +
 * imperialModulePanelStyle 底层。
 *
 * 用法：
 *   <ManorFrame accent="#ebcb7b" strength="strong" style={{ width: 320 }}>
 *     <ManorFrame.Title>库银总览</ManorFrame.Title>
 *     ...
 *   </ManorFrame>
 */

import { imperialModulePanelStyle } from '@/features/departments/lib/imperial-panel-style';

export interface ManorFrameProps {
  accent: string;
  strength?: 'soft' | 'strong';
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function ManorFrame({
  accent,
  strength = 'strong',
  className,
  style,
  children,
}: ManorFrameProps) {
  return (
    <section
      className={`relative flex min-h-0 flex-col overflow-hidden border backdrop-blur-[8px] ${className ?? ''}`}
      style={{
        ...style,
        ...imperialModulePanelStyle(accent, strength),
      }}
    >
      {/* 四角金线 */}
      <span
        className="pointer-events-none absolute left-0 top-0 h-4 w-4 border-l border-t"
        style={{ borderColor: `${accent}70` }}
      />
      <span
        className="pointer-events-none absolute right-0 top-0 h-4 w-4 border-r border-t"
        style={{ borderColor: `${accent}70` }}
      />
      <span
        className="pointer-events-none absolute bottom-0 left-0 h-4 w-4 border-b border-l"
        style={{ borderColor: `${accent}55` }}
      />
      <span
        className="pointer-events-none absolute bottom-0 right-0 h-4 w-4 border-b border-r"
        style={{ borderColor: `${accent}55` }}
      />
      {/* 顶部渐变横线 */}
      <div
        className="pointer-events-none absolute inset-x-4 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}55, transparent)`,
        }}
      />
      {children}
    </section>
  );
}

/** 面板标题栏（提取自 hubu 的 PanelTitle） */
export function ManorFrameTitle({
  title,
  action,
  accent,
}: {
  title: string;
  action?: string;
  accent: string;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-between border-b px-4 py-2.5"
      style={{ borderColor: `${accent}18` }}
    >
      <h2 className="font-serif text-[15px] font-semibold tracking-[0.1em] text-[#F5E9C9]">
        {title}
      </h2>
      {action ? (
        <span className="text-[11px] tracking-[0.08em] text-[#8B9AA2]">{action}</span>
      ) : null}
    </div>
  );
}
