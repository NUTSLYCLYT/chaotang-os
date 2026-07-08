/**
 * 太医院 · 焦点状态 Context
 *
 * 跨 OrganAtlas / MeridianMap / NewsFeed / Hub 的焦点协调。
 * 哪个子视图被点中 → 右侧响应面板据此切换内容。
 */

'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

export type HealthFocus =
  | { kind: 'home' }
  | { kind: 'organ'; organId: string }
  | { kind: 'meridian'; meridianId: string; pointId?: string }
  | { kind: 'news'; newsId: string }
  | { kind: 'expert'; expertId: string }
  | {
      kind: 'module';
      moduleId: 'diagnosis' | 'vitals' | 'warning' | 'care-plan' | 'execution';
      title: string;
      summary: string;
      nextAction: string;
      tone?: string;
    };

interface HealthFocusValue {
  focus: HealthFocus;
  setFocus: (f: HealthFocus) => void;
}

const HealthFocusContext = createContext<HealthFocusValue | null>(null);

export function HealthFocusProvider({ children }: { children: ReactNode }) {
  const [focus, setFocus] = useState<HealthFocus>({ kind: 'home' });
  return (
    <HealthFocusContext.Provider value={{ focus, setFocus }}>
      {children}
    </HealthFocusContext.Provider>
  );
}

export function useHealthFocus() {
  const ctx = useContext(HealthFocusContext);
  if (!ctx) throw new Error('useHealthFocus must be used within HealthFocusProvider');
  return ctx;
}
