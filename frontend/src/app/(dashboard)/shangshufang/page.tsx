'use client';

/**
 * /court-briefing — 上书房
 *
 * 顶导由 (dashboard)/layout.tsx 的 ChaotangTopNav 统一接管,
 * 本页只负责挂载 ShangshufangPage 主体(三栏 + 浮层 + 背景画)。
 */

import { Suspense } from 'react';
import { ShangshufangPage } from '@/features/shangshufang/ShangshufangPage';

export default function CourtBriefingPage() {
  return (
    <div className="h-full w-full overflow-auto" style={{ background: '#04060E' }}>
      <Suspense fallback={null}>
        <ShangshufangPage />
      </Suspense>
    </div>
  );
}
