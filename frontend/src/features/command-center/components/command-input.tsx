'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { Send, Zap, Sparkles, Bot, Loader2, Wand2, FileText, SlidersHorizontal } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import type { ExecutionMode, Task } from '@/types/task';
import { useAppStore } from '@/lib/store/app-store';

const MODES: { value: ExecutionMode; label: string; sublabel: string; Icon: typeof Zap }[] = [
  { value: 'scripted', label: 'Scripted', sublabel: '脚本演示', Icon: Zap },
  { value: 'hybrid', label: 'Hybrid', sublabel: '规则 + LLM', Icon: Sparkles },
  { value: 'live', label: 'Live', sublabel: '全 LLM 实时', Icon: Bot },
];

type EmperorStyle = 'diligent' | 'tolerant';
type UserHabit = 'beginner' | 'player' | 'expert' | 'geek';
type DraftChoice = 'optimized' | 'original';

const EMPEROR_STYLES: { value: EmperorStyle; label: string; sublabel: string }[] = [
  { value: 'diligent', label: '勤政陛下', sublabel: '目标明确 · 证据优先' },
  { value: 'tolerant', label: '宽容陛下', sublabel: '允许探索 · 先学后定' },
];

const USER_HABITS: { value: UserHabit; label: string; sublabel: string }[] = [
  { value: 'beginner', label: '小白', sublabel: '少术语' },
  { value: 'player', label: '玩家', sublabel: '看成长' },
  { value: 'expert', label: '资深', sublabel: '看证据' },
  { value: 'geek', label: '极客', sublabel: '看契约' },
];

export interface CommandInputProps {
  onSubmit: (rawCommand: string, mode: ExecutionMode) => Promise<Task | null>;
  onIssued?: (task: Task) => void;
  autoFocus?: boolean;
}

