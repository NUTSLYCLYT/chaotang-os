'use client';

/**
 * 朝堂 OS V2 · Stage D 设计图 1:1 代码复刻 — 可复用底层组件
 *
 * DesignOverlay: 整页容器,设计图作 CSS 背景(contain 锁比例,居中)。
 *   电影场景部分透出面板间隙。
 *
 * OverlayPanel: 绝对定位面板,坐标用设计图百分比表示,
 *   内放 GlassPanel(不透明覆盖设计图里对应面板区域) + 真实数据。
 *
 * TopNavOverlay: 在设计图 baked-in 顶部导航条上叠 9 个透明可点链接(D10),
 *   坐标来自 e2e test-prd-9space/findings.md NAV_LW 像素分析结果。
 *
 * 用法:
 *   <DesignOverlay image="/prd/hubu.webp" w={1672} h={941}>
 *     <TopNavOverlay space="hubu" />
 *     <OverlayPanel left={1.2} top={8.5} w={19.5} h={78} label="财政总览">
 *       … 真实数据内容 …
 *     </OverlayPanel>
 *   </DesignOverlay>
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode, CSSProperties } from 'react';
import { GlassPanel } from '@/components/ui/glass-panel';
import type { GlassPanelProps } from '@/components/ui/glass-panel';

// ─── TopNavOverlay: 9 可点导航热区 ──────────────────────────────────────────

/**
 * 9 个 PRD 模块 → 路由映射(D9)
 * 顺序对应 NAV_LW 数组下标 0-8
 */
const NAV_HREFS = [
  '/court-briefing',
  '/overview',
  '/departments',
  '/departments',
  '/departments',
  '/command-center',
  '/departments',
  '/archive',
  '/manors',
] as const;

const NAV_LABELS = ['上书房','大殿','户部','兵部','太医','军机处','锦衣卫','史馆','庄园'] as const;

/**
 * 逐页 NAV_LW 坐标 — 来源:e2e test-prd-9space/findings.md(PIL 像素分析)
 * 每行 = 9 个 [left%, width%] 按导航顺序
 * top/height: 1672×941 页 = {top:1.2, h:3.5}
 */
type SpaceKey = 'hubu' | 'dadian' | 'shangshufang' | 'bingbu' | 'taiyi' | 'junjichu' | 'jinyiwei' | 'shiguan' | 'zhuangyuan';

const NAV_LW: Record<SpaceKey, [number, number][]> = {
  shangshufang: [[23.7,4.7],[30.4,3.2],[35.6,3.2],[40.8,3.2],[46.2,3.2],[51.5,4.2],[57.6,4.3],[63.9,3.1],[69.1,3.2]],
  dadian:       [[12.5,3.9],[20.0,3.3],[26.9,3.2],[33.6,3.2],[40.2,3.2],[46.3,4.3],[53.2,4.4],[60.5,3.2],[66.7,3.2]],
  hubu:         [[22.8,3.9],[28.9,3.2],[34.9,3.8],[41.1,3.2],[46.7,3.1],[52.1,4.3],[58.6,4.2],[65.1,3.1],[70.3,3.1]],
  bingbu:       [[16.9,4.0],[23.5,3.2],[29.5,3.1],[35.3,3.3],[41.2,3.1],[46.8,4.3],[53.5,4.3],[60.6,3.1],[66.3,3.2]],
  taiyi:        [[17.3,3.9],[23.2,3.2],[28.5,3.2],[33.6,3.2],[38.6,3.4],[43.6,4.3],[49.7,4.3],[55.7,3.2],[60.8,3.2]],
  junjichu:     [[17.8,4.1],[24.8,3.1],[30.9,3.1],[37.0,3.1],[43.1,3.1],[49.0,4.2],[56.1,4.2],[63.2,3.1],[69.3,3.1]],
  jinyiwei:     [[13.9,3.9],[21.1,3.2],[27.5,3.2],[34.1,3.2],[40.6,3.2],[47.1,4.4],[54.7,4.4],[62.3,3.1],[68.5,3.2]],
  shiguan:      [[19.6,4.1],[26.7,3.1],[32.6,3.1],[38.3,3.1],[44.1,3.1],[49.5,4.1],[56.2,4.2],[63.2,3.1],[69.1,3.1]],
  zhuangyuan:   [[20.6,3.8],[27.3,2.9],[33.0,2.9],[38.5,2.9],[43.9,2.8],[49.2,3.8],[55.4,3.8],[61.7,2.8],[67.4,3.1]],
};

// 太医设计图高度不同(1448×1086),top/h 稍有调整
const NAV_TOP: Record<SpaceKey, number> = {
  shangshufang: 1.2, dadian: 1.2, hubu: 1.2, bingbu: 1.2,
  taiyi: 1.3,
  junjichu: 1.2, jinyiwei: 1.2, shiguan: 1.2, zhuangyuan: 1.2,
};
const NAV_H: Record<SpaceKey, number> = {
  shangshufang: 3.5, dadian: 3.5, hubu: 3.5, bingbu: 3.5,
  taiyi: 3.2,
  junjichu: 3.5, jinyiwei: 3.5, shiguan: 3.5, zhuangyuan: 3.5,
};

