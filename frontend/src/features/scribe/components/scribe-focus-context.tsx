/**
 * 史馆 · 焦点状态 Context
 */

'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

export type ScribeFocus =
  | { kind: 'home' }
  | { kind: 'entry'; entryId: string }
  | { kind: 'lesson'; lessonTag: string };

interface ScribeFocusValue {
  focus: ScribeFocus;
  setFocus: (f: ScribeFocus) => void;
}

const Ctx = createContext<ScribeFocusValue | null>(null);

export function ScribeFocusProvider({ children }: { children: ReactNode }) {
  const [focus, setFocus] = useState<ScribeFocus>({ kind: 'home' });
  return <Ctx.Provider value={{ focus, setFocus }}>{children}</Ctx.Provider>;
}

export function useScribeFocus() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useScribeFocus must be used within ScribeFocusProvider');
  return ctx;
}
