'use client';

/**
 * 全局命令面板 · ⌘K
 *
 * 跨两套视图（/throne/* 与 /(dashboard)/*）的统一跳转入口。
 * 决策者与工程师都用同一面板。
 */

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Command as CommandIcon,
  Crown,
  ScrollText,
  Eye,
  Building2,
  Heart,
  Telescope,
  BookOpen,
  FileText,
  Settings,
  ArrowRight,
  Brain,
  Sparkles,
  Bell,
  Cpu,
} from 'lucide-react';
import type { CourtPulse } from '../hooks/use-court-pulse';
import { useAppStore } from '@/lib/store/app-store';

export interface CommandPaletteProps {
  pulse?: CourtPulse;
}

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: '陛下视图' | '专业面板' | '快捷动作' | '警讯';
  icon: React.ReactNode;
  href: string;
  keywords?: string;
  badge?: { text: string; color: string };
  /** shown first when query is empty */
  pinned?: boolean;
}

export function CommandPalette({ pulse }: CommandPaletteProps) {
  const router = useRouter();
  const open = useAppStore((s) => s.commandPaletteOpen);
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard: ⌘K / Ctrl+K toggles; Esc closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen(!open);
        return;
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, setOpen]);

  // Listen for cross-component open event
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-command-palette', handler);
    return () => window.removeEventListener('open-command-palette', handler);
  }, [setOpen]);

  // Focus input + reset on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setCursor(0);
    }
  }, [open]);

  const items: CommandItem[] = useMemo(() => {
    const arr: CommandItem[] = [];

    // Pulse-driven urgent items
    if (pulse && pulse.pendingReviews > 0) {
      arr.push({
        id: 'urgent-reviews',
        title: `${pulse.pendingReviews} 份呈报待御批`,
        subtitle: '丞相已备好结论，恭候陛下画圈',
        category: '警讯',
        icon: <Bell size={14} className="text-[#F0C66A]" />,
        href: '/throne',
        badge: { text: `${pulse.pendingReviews}`, color: '#F0C66A' },
        pinned: true,
        keywords: '待批 呈报 御批 review pending',
      });
    }
    if (pulse && pulse.criticalSignals > 0) {
      arr.push({
        id: 'urgent-critical',
        title: `${pulse.criticalSignals} 条急报待处置`,
        subtitle: '锦衣卫急报，建议立即定夺',
        category: '警讯',
        icon: <Bell size={14} className="text-[#F43F5E]" />,
        href: '/intel',
        badge: { text: `${pulse.criticalSignals}`, color: '#F43F5E' },
        pinned: true,
        keywords: '急报 critical alert 锦衣卫',
      });
    }

    // Throne view destinations
    arr.push(
      {
        id: 'throne-home',
        title: '朝堂首页',
        subtitle: '今日一件事 · 决策者视图',
        category: '陛下视图',
        icon: <Crown size={14} className="text-[#F0C66A]" />,
        href: '/throne',
        keywords: 'throne home 朝堂 首页 today 陛下',
        pinned: true,
      },
      {
        id: 'throne-compose',
        title: '亲笔下达新旨',
        subtitle: '发令 · 仪式感输入',
        category: '陛下视图',
        icon: <ScrollText size={14} className="text-[#F0C66A]" />,
        href: '/throne/compose',
        keywords: 'compose 下旨 发令 command new task',
        pinned: true,
      },
      {
        id: 'throne-help',
        title: '新手三步指引',
        subtitle: '初来此系统？3 分钟读完',
        category: '陛下视图',
        icon: <Sparkles size={14} className="text-[#F0C66A]" />,
        href: '/throne/help',
        keywords: 'help onboarding 帮助 指引 新手',
      },
    );

    // Professional view destinations
    arr.push(
      {
        id: 'overview',
        title: '朝堂总览',
        subtitle: 'Imperial Overview · 全局态势',
        category: '专业面板',
        icon: <Crown size={14} className="text-[#9AA3C4]" />,
        href: '/overview',
        keywords: 'overview 总览 dashboard',
      },
      {
        id: 'command-center',
        title: '指挥台',
        subtitle: 'Command Center · 任务拆解',
        category: '专业面板',
        icon: <CommandIcon size={14} className="text-[#9AA3C4]" />,
        href: '/command-center',
        keywords: 'command center 指挥台 task',
        badge:
          pulse && pulse.pendingReviews > 0
            ? { text: `${pulse.pendingReviews}`, color: '#F0C66A' }
            : undefined,
      },
      {
        id: 'governance',
        title: '三省治理流',
        subtitle: 'Governance Flow · 起草、复核、下发',
        category: '专业面板',
        icon: <Bell size={14} className="text-[#9AA3C4]" />,
        href: '/governance',
        keywords: 'governance 三省 治理 中书 门下 尚书',
      },
      {
        id: 'manors',
        title: '庄园与蜂群',
        subtitle: 'Manors & Swarms · 业务承接与执行',
        category: '专业面板',
        icon: <Building2 size={14} className="text-[#9AA3C4]" />,
        href: '/manors',
        keywords: 'manor manors 庄园 蜂群 workbench 执行 销售 营销 电商',
      },
      {
        id: 'departments',
        title: '六部与专署',
        subtitle: 'Ministries & Bureaus · Agent 矩阵',
        category: '专业面板',
        icon: <Building2 size={14} className="text-[#9AA3C4]" />,
        href: '/departments',
        keywords: 'departments 六部 agent ministry',
      },
      {
        id: 'study',
        title: '上书房',
        subtitle: 'Study Hall · dossier 与御前批示',
        category: '专业面板',
        icon: <BookOpen size={14} className="text-[#9AA3C4]" />,
        href: '/study',
        keywords: 'study 上书房 dossier 召见 批注 独对',
      },
      {
        id: 'role-entrepreneur',
        title: '企业家视角',
        subtitle: '经营结论、风险和下一步',
        category: '专业面板',
        icon: <Building2 size={14} className="text-[#F0C66A]" />,
        href: '/roles/entrepreneur',
        keywords: 'role persona 企业家 经营 角色 视角',
      },
      {
        id: 'role-ai-enthusiast',
        title: 'AI爱好者视角',
        subtitle: '证据解释、流程和上下文',
        category: '专业面板',
        icon: <Brain size={14} className="text-[#7DD3FC]" />,
        href: '/roles/ai-enthusiast',
        keywords: 'role persona ai 爱好者 角色 视角 解释',
      },
      {
        id: 'role-ai-geek',
        title: 'AI极客视角',
        subtitle: '质门、分派和运行细节',
        category: '专业面板',
        icon: <Cpu size={14} className="text-[#A7F3D0]" />,
        href: '/roles/ai-geek',
        keywords: 'role persona ai 极客 角色 视角 调试',
      },
      {
        id: 'intel',
        title: '情报中心',
        subtitle: 'Intel Center · 锦衣卫全球网络',
        category: '专业面板',
        icon: <Eye size={14} className="text-[#9AA3C4]" />,
        href: '/intel',
        keywords: 'intel 情报 signal 锦衣卫',
        badge:
          pulse && (pulse.criticalSignals > 0 || pulse.warningSignals > 0)
            ? {
                text: `${pulse.criticalSignals + pulse.warningSignals}`,
                color: pulse.criticalSignals > 0 ? '#F43F5E' : '#F5A524',
              }
            : undefined,
      },
      {
        id: 'health',
        title: '健康中心',
        subtitle: 'Imperial Physician · 太医院',
        category: '专业面板',
        icon: <Heart size={14} className="text-[#9AA3C4]" />,
        href: '/health',
        keywords: 'health 健康 医疗 太医',
      },
      {
        id: 'forecast',
        title: '预测沙盘',
        subtitle: 'Forecast · 钦天监推演',
        category: '专业面板',
        icon: <Telescope size={14} className="text-[#9AA3C4]" />,
        href: '/forecast',
        keywords: 'forecast 预测 scenario 钦天监',
      },
      {
        id: 'reports',
        title: '战报库',
        subtitle: 'Reports · 定稿与归档文书',
        category: '专业面板',
        icon: <FileText size={14} className="text-[#9AA3C4]" />,
        href: '/reports',
        keywords: 'reports 战报 呈报 文书 定稿',
      },
      {
        id: 'scribe',
        title: '复盘台',
        subtitle: 'Review Desk · 个案复盘 · 相似召回',
        category: '专业面板',
        icon: <BookOpen size={14} className="text-[#9AA3C4]" />,
        href: '/scribe',
        keywords: 'scribe review 复盘 史官 相似 召回 memory 记忆',
      },
      {
        id: 'libu',
        title: '御书房',
        subtitle: 'Imperial Study · 卷宗上传 · RAG',
        category: '专业面板',
        icon: <BookOpen size={14} className="text-[#9AA3C4]" />,
        href: '/libu',
        keywords: 'libu 御书房 imperial study 知识库 卷宗 文库 rag',
      },
      {
        id: 'shiguan',
        title: '太史馆',
        subtitle: '归档规律 · 长期学习',
        category: '专业面板',
        icon: <ScrollText size={14} className="text-[#9AA3C4]" />,
        href: '/shiguan',
        keywords: 'shiguan 太史馆 归档 规律 长期 学习 archive annals',
      },
      {
        id: 'settings',
        title: '设置',
        subtitle: 'System Settings · 当前配置',
        category: '专业面板',
        icon: <Settings size={14} className="text-[#9AA3C4]" />,
        href: '/settings',
        keywords: 'settings 设置 config',
      },
    );

    // Quick actions
    arr.push(
      {
        id: 'action-compose',
        title: '⚡ 立即发令',
        subtitle: '跳转到亲笔朱批',
        category: '快捷动作',
        icon: <Sparkles size={14} className="text-[#F0C66A]" />,
        href: '/throne/compose',
        keywords: 'compose new task 发令',
      },
      {
        id: 'action-review',
        title: '⚡ 查看待批事项',
        subtitle: '跳转到指挥台 · 审阅与批示',
        category: '快捷动作',
        icon: <Sparkles size={14} className="text-[#F0C66A]" />,
        href: '/command-center',
        keywords: 'review 审阅 批示',
      },
      {
        id: 'action-study',
        title: '⚡ 进入上书房',
        subtitle: '阅读 dossier 与御前批示',
        category: '快捷动作',
        icon: <BookOpen size={14} className="text-[#F0C66A]" />,
        href: '/study',
        keywords: 'study 上书房 dossier',
      },
      {
        id: 'action-governance',
        title: '⚡ 去三省审议台',
        subtitle: '查看起草、复核与下发',
        category: '快捷动作',
        icon: <Sparkles size={14} className="text-[#F0C66A]" />,
        href: '/governance',
        keywords: 'governance 三省 会签',
      },
    );

    return arr;
  }, [pulse]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Sort: pinned first, then by category order
      return items.filter((i) => i.pinned || i.category === '警讯');
    }
    return items
      .map((item) => ({
        item,
        score: scoreMatch(item, q),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item);
  }, [items, query]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => Math.min(filtered.length - 1, c + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const target = filtered[cursor];
        if (target) {
          router.push(target.href);
          setOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, cursor, router]);

  // Reset cursor on query change
  useEffect(() => {
    setCursor(0);
  }, [query]);

  const groupedFiltered = useMemo(() => {
    const map = new Map<CommandItem['category'], CommandItem[]>();
    for (const item of filtered) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // Flat index for cursor highlight
  const flatIndex = useMemo(() => {
    const arr: { item: CommandItem; globalIdx: number }[] = [];
    let i = 0;
    for (const [, items] of groupedFiltered) {
      for (const item of items) {
        arr.push({ item, globalIdx: i });
        i++;
      }
    }
    return arr;
  }, [groupedFiltered]);

  const handleSelect = useCallback(
    (item: CommandItem) => {
      router.push(item.href);
      setOpen(false);
    },
    [router],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="命令面板"
      className="fixed inset-0 z-[90] flex items-start justify-center p-4 pt-[15vh]"
    >
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        style={{ animation: 'fadeIn 150ms ease-out' }}
      />
      <div
        role="document"
        className="relative z-10 w-full max-w-[560px] overflow-hidden rounded-2xl border"
        style={{
          borderColor: 'rgba(240, 198, 106, 0.3)',
          background:
            'linear-gradient(180deg, rgba(20, 16, 8, 0.97), rgba(10, 8, 4, 0.98))',
          boxShadow: '0 40px 120px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
          animation: 'slideDown 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
          <Search size={16} className="text-[#F0C66A]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索页面、动作、情报…"
            className="flex-1 bg-transparent text-[14px] text-[#FBF7EC] outline-none placeholder:text-[#6A7299]"
          />
          <kbd className="rounded border border-white/10 bg-black/30 px-2 py-0.5 font-mono text-[11px] text-[#9AA3C4]">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {groupedFiltered.length === 0 ? (
            <div className="px-5 py-12 text-center text-[12px] text-[#6A7299]">
              朝堂无此条目 — 试试"发令"、"情报"、"预测"
            </div>
          ) : (
            groupedFiltered.map(([category, items]) => (
              <div key={category} className="mb-2">
                <div className="px-5 py-1.5 text-[11px] uppercase tracking-[0.2em] text-[#6A7299]">
                  {category}
                </div>
                {items.map((item) => {
                  const idx = flatIndex.findIndex((x) => x.item.id === item.id);
                  const isActive = idx === cursor;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setCursor(idx)}
                      className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors"
                      style={{
                        background: isActive
                          ? 'linear-gradient(90deg, rgba(240,198,106,0.1), transparent 70%)'
                          : 'transparent',
                        borderLeft: isActive
                          ? '2px solid #F0C66A'
                          : '2px solid transparent',
                      }}
                    >
                      <span className="shrink-0">{item.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div
                          className="display-serif text-[13px] font-medium"
                          style={{
                            color: isActive ? '#FBF7EC' : '#EAEEFB',
                          }}
                        >
                          {item.title}
                        </div>
                        {item.subtitle && (
                          <div className="truncate text-[11px] text-[#9AA3C4]">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                      {item.badge && (
                        <span
                          className="rounded-full px-2 py-0.5 font-mono text-[11px] font-bold"
                          style={{
                            background: `${item.badge.color}22`,
                            color: item.badge.color,
                            border: `1px solid ${item.badge.color}55`,
                          }}
                        >
                          {item.badge.text}
                        </span>
                      )}
                      {isActive && (
                        <ArrowRight size={12} className="text-[#F0C66A]" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/5 px-5 py-2.5 text-[11px] text-[#6A7299]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono">↑↓</kbd>
              导航
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono">↵</kbd>
              选择
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono">Esc</kbd>
              关闭
            </span>
          </div>
          <span className="font-mono uppercase tracking-wider">CourtOS · ⌘K</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-16px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

/* ==========================================================================
   Match scoring
   ========================================================================== */

function scoreMatch(item: CommandItem, query: string): number {
  const haystack = [item.title, item.subtitle ?? '', item.keywords ?? '', item.category]
    .join(' ')
    .toLowerCase();
  if (haystack.includes(query)) return 100 - Math.max(0, haystack.indexOf(query));
  // subsequence
  let hi = 0;
  let matched = 0;
  for (let qi = 0; qi < query.length; qi++) {
    const c = query[qi];
    if (!c) continue;
    const idx = haystack.indexOf(c, hi);
    if (idx < 0) return 0;
    hi = idx + 1;
    matched++;
  }
  return matched >= query.length ? 10 : 0;
}