export function CommandInput({ onSubmit, onIssued, autoFocus = true }: CommandInputProps) {
  const consumePendingCommandText = useAppStore((s) => s.consumePendingCommandText);
  const [raw, setRaw] = useState('');
  const [mode, setMode] = useState<ExecutionMode>('hybrid');
  const [emperorStyle, setEmperorStyle] = useState<EmperorStyle>('diligent');
  const [userHabit, setUserHabit] = useState<UserHabit>('beginner');
  const [professional, setProfessional] = useState(false);
  const [draftChoice, setDraftChoice] = useState<DraftChoice>('optimized');
  const [surveyVisible, setSurveyVisible] = useState(false);
  const [surveyAnswer, setSurveyAnswer] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastIssued, setLastIssued] = useState<{
    title: string;
    mode: ExecutionMode;
    commandMode: string;
    commandChoice: DraftChoice;
    at: string;
  } | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const draft = useMemo(
    () => buildPrimeMinisterDraft(raw, emperorStyle, userHabit, professional),
    [raw, emperorStyle, userHabit, professional],
  );

  useEffect(() => {
    const pending = consumePendingCommandText();
    if (pending) {
      setRaw(pending);
      ref.current?.focus();
      setTimeout(() => {
        if (ref.current) {
          ref.current.selectionStart = ref.current.value.length;
          ref.current.selectionEnd = ref.current.value.length;
        }
      }, 0);
    } else if (autoFocus) {
      ref.current?.focus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (!raw.trim() || submitting) return;
    const finalCommand = draftChoice === 'optimized' ? draft.optimized : raw.trim();
    setSubmitting(true);
    try {
      const created = await onSubmit(finalCommand, mode);
      if (created) {
        setLastIssued({
          title: created.title,
          mode,
          commandMode: draft.emperorLabel,
          commandChoice: draftChoice,
          at: new Date().toISOString(),
        });
        onIssued?.(created);
        setRaw('');
        setSurveyVisible(true);
        setSurveyAnswer(null);
        // 金玺落印 · 「令」字朱印
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('court:seal-stamp', {
              detail: { verdict: '行', note: '新令已发' },
            }),
          );
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GlassPanel variant="gold" tone="elevated" padding="lg" hudCorners>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-[#F0C66A]">
          陛下请亲笔 · 丞相拟旨
        </div>
        <div className="text-[9px] text-[#6A7299]">Cmd/Ctrl + Enter 快速发令</div>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1.1fr_auto]">
        <SegmentGroup
          title="陛下模式"
          items={EMPEROR_STYLES}
          value={emperorStyle}
          onChange={setEmperorStyle}
        />
        <SegmentGroup
          title="操作习惯"
          items={USER_HABITS}
          value={userHabit}
          onChange={setUserHabit}
        />
        <button
          type="button"
          onClick={() => setProfessional((value) => !value)}
          className={[
            'flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-[11px] transition-all',
            professional
              ? 'border-[#F0C66A] bg-[#F0C66A]/10 text-[#F0C66A]'
              : 'border-[#1A2142]/80 text-[#9AA3C4] hover:border-[#2C355E]',
          ].join(' ')}
        >
          <SlidersHorizontal size={13} />
          {professional ? '专业化已开' : '深入细化'}
        </button>
      </div>

      <textarea
        ref={ref}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        rows={3}
        disabled={submitting}
        placeholder="例：制定 2027 年新品发布战略，需要财务评估、技术可行性、营销策略、竞品扫描、全球监管情报和未来推演"
        className="w-full resize-none rounded-lg border border-[#1A2142]/80 bg-transparent p-3 text-[13px] leading-relaxed text-[#EAEEFB] outline-none transition-colors placeholder:text-[#484F72] focus:border-[#F0C66A]/60 disabled:opacity-60"
      />

      <div className="mt-3 rounded-xl border border-[#1A2142]/80 bg-[#050816]/55 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[#F0C66A]">
              <Wand2 size={12} />
              Prime Minister Draft · 丞相优化
            </div>
            <div className="mt-1 text-[11px] leading-5 text-[#9AA3C4]">
              默认按丞相拟旨下旨；若你担心意思被改动，可切回原文。
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ChoiceButton
              active={draftChoice === 'optimized'}
              icon={<Wand2 size={12} />}
              label="按丞相拟旨"
              onClick={() => setDraftChoice('optimized')}
            />
            <ChoiceButton
              active={draftChoice === 'original'}
              icon={<FileText size={12} />}
              label="按原文"
              onClick={() => setDraftChoice('original')}
            />
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-[#273052]/70 bg-[#080C1D] p-3 text-[12px] leading-6 text-[#C8CDD8]">
          {raw.trim()
            ? draftChoice === 'optimized'
              ? draft.optimized
              : raw.trim()
            : '写下原始想法后，丞相会自动整理成可路由、可审查、可归档的旨意。'}
        </div>
        {raw.trim() && (
          <div className="mt-2 text-[10px] leading-5 text-[#6A7299]">
            拟旨依据：{draft.emperorLabel} · {draft.habitLabel} · {professional ? '专业化' : '标准闭环'}。
          </div>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="flex-1">
          <div className="mb-1.5 text-[9px] uppercase tracking-wider text-[#6A7299]">
            执行模式
          </div>
          <div className="flex gap-2">
            {MODES.map((m) => {
              const Icon = m.Icon;
              const active = mode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  className={[
                    'flex items-center gap-2 rounded-md border px-3 py-2 text-[11px] transition-all',
                    active
                      ? 'border-[#F0C66A] bg-[#F0C66A]/10 text-[#F0C66A]'
                      : 'border-[#1A2142]/80 text-[#9AA3C4] hover:border-[#2C355E]',
                  ].join(' ')}
                >
                  <Icon size={12} />
                  <span className="font-medium">{m.label}</span>
                  <span className="text-[9px] opacity-60">{m.sublabel}</span>
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!raw.trim() || submitting}
          className="flex items-center gap-2 rounded-md bg-gradient-to-br from-[#F0C66A] to-[#D4A84B] px-5 py-2.5 text-[12px] font-semibold text-[#04060E] shadow-[0_0_20px_rgba(240,198,106,0.3)] transition-all disabled:opacity-30"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {submitting ? '下旨中' : '正式下旨'}
        </button>
      </div>

      {surveyVisible && (
        <div className="mt-4 rounded-2xl border border-[#D4A84B]/20 bg-[#D4A84B]/[0.05] px-4 py-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#8F835F]">Micro Survey · 偶尔调研</div>
          <div className="mt-2 text-[13px] font-semibold text-[#F5E9C9]">
            这次丞相拟旨是否贴近你的真实意图？
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {['贴近', '太复杂', '我更想用原文'].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSurveyAnswer(item)}
                className={[
                  'rounded-md border px-3 py-1.5 text-[11px] transition',
                  surveyAnswer === item
                    ? 'border-[#F0C66A] bg-[#F0C66A]/10 text-[#F0C66A]'
                    : 'border-[#1A2142]/80 text-[#9AA3C4] hover:border-[#2C355E]',
                ].join(' ')}
              >
                {item}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSurveyVisible(false)}
              className="rounded-md border border-transparent px-3 py-1.5 text-[11px] text-[#6A7299] hover:text-[#C8CDD8]"
            >
              稍后再说
            </button>
          </div>
          {surveyAnswer && (
            <div className="mt-2 text-[11px] text-[#9AA3C4]">
              已记录本次反馈。后续会用它微调默认拟旨方式。
            </div>
          )}
        </div>
      )}

      {lastIssued && (
        <div className="mt-4 rounded-2xl border border-[#F0C66A]/15 bg-[#F0C66A]/[0.04] px-4 py-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#8F835F]">Imperial Receipt · 发令回执</div>
          <div className="mt-2 text-[14px] font-semibold text-[#F5E9C9]">{lastIssued.title}</div>
          <div className="mt-2 text-[11px] leading-6 text-[#C8CDD8]">
            密旨已入军机处，当前按 <span className="text-[#F0C66A]">{formatModeLabel(lastIssued.mode)}</span> 模式开始立案。
            下旨文本采用 <span className="text-[#F0C66A]">{lastIssued.commandChoice === 'optimized' ? '丞相拟旨' : '用户原文'}</span>，
            当前为 <span className="text-[#F0C66A]">{lastIssued.commandMode}</span>。下一步先看当前案件卡和中枢判断。
          </div>
          <div className="mt-2 text-[10px] text-[#6A7299]">
            {new Date(lastIssued.at).toLocaleTimeString('zh-CN')} · 已生成新的任务工作区
          </div>
        </div>
      )}
    </GlassPanel>
  );
}

function buildPrimeMinisterDraft(
  raw: string,
  emperorStyle: EmperorStyle,
  userHabit: UserHabit,
  professional: boolean,
) {
  const clean = raw.trim().replace(/\s+/g, ' ');
  const emperorLabel = emperorStyle === 'diligent' ? '勤政陛下' : '宽容陛下';
  const habitLabel = USER_HABITS.find((item) => item.value === userHabit)?.label ?? '小白';
  const styleRule =
    emperorStyle === 'diligent'
      ? '目标明确、证据优先、输出可验收'
      : '允许探索、保留备选、先学习再收敛';
  const habitRule = {
    beginner: '先用白话说明下一步，不堆术语',
    player: '展示功业、称号、部门升级和反馈爽点',
    expert: '展开证据、风险、边界、复用模板和验收标准',
    geek: '给出 payload、API、harness、ledger 和回归检查点',
  }[userHabit];
  const depthRule = professional
    ? '请进一步细化为专业版：拆解步骤、风险门禁、责任部门、验收指标、史馆归档字段。'
    : '请先给最小可执行闭环：下一步、证据、风险、交付物。';

  return {
    emperorLabel,
    habitLabel,
    optimized: clean
      ? `请按「${emperorLabel}」模式处理：${clean}。要求：${styleRule}；面向${habitLabel}用户，${habitRule}；${depthRule}`
      : '',
  };
}

function SegmentGroup<T extends string>({
  title,
  items,
  value,
  onChange,
}: {
  title: string;
  items: { value: T; label: string; sublabel: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[9px] uppercase tracking-wider text-[#6A7299]">{title}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const active = value === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              className={[
                'rounded-md border px-3 py-2 text-left text-[11px] transition-all',
                active
                  ? 'border-[#F0C66A] bg-[#F0C66A]/10 text-[#F0C66A]'
                  : 'border-[#1A2142]/80 text-[#9AA3C4] hover:border-[#2C355E]',
              ].join(' ')}
            >
              <span className="font-medium">{item.label}</span>
              <span className="ml-2 text-[9px] opacity-60">{item.sublabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChoiceButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-2 rounded-md border px-3 py-1.5 text-[11px] transition-all',
        active
          ? 'border-[#F0C66A] bg-[#F0C66A]/10 text-[#F0C66A]'
          : 'border-[#1A2142]/80 text-[#9AA3C4] hover:border-[#2C355E]',
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  );
}

function formatModeLabel(mode: ExecutionMode) {
  switch (mode) {
    case 'scripted':
      return 'Scripted';
    case 'hybrid':
      return 'Hybrid';
    case 'live':
      return 'Live';
    default:
      return mode;
  }
}
