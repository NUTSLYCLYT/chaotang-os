import Manor from "./Manor";

/**
 * 朝堂 OS · 庄园 — 1:1 矢量重构
 * 写实宫苑场景作背景；顶栏 / 左栏 / 六部卡片 / 右栏 / 底栏 全部为真实可交互组件。
 * 六部卡片点击弹出该分部详情。状态交互在 <Manor /> (client)。
 */
export default function ZhuangyuanPage() {
  return <Manor />;
}
