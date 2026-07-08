export type WhatIfLeverKey = 'macro' | 'execution' | 'geopolitics';

export interface WhatIfLevers {
  macro: number;
  execution: number;
  geopolitics: number;
}

export const DEFAULT_WHAT_IF_LEVERS: WhatIfLevers = {
  macro: 0,
  execution: 0,
  geopolitics: 0,
};

const VALID_TABS = new Set([
  'hub',
  'domains',
  'classical',
  'astronomy',
  'weather',
  'scenarios',
  'history',
]);

function clampLever(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.min(1, Math.max(-1, value));
  return Math.round(clamped * 20) / 20;
}

export function parseWhatIfTab(value: string | null | undefined) {
  return value && VALID_TABS.has(value) ? value : 'hub';
}

export function parseWhatIfLevers(
  getValue:
    | URLSearchParams
    | {
        get: (key: string) => string | null | undefined;
      },
): WhatIfLevers {
  return {
    macro: clampLever(Number(getValue.get('macro') ?? 0)),
    execution: clampLever(Number(getValue.get('execution') ?? 0)),
    geopolitics: clampLever(Number(getValue.get('geopolitics') ?? 0)),
  };
}

export function areWhatIfLeversEqual(left: WhatIfLevers, right: WhatIfLevers) {
  return (
    left.macro === right.macro &&
    left.execution === right.execution &&
    left.geopolitics === right.geopolitics
  );
}

export function buildForecastSearchParams({
  tab,
  scenarioId,
  levers,
}: {
  tab: string;
  scenarioId: string | null;
  levers: WhatIfLevers;
}) {
  const params = new URLSearchParams();

  if (tab !== 'hub') params.set('tab', tab);
  if (scenarioId) params.set('scenario', scenarioId);

  (Object.entries(levers) as [WhatIfLeverKey, number][]).forEach(([key, value]) => {
    if (value !== 0) params.set(key, String(value));
  });

  return params;
}