interface TopNavOverlayProps {
  /** 对应 public/prd/<space>.png 的 space slug */
  space: SpaceKey;
}

/**
 * 在设计图 baked-in 顶栏上覆盖 9 个透明可点链接(D10)。
 * 当前活跃模块加淡金高亮;鼠标悬停半透明金色。
 * 坐标来自 e2e PIL 像素分析(精确到 0.1%)。
 */
export function TopNavOverlay({ space }: TopNavOverlayProps) {
  const pathname = usePathname();
  const lw = NAV_LW[space] ?? NAV_LW.hubu;
  const top = NAV_TOP[space] ?? 1.2;
  const h   = NAV_H[space] ?? 3.5;

  return (
    <>
      {lw.map(([left, width], i) => {
        const href = NAV_HREFS[i];
        const label = NAV_LABELS[i];
        const isActive = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: `${top}%`,
              width: `${width}%`,
              height: `${h}%`,
              zIndex: 10,
              borderRadius: 3,
              background: isActive ? 'rgba(240,198,106,0.18)' : 'transparent',
              border: isActive ? '1px solid rgba(240,198,106,0.35)' : '1px solid transparent',
              transition: 'background 0.15s, border 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(240,198,106,0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
              }
            }}
          />
        );
      })}
    </>
  );
}

// ─── DesignOverlay ────────────────────────────────────────────────────────────

interface DesignOverlayProps {
  /** public/ 下的图路径,如 "/prd/hubu.webp" */
  image: string;
  /** 设计图原始宽(px),用于维持比例(不影响响应式,仅供 aspect-ratio) */
  w: number;
  /** 设计图原始高(px) */
  h: number;
  children?: ReactNode;
  className?: string;
}

/**
 * 整页设计图底层容器。
 * - 占满父容器(h-full w-full);父容器通常是 h-screen 的 <main>
 * - 背景图 contain 居中;黑色兜底防留白
 * - position:relative 供子 OverlayPanel absolute 定位
 */
export function DesignOverlay({ image, w, h, children, className = '' }: DesignOverlayProps) {
  const style: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    aspectRatio: `${w}/${h}`,
    backgroundImage: `url(${image})`,
    backgroundSize: 'contain',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    backgroundColor: '#060A0F',
    overflow: 'hidden',
  };
  return (
    <div className={`h-full w-full ${className}`} style={style}>
      {children}
    </div>
  );
}

// ─── OverlayPanel ─────────────────────────────────────────────────────────────

interface OverlayPanelProps {
  /** 距设计图左边百分比(0-100) */
  left: number;
  /** 距设计图顶部百分比(0-100) */
  top: number;
  /** 面板宽度百分比 */
  w: number;
  /** 面板高度百分比 */
  h: number;
  /** GlassPanel variant */
  variant?: GlassPanelProps['variant'];
  /** GlassPanel tone */
  tone?: GlassPanelProps['tone'];
  /** 内边距 */
  padding?: GlassPanelProps['padding'];
  /** debug 标签(开发时用于坐标校准) */
  label?: string;
  children?: ReactNode;
  className?: string;
  /** 外层 wrapper div 的额外样式 */
  style?: CSSProperties;
  /**
   * 覆盖 GlassPanel 背景色(用于需要半透明的面板,如中央藏书阁)。
   * 不设则使用 tone 对应的不透明背景。
   */
  glassBackground?: string;
}

/**
 * 按设计图百分比坐标定位的覆盖面板。
 * GlassPanel 背景完全不透明(tone=deep),遮住设计图里的静态面板,展示真实数据。
 */
export function OverlayPanel({
  left,
  top,
  w,
  h,
  variant = 'default',
  tone = 'deep',
  padding = 'sm',
  label,
  children,
  className = '',
  style: extraStyle,
  glassBackground,
}: OverlayPanelProps) {
  const posStyle: CSSProperties = {
    position: 'absolute',
    left: `${left}%`,
    top: `${top}%`,
    width: `${w}%`,
    height: `${h}%`,
    overflow: 'hidden',
    ...extraStyle,
  };

  const defaultBg = tone === 'deep'
    ? 'rgba(6,10,15,0.92)'
    : tone === 'elevated'
      ? 'rgba(12,16,32,0.88)'
      : 'rgba(8,12,24,0.85)';

  return (
    <div style={posStyle} aria-label={label}>
      <GlassPanel
        variant={variant}
        tone={tone}
        padding={padding}
        className={`h-full w-full overflow-y-auto ${className}`}
        style={{
          // Ensure full opacity — covers the design image panel beneath
          // glassBackground overrides for semi-transparent center panels
          background: glassBackground ?? defaultBg,
        }}
      >
        {children}
      </GlassPanel>
    </div>
  );
}
