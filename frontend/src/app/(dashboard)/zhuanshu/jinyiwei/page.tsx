/**
 * 朝堂 OS · 专署情报中心（锦衣卫）
 *
 * 三栏布局对标上书房：
 *   左栏 · 戚继光夜巡总旗 + 预警信号
 *   中栏 · 密报卷轴（世界地图）
 *   右栏 · 前沿入口 + 六部情报分拨
 *
 * 数据来源：GET /api/court/intel/signals → Turso intel_signals 表（useSWR）
 */

import { JinyiweiPage } from '@/features/intel/JinyiweiPage';

export default function IntelCenterPage() {
  return <JinyiweiPage />;
}
