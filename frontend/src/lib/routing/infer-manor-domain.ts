import type { ManorDomain } from '@/types/manor';
import { MANOR_KEYWORD_MAP } from './manor-keywords';

export function inferManorDomain(text: string): ManorDomain {
  const scores: Record<string, number> = {};
  for (const [domain, entries] of MANOR_KEYWORD_MAP) {
    let score = 0;
    for (const { keyword, weight } of entries) {
      if (text.includes(keyword)) score += weight;
    }
    scores[domain] = score;
  }
  const sorted = (Object.entries(scores) as [ManorDomain, number][]).sort((a, b) => b[1] - a[1]);
  const best = sorted[0];
  return best && best[1] > 0 ? best[0] : 'legal';
}
