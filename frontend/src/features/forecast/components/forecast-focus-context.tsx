/**
 * 观天台 · 焦点状态 Context
 */

'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

export type ForecastFocus =
  | { kind: 'home' }
  | { kind: 'scenario'; scenarioId: string }
  | { kind: 'riskWindow'; scenarioId: string; windowId: string }
  | { kind: 'trigger'; scenarioId: string; triggerId: string };

interface ForecastFocusValue {
  focus: ForecastFocus;
  setFocus: (f: ForecastFocus) => void;
}

const ForecastFocusContext = createContext<ForecastFocusValue | null>(null);

export function ForecastFocusProvider({ children }: { children: ReactNode }) {
  const [focus, setFocus] = useState<ForecastFocus>({ kind: 'home' });
  return (
    <ForecastFocusContext.Provider value={{ focus, setFocus }}>
      {children}
    </ForecastFocusContext.Provider>
  );
}

export function useForecastFocus() {
  const ctx = useContext(ForecastFocusContext);
  if (!ctx) throw new Error('useForecastFocus must be used within ForecastFocusProvider');
  return ctx;
}
