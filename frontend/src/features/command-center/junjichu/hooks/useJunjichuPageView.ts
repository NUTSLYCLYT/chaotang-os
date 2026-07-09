'use client';

import { useMemo } from 'react';
import { deriveJunjichuPageView, type DeriveJunjichuPageViewInput } from '../model/derive-page-view';

export function useJunjichuPageView(input: DeriveJunjichuPageViewInput) {
  return useMemo(() => deriveJunjichuPageView(input), [input]);
}
