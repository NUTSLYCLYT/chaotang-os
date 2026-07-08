'use client';

/**
 * StudyCourtHeader — 上书房顶部御前导航
 *   左：朝堂 OS 标识 + 当前路径面包屑
 *   中：大殿 / 六部 / 九卿 / 任务 / AI中枢 / 数据 / 设置（真实跳转）
 *   右：历法 + 朝堂状态 + 数据链路 + AI 模型 + 通知 + 帮助 + 治理后台 + 用户
 */

import Link from 'next/link';
import { Crown, Bell, HelpCircle, ChevronDown, Shield, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { imperialDateToday } from '@/features/throne/lib/plain-language';
import { STUDY_NAV } from '@/features/chaotang/mock/study.mock';

const GOLD = '#F0C66A';

export function StudyCourtHeader({ pendingCount = 0 }: { pendingCount?: number }) {
  return (
    <header
      className="relative z-20 flex h-14 flex-shrink-0 items-center justify-between gap-4 border-b px-4 md:px-7"
      style={{
        background: 'linear-gradient(180deg, rgba(7,11,24,0.92), rgba(7,11,24,0.78))',
        borderColor: 'rgba(240,198,106,0.18)',
        backdropFilter: 'blur(14px)',
      }}
    >
      {/* 左：标识 + 面包屑 */}
      <div className="flex items-center gap-3">
        <Link href="/throne" className="flex items-center gap-2.5" title="返回大殿">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-md"
            style={{
              background: 'linear-gradient(135deg, rgba(240,198,106,0.28), rgba(138,106,42,0.1))',
              border: '1px solid rgba(240,198,106,0.45)',
            }}
          >
            <Crown size={16} className="text-[#F0C66A]" />
          </span>
          <span className="gold-text display-serif text-[16px] font-bold tracking-wider">朝堂 OS</span>
        </Link>
        <span className="hidden h-4 w-px bg-white/15 sm:block" />
        <span className="hidden text-[12px] text-[#9AA3C4] sm:inline">
          上书房 · <span className="text-[#C6CEE6]">AI 智能办公</span>
        </span>
      </div>

      {/* 中：主导航 */}
      <nav className="hidden items-center gap-1 lg:flex">
        {STUDY_NAV.map((n) =>
          n.active ? (
            <span
              key={n.label}
              className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
              style={{ color: GOLD, background: 'rgba(240,198,106,0.12)' }}
            >
              {n.label}
            </span>
          ) : (
            <Link
              key={n.label}
              href={n.href}
              className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-[#C6CEE6] transition-colors hover:bg-white/5 hover:text-[#F0C66A]"
            >
              {n.label}
            </Link>
          ),
        )}
      </nav>

      {/* 右：状态 + 历法 + 工具 + 用户 */}
      <div className="flex items-center gap-2 md:gap-3">
        <span className="hidden items-center gap-1.5 text-[11px] text-[#3DD68C] xl:flex">
          <Radio size={11} /> 朝堂就绪
        </span>
        <span className="hidden font-mono text-[11px] text-[#6A7299] md:inline">{imperialDateToday()}</span>

        <Link
          href="/governance"
          className="hidden rounded-full border px-3 py-1 text-[11px] text-[#C6CEE6] transition hover:text-[#F0C66A] md:inline-block"
          style={{ borderColor: 'rgba(255,255,255,0.1)' }}
        >
          治理后台
        </Link>

        <button
          type="button"
          onClick={() => toast(`您有 ${pendingCount} 件待裁决事项`, { description: '建议优先处理紧急奏折' })}
          className="relative flex h-8 w-8 items-center justify-center rounded-full text-[#9AA3C4] transition hover:bg-white/5 hover:text-[#F0C66A]"
          aria-label="通知"
        >
          <Bell size={15} />
          {pendingCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-[#04060E]"
              style={{ background: '#F43F5E' }}
            >
              {pendingCount > 99 ? '99+' : pendingCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => toast('上书房帮助', { description: '左为丞相判断，中为奏折台，右为钦天监；底部御笔下旨。' })}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[#9AA3C4] transition hover:bg-white/5 hover:text-[#F0C66A]"
          aria-label="帮助"
        >
          <HelpCircle size={15} />
        </button>

        <button
          type="button"
          onClick={() => toast('皇上', { description: '账户与偏好设置请前往「设置」。' })}
          className="flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2 transition hover:border-white/20"
          style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full"
            style={{ background: 'rgba(74,130,240,0.16)', border: '1px solid rgba(74,130,240,0.4)' }}
          >
            <Shield size={11} className="text-[#6BA0FF]" />
          </span>
          <span className="text-[12px] font-semibold text-[#F5E9C9]">皇上</span>
          <ChevronDown size={12} className="text-[#9AA3C4]" />
        </button>
      </div>
    </header>
  );
}
