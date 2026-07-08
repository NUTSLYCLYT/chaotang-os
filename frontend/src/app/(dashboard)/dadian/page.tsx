'use client';

/**
 * 大殿 · /overview
 *
 * 顶导由 (dashboard)/layout.tsx 的 ChaotangTopNav 统一接管,
 * 本页只渲染大殿主体(DadianPage)。
 */

import DadianPage from '@/features/dadian/components/DadianPage';

export default function OverviewPage() {
  return (
    <div className="h-full w-full overflow-auto" style={{ background: '#06111f' }}>
      <DadianPage />
    </div>
  );
}
