'use client';

/**
 * 御座室外壳 · CourtShell
 *
 * 统一朝堂全局壳:整个产品 = 一间御座室,四方位定权力。
 *   左 = 丞相·辅政    右 = 钦天监·训诲
 *   底 = 御前对话栏·下旨    中 = 当前要务的真身(舞台,每页不同)
 *
 * 四个方位含义固定,只有中央随页面变 —— 这就是"同一间御座室,换了案子"的一致感。
 * 两侧立柱默认收起(待命),点开滑出浮层,**不挤压中央舞台**。
 *
 * 用法:页面把自己的"舞台"作为 children 传入,壳负责辅臣与对话栏。
 * 冻结 token 不动,纯布局/信息架构。
 */

import { useState, type ReactNode } from 'react';
import { AdvisorRail, type AdvisorRailConfig } from './AdvisorRail';
import { CourtDialogueBar, type CourtDialogueBarProps } from './CourtDialogueBar';

const RAIL_WIDTH = 56;
const DIALOGUE_HEIGHT = 88;

export interface CourtShellProps {
  /** 左·丞相·辅政 */
  chancellor: AdvisorRailConfig;
  /** 右·钦天监·训诲 */
  astrologer: AdvisorRailConfig;
  /** 底·御前对话栏 */
  dialogue: CourtDialogueBarProps;
  /** 中央舞台 */
  children: ReactNode;
  /** 舞台内边距(px),默认 0;角面板自行定位时留 0 */
  stagePadding?: number;
  /** 是否显示左右辅臣立柱，默认显示 */
  showAdvisors?: boolean;
}

export function CourtShell({
  chancellor,
  astrologer,
  dialogue,
  children,
  stagePadding = 0,
  showAdvisors = true,
}: CourtShellProps) {
  const [expanded, setExpanded] = useState<null | 'left' | 'right'>(null);
  const railInset = showAdvisors ? RAIL_WIDTH : 0;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* ── 中央舞台 ── 左右留出立柱、底部留出对话栏 */}
      <div
        style={{
          position: 'absolute',
          left: railInset,
          right: railInset,
          top: 0,
          bottom: DIALOGUE_HEIGHT,
          padding: stagePadding,
        }}
      >
        {children}
      </div>

      {/* ── 展开时的点击遮罩:点空白处收起辅臣 ── */}
      {showAdvisors && expanded && (
        <button
          type="button"
          aria-label="收起辅臣"
          onClick={() => setExpanded(null)}
          style={{ position: 'absolute', inset: 0, zIndex: 36, border: 'none', background: 'rgba(2,5,10,0.28)', cursor: 'default' }}
        />
      )}

      {showAdvisors ? (
        <>
          {/* ── 左:丞相·辅政 ── */}
          <AdvisorRail
            side="left"
            config={chancellor}
            railWidth={RAIL_WIDTH}
            bottomInset={DIALOGUE_HEIGHT}
            expanded={expanded === 'left'}
            onToggle={() => setExpanded((e) => (e === 'left' ? null : 'left'))}
          />

          {/* ── 右:钦天监·训诲 ── */}
          <AdvisorRail
            side="right"
            config={astrologer}
            railWidth={RAIL_WIDTH}
            bottomInset={DIALOGUE_HEIGHT}
            expanded={expanded === 'right'}
            onToggle={() => setExpanded((e) => (e === 'right' ? null : 'right'))}
          />
        </>
      ) : null}

      {/* ── 底:御前对话栏(统一,每页都在) ── */}
      <div
        style={{
          position: 'absolute',
          left: railInset + 8,
          right: railInset + 8,
          bottom: 8,
          height: DIALOGUE_HEIGHT - 14,
          zIndex: 32,
        }}
      >
        <CourtDialogueBar {...dialogue} />
      </div>
    </div>
  );
}
