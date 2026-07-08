'use client';

/**
 * 庄园 · /manors
 *
 * 顶导由 (dashboard)/layout.tsx 的 TopBar 统一接管,
 * 本页只渲染庄园主体（ZhuangyuanPage）；ScaledStage 在 1672×941 画布内按容器宽度等比缩放。
 *
 * 数据来自 /api/court/zhuangyuan/metrics（源 /api/metrics 已命名空间化）。
 */

import ZhuangyuanPage from '@/features/zhuangyuan/components/ZhuangyuanPage';

export default function ManorsPage() {
  return (
    <div className="h-full w-full overflow-hidden" style={{ background: '#04060e' }}>
      <ZhuangyuanPage />
    </div>
  );
}
