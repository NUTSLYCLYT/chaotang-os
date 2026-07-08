'use client';

/**
 * WangColumn · 右栏 · 钦天监
 * 立像 + 「观星导师 · 先知用法」+ 教学列表（点条目 → 开教学弹窗）
 * 底部：御前工作台快捷问钦天监（→ 聚焦下旨框 · 问钦天监）
 */

import { AudioLines, BookOpenCheck, ChevronRight, Eye, GraduationCap, LineChart, Telescope, type LucideIcon } from 'lucide-react';

import type { WangTutorial } from '../types';
import { SHANGSHUFANG_ASSETS } from '../constants';
import { GlassPanel, PortraitBanner } from './atoms';

const GOLD = '#F0C66A';
const MAX_TUTORIAL_ITEMS = 2;

export type QintianDeepWorkId = 'teaching' | 'trend' | 'forecast';

export interface QintianDeepWorkItem {
  id: QintianDeepWorkId;
  title: string;
  subtitle: string;
  prompt: string;
  rows: string[];
  closing: string;
}

export function WangColumn({
  tutorials,
  onSelect,
  onQuickAsk,
  activeId,
  showQuickAsk = true,
  flush = false,
}: {
  tutorials: WangTutorial[];
  onSelect: (t: WangTutorial) => void;
  onQuickAsk: () => void;
  onDeepWorkSelect?: (item: QintianDeepWorkItem) => void;
  activeId?: string;
  showQuickAsk?: boolean;
  flush?: boolean;
}) {
  const visibleTutorials = tutorials.slice(0, MAX_TUTORIAL_ITEMS);
  const hiddenTutorialCount = Math.max(tutorials.length - visibleTutorials.length, 0);

  return (
    <GlassPanel accent={GOLD} className={flush ? 'h-full border-y-0' : 'h-full'} flush={flush}>
      {!flush && <PortraitBanner
        portrait={SHANGSHUFANG_ASSETS.portraitWang}
        name="钦天监"
        duty="观星导师 · 先知用法"
        objectPosition="center top"
        accent={GOLD}
        belowSlot={
          <span className="flex items-center gap-1" aria-hidden>
            <AudioLines size={15} className="text-[#F0C66A]/70" />
          </span>
        }
      />}

      {!flush && <div
        className="mx-4 mb-1 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${GOLD}40, transparent)` }}
        aria-hidden
      />}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
        <section className={`${flush ? 'rounded-none' : 'rounded-xl'} border border-[#F0C66A]/14 bg-[#05070D]/30 px-2.5 py-2`}>
          <div className="flex items-center gap-2 text-[10px] font-medium tracking-[0.12em] text-[#B6AB8C]">
            <span className="text-[#F0C66A]/75" aria-hidden>✦</span>
            <span>钦天监指导</span>
            <span className="h-px flex-1 bg-gradient-to-r from-[#F0C66A]/18 to-transparent" aria-hidden />
          </div>
          <div className="mt-2 space-y-1">
            {visibleTutorials.map((t) => {
              const featured = t.id === activeId;
              return (
                <button
                  key={t.id}
                  type="button"
                  data-testid="qintian-visible-item"
                  onClick={() => onSelect(t)}
                  aria-current={featured ? 'true' : undefined}
                  className={`group relative flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all ${
                    featured
                      ? 'border-[#F0C66A]/32 bg-[#F0C66A]/[0.065]'
                      : 'border-transparent hover:border-[#F0C66A]/20 hover:bg-[#F0C66A]/[0.04]'
                  }`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#F0C66A]/18 bg-[#F0C66A]/[0.045]">
                    <GraduationCap size={13} className="text-[#F0C66A]/85" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[11.5px] transition-colors ${featured ? 'text-[#F5E9C9]' : 'text-[#EAEEFB] group-hover:text-[#F5E9C9]'}`}
                      style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, letterSpacing: '0.025em' }}
                    >
                      {t.title}
                    </span>
                  </span>
                  <ChevronRight size={12} className={`shrink-0 transition-colors ${featured ? 'text-[#F0C66A]' : 'text-[#5a5340] group-hover:text-[#F0C66A]'}`} />
                </button>
              );
            })}
            {hiddenTutorialCount > 0 && (
              <div className="px-1 pt-1 text-[9px] tracking-[0.08em] text-[#6A7299]">
                另 {hiddenTutorialCount} 条教程入后台。
              </div>
            )}
          </div>
        </section>
      </div>

      {showQuickAsk && <WangMentorAskButton onClick={onQuickAsk} className="m-3 mt-1" />}
    </GlassPanel>
  );
}

const LEGACY_DEEP_WORK_ITEMS_UNUSED = [
  {
    id: 'teaching',
    title: '专业教学',
    subtitle: '软件工程 · 财务 · 组织管理',
    prompt: '钦天监，请按顶级企业管理课方式，教我今天这件事背后的软件工程、财务和组织管理方法。',
    rows: [
      '软件工程看“可验证状态”：先把大问题拆成输入、处理、输出、验收四段；任何无法验收的愿望，都先改写成可观察指标。',
      '财务看“现金与风险敞口”：不要只问该不该做，先问占用多少现金、最坏损失多少、多久能回款、哪一步会让亏损不可逆。',
      '组织管理看“责任闭环”：每个判断必须有 owner、截止时点、证据口径和复盘入口；否则系统会把讨论误当执行。',
    ],
    closing: '教学结论：先把旨意写成一条可验收任务，再让丞相或蜂群承办。',
    icon: BookOpenCheck,
  },
  {
    id: 'trend',
    title: '大势分析',
    subtitle: '行业 · 竞争 · 客户结构 · 技术趋势',
    prompt: '钦天监，请对今天这件事做行业大势、竞争格局、客户结构和技术趋势分析。',
    rows: [
      '行业大势：先判断这是需求扩张、供给收缩、成本迁移，还是政策/技术重定价；四类变化对应完全不同的行动节奏。',
      '竞争格局：看对手是否在抢窗口、清库存、抢标准或锁渠道；若对手动作不可持续，就不要被短期噪声拖着走。',
      '客户结构：把客户分成“愿意付费验证”“只要低价”“需要背书”“等待成熟”四类，再决定先打哪一类样本。',
      '技术趋势：只采纳能改变成本曲线、交付周期或风险边界的趋势；不能落到这三项的热词，先入史馆备查，不入圣旨。',
    ],
    closing: '分析结论：先找决定窗口期的变量，再决定是抢先、观望、补证还是撤退。',
    icon: LineChart,
  },
  {
    id: 'forecast',
    title: '预测推演',
    subtitle: '90 天后果 · 反事实 · 黑天鹅',
    prompt: '钦天监，请推演这件事未来 90 天的三种结果、关键假设、反事实和黑天鹅风险。',
    rows: [
      '基准情形：按当前证据推进，90 天内形成一次可复盘结果；关键不是预测准确，而是每两周校准假设。',
      '上行情形：若客户/市场/内部资源同时配合，应提前准备扩容动作，避免机会来了却被流程拖住。',
      '下行情形：若核心证据被证伪，必须预设止损阈值；到点不争辩，直接退回补证或驳回。',
      '反事实：问“如果今天不做，三个月后会后悔什么”；再问“如果今天做错，哪个后果最难逆转”。',
      '黑天鹅：重点看外部政策、关键供应、客户承诺、舆情反噬与现金流断点，任何一项触发都要进人工确认门。',
    ],
    closing: '预测结论：用小步验证换掉一次性豪赌，把不可逆风险挡在下旨之前。',
    icon: Telescope,
  },
] satisfies Array<QintianDeepWorkItem & { icon: LucideIcon }>;

const DEEP_WORK_ITEMS = [
  {
    id: 'teaching',
    title: '专业教学',
    subtitle: '软件工程 · 财务 · 组织管理',
    prompt: '钦天监，请按顶级企业管理课的方式，讲清今天这件事背后的软件工程、财务和组织管理方法。',
    rows: [
      '软件工程：先把大问题拆成输入、处理、输出、验收四段；任何无法验收的愿望，都要改写成可观察指标。',
      '财务：不要只问该不该做，先问占用多少现金、最坏损失多少、多久能回款、哪一步会造成不可逆亏损。',
      '组织管理：每个判断都必须有 owner、截止时间、证据入口和复盘入口，否则系统会把讨论误当执行。',
    ],
    closing: '教学结论：先把圣意写成一条可验收任务，再交给丞相或蜂群承办。',
    icon: BookOpenCheck,
  },
  {
    id: 'trend',
    title: '大势分析',
    subtitle: '行业 · 竞争 · 客户结构 · 技术趋势',
    prompt: '钦天监，请对今天这件事做行业大势、竞争格局、客户结构和技术趋势分析。',
    rows: [
      '行业大势：先判断这是需求扩张、供给收缩、成本迁移，还是政策/技术重定价；四类变化对应完全不同的行动节奏。',
      '竞争格局：看对手是否在抢窗口、清库存、抢标准或锁渠道；若对手动作不可持续，就不要被短期噪声拖着走。',
      '客户结构：把客户分成愿意付费验证、只要低价、需要背书、等待成熟四类，再决定先打哪一类样本。',
      '技术趋势：只采纳能改变成本曲线、交付周期或风险边界的趋势；不能落到这三项的热词先入史馆备查。',
    ],
    closing: '分析结论：先找决定窗口期的变量，再决定是抢先、观望、补证还是撤退。',
    icon: LineChart,
  },
  {
    id: 'forecast',
    title: '预测推演',
    subtitle: '90 天后果 · 反事实 · 黑天鹅',
    prompt: '钦天监，请推演这件事未来 90 天的三种结果、关键假设、反事实和黑天鹅风险。',
    rows: [
      '基准情形：按当前证据推进，90 天内形成一次可复盘结果；关键不是预测准确，而是每两周校准假设。',
      '上行情形：若客户、市场和内部资源同时配合，应提前准备扩容动作，避免机会来了却被流程拖住。',
      '下行情形：若核心证据被证伪，必须预设止损阈值；到点不争辩，直接退回补证或驳回。',
      '反事实：先问“如果今天不做，三个月后会后悔什么”；再问“如果今天做错，哪个后果最难逆转”。',
      '黑天鹅：重点看外部政策、关键供应、客户承诺、舆情反噬和现金流断点，任何一项触发都要进人工确认门。',
    ],
    closing: '预测结论：用小步验证替代一次性豪赌，把不可逆风险挡在下旨之前。',
    icon: Telescope,
  },
] satisfies Array<QintianDeepWorkItem & { icon: LucideIcon }>;

function DeepWorkPanel({ onSelect, flush = false }: { onSelect: (item: QintianDeepWorkItem) => void; flush?: boolean }) {
  return (
    <section
      data-testid="qintian-deep-work"
      aria-label="钦天监深层工作"
      className={`${flush ? 'rounded-none' : 'rounded-xl'} border border-[#F0C66A]/16 bg-[#05070D]/35 p-2.5`}
    >
      <div className="mb-2 flex items-center gap-2 px-0.5">
        <span className="text-[8px] text-[#F0C66A]/75" aria-hidden>◆</span>
        <span className="text-[10px] font-medium tracking-[0.14em] text-[#B6AB8C]">观星三问</span>
        <span className="h-px flex-1 bg-gradient-to-r from-[#F0C66A]/18 to-transparent" aria-hidden />
      </div>
      <div className="grid gap-1.5">
        {DEEP_WORK_ITEMS.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              data-testid="qintian-visible-item"
              onClick={() => onSelect(item)}
              className="group relative flex w-full items-start gap-2 overflow-hidden rounded-lg border px-2.5 py-2 text-left transition-all hover:border-[#F0C66A]/28 hover:bg-[#F0C66A]/[0.055]"
              style={{
                borderColor: 'rgba(240,198,106,0.10)',
                background:
                  index === 0
                    ? 'linear-gradient(90deg, rgba(240,198,106,0.075), rgba(5,7,13,0.08))'
                    : 'rgba(255,255,255,0.015)',
              }}
            >
              <span className="pointer-events-none absolute right-2 top-1 text-[18px] font-black text-[#F0C66A]/[0.055]" style={{ fontFamily: 'var(--font-serif)' }}>
                {index + 1}
              </span>
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#F0C66A]/18 bg-[#F0C66A]/[0.05]" aria-hidden>
                <Icon size={12} className="text-[#F0C66A]/80" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold text-[#F5E9C9]" style={{ fontFamily: 'var(--font-serif)', letterSpacing: '0.025em' }}>
                  {item.title}
                </span>
                <span className="mt-0.5 block text-[10px] leading-[1.45] text-[#8F835F]">
                  {item.subtitle}
                </span>
              </span>
              <ChevronRight size={12} className="mt-1 shrink-0 text-[#5a5340] transition-colors group-hover:text-[#F0C66A]" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function WangMentorAskButton({
  onClick,
  active = false,
  className = '',
  testId,
}: {
  onClick: () => void;
  active?: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      aria-pressed={active}
      className={`group flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all hover:border-[#F0C66A]/40 hover:bg-[#F0C66A]/[0.07] ${
        active ? 'border-[#F0C66A]/48 bg-[#F0C66A]/[0.09]' : 'border-[#F0C66A]/18 bg-[#F0C66A]/[0.035]'
      } ${className}`}
    >
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-[#F0C66A]/20 bg-[#F0C66A]/[0.045]" aria-hidden>
        <Eye size={12} className="text-[#F0C66A]/80" />
      </span>
      <span className="min-w-0 flex-1">
        {/* 称谓统一：与右栏立绘同名"钦天监"，行为=聚焦输入框问钦天监 */}
        <span className="block text-[10px] font-medium tracking-[0.08em] text-[#B6AB8C]">问钦天监</span>
        <span className="block truncate text-[11.5px] text-[#C6BB9D]">
          打开御前 IM，先问下一步与风险窗口
        </span>
      </span>
      <ChevronRight size={13} className="flex-shrink-0 text-[#5a5340] transition-colors group-hover:text-[#F0C66A]" />
    </button>
  );
}
