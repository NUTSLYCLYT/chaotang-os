/**
 * 朝堂 OS V2 · 部门页面统一外壳
 *
 * 组合：DeptHeroBanner + DeptPageTabs + 主页/说明 tab 内容
 * 每个 dept 页面复用此 shell，保证排版一致。
 *
 *   <DeptPageShell deptKey="overview" variant="panorama">
 *     <MainContent />      // home tab 内容
 *   </DeptPageShell>
 */

'use client';

import { useState, type ReactNode } from 'react';
import {
  DEPT_HERO_CONFIG,
  DeptHeroBanner,
  type DeptHeroKey,
} from '@/features/shared/components/dept-hero-card';
import { AGENT_PROFILES } from '@/features/shared/lib/agent-profiles';
import { AgentGuidePanel } from '@/features/shared/components/agent-guide-panel';
import { PersonaQuoteStrip } from '@/features/shared/components/persona-quote-strip';
import {
  DeptPageTabs,
  DeptTabPanel,
  type DeptPageTabId,
  type DeptPageTab,
} from '@/features/shared/components/dept-page-tabs';

export interface DeptPageShellProps {
  /** dept 配置 key，对应 DEPT_HERO_CONFIG 和 AGENT_PROFILES */
  deptKey: DeptHeroKey;
  /** banner 变体 */
  variant?: 'split' | 'panorama';
  /** 主 metric 之外的 2-3 个副 metric */
  secondaryMetrics?: Array<{ label: string; value: string }>;
  /** 标题栏右侧工具条（状态指示、按钮等），渲染在主页 tab 内 banner 下方、tabs 上方 */
  pageToolbar?: ReactNode;
  /** 主页 tab 的内容 */
  children: ReactNode;
  /** 额外自定义 tabs（除 home / guide 外） */
  extraTabs?: Array<{ id: DeptPageTabId; label: string; badge?: string | number; content: ReactNode }>;
  /** 额外顶级 banner（如 ThroneBridgeBanner），在 hero 之上渲染 */
  topBanner?: ReactNode;
  /** 默认激活 tab */
  defaultTab?: DeptPageTabId;
  /** 隐藏 banner 下的"职责+可调用资源"条（主页面更简洁时用），资源信息仍在说明 tab 可查 */
  hideBannerProfile?: boolean;
  /** hero 密度，overview 这类判断页可用 compact 收紧首屏高度 */
  heroDensity?: 'default' | 'compact' | 'slim';
  /** tabs 密度，overview 这类判断页可用 compact 降低导航占高 */
  tabsDensity?: 'default' | 'compact';
}

export function DeptPageShell({
  deptKey,
  variant = 'split',
  secondaryMetrics,
  pageToolbar,
  children,
  extraTabs = [],
  topBanner,
  defaultTab = 'home',
  hideBannerProfile = false,
  heroDensity = 'default',
  tabsDensity = 'default',
}: DeptPageShellProps) {
  const config = DEPT_HERO_CONFIG[deptKey];
  const profile = AGENT_PROFILES[deptKey];
  const [tab, setTab] = useState<DeptPageTabId>(defaultTab);

  const tabs: DeptPageTab[] = [
    { id: 'home', label: '主页' },
    { id: 'guide', label: '说明' },
    ...extraTabs.map((t) => ({ id: t.id, label: t.label, badge: t.badge })),
  ];

  return (
    <div className="space-y-5">
      {topBanner}

      {/* Hero 大片（可选隐藏职责资源条，内容可在"说明"tab 查看） */}
      <DeptHeroBanner
        variant={variant}
        density={heroDensity}
        {...config}
        secondaryMetrics={secondaryMetrics}
      />

      {/* 人物简介 + AI 时代寄语（三体风格） */}
      {!hideBannerProfile && profile && (profile.historicalIntro || profile.aiEraQuote) && (
        <PersonaQuoteStrip
          personaName={config.personaName}
          accent={config.accent}
          historicalIntro={profile.historicalIntro}
          aiEraQuote={profile.aiEraQuote}
          duty={profile.duty}
        />
      )}

      {/* 工具条（按钮 / 状态 / 刷新等） */}
      {pageToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {pageToolbar}
        </div>
      )}

      {/* Tabs 切换 */}
      <DeptPageTabs
        tabs={tabs}
        active={tab}
        onChange={setTab}
        accent={config.accent}
        density={tabsDensity}
      />

      {/* 主页 tab */}
      <DeptTabPanel active={tab} id="home">
        {children}
      </DeptTabPanel>

      {/* 说明 tab */}
      <DeptTabPanel active={tab} id="guide">
        {profile && (
          <AgentGuidePanel
            profile={profile}
            accent={config.accent}
            personaName={config.personaName}
            personaEra={config.personaEra}
          />
        )}
      </DeptTabPanel>

      {/* 其他自定义 tab */}
      {extraTabs.map((t) => (
        <DeptTabPanel key={t.id} active={tab} id={t.id}>
          {t.content}
        </DeptTabPanel>
      ))}
    </div>
  );
}
