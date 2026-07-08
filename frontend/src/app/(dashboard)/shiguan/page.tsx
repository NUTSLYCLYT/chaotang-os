'use client';

/**
 * 史馆 · /shiguan
 *
 * 整页替换为 D:/workspace/test/shiguan 的独立效果页面（ShiguanPage）。
 * 与 /archive 同源，沿用统一沉浸壳层。
 */

import ShiguanPage from '@/features/shiguan-ui/components/ShiguanPage';
import { assetUrl } from '@/lib/asset';
import { Suspense } from 'react';

export default function ShiguanRoutePage() {
  return (
    <div
      className="fixed inset-0 z-[60] overflow-auto"
      style={{
        backgroundColor: '#070b16',
        backgroundImage: `url('${assetUrl('/assets/shiguan/shiguan.webp')}')`,
        backgroundPosition: 'center top',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="relative" style={{ zIndex: 1 }}>
        <Suspense fallback={null}>
          <ShiguanPage />
        </Suspense>
      </div>
    </div>
  );
}
