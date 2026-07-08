/**
 * 朝堂 OS · 大殿 · 丞相 chat 中央主角
 *
 * 放在 overview 主页 Row 1 顶部 · 占满全宽。
 * 诸葛亮真人头像（圆形 96px）+ 大号输入框 + 3 个轮播 prompt 建议。
 *
 * 用户输入 → 分派到军机处（带着任务）+ 玺印落印「令」。
 * 这是"AI 从底 dock 到屏幕中央"的核心落地。
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Send, Sparkles, X } from 'lucide-react';
import { useAppStore } from '@/lib/store/app-store';
import { assetUrl } from '@/lib/asset';

type RulerStyle = 'strict' | 'benevolent' | 'diligent';

const STYLE_ACCENT: Record<RulerStyle, string> = {
  strict: '#F43F5E',
  benevolent: '#F0C66A',
  diligent: '#3DD68C',
};

const STYLE_GREETING: Record<RulerStyle, string> = {
  strict: '陛下严政在上 · 臣不敢虚礼 · 直言相告',
  benevolent: '陛下仁政临朝 · 臣已备圆融之策',
  diligent: '陛下勤政垂范 · 臣日夜奔忙 · 随时呈报',
};

const ROTATING_PROMPTS = [
  '制定 2027 新品发布战略 · 需财务 · 营销 · 竞品扫描 · 监管情报',
  '分析本周户部现金流异常 · 给 3 条对策',
  '调研 AI 办公市场头部 5 家 · 给 1 页战略备忘',
  '整理昨日议事记录 · 生成陛下晨朝简报',
  '检索礼部近三年同类定稿 · 召回最值得复用的 3 份',
  '未来 90 天北方市场风险 · 钦天监推演 3 情景',
];

export function PrimeMinisterCenter() {
  const router = useRouter();
  const [raw, setRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [promptIdx, setPromptIdx] = useState(0);
  const [reply, setReply] = useState<string>('');
  const [replyDone, setReplyDone] = useState(false);
  const [style, setStyle] = useState<RulerStyle | null>(null);
  const [issuedMessage, setIssuedMessage] = useState<string>('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const addTask = useAppStore((s) => s.addTask);
  const selectTask = useAppStore((s) => s.selectTask);

  const accent = style ? STYLE_ACCENT[style] : '#3DD68C';

  // 读陛下风格
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const s = window.localStorage.getItem(
        'courtos.ruler.style',
      ) as RulerStyle | null;
      if (s) setStyle(s);
    } catch {
      /* ignore */
    }
  }, []);

  // 轮播 prompt
  useEffect(() => {
    const t = setInterval(() => {
      setPromptIdx((i) => (i + 1) % ROTATING_PROMPTS.length);
    }, 4500);
    return () => clearInterval(t);
  }, []);

  // 自适应高度
  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = 'auto';
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 140)}px`;
  }, [raw]);

  const clearReply = () => {
    setReply('');
    setReplyDone(false);
    setIssuedMessage('');
  };

  const submit = async () => {
    if (!raw.trim() || submitting) return;
    const msg = raw.trim();
    setSubmitting(true);
    setReply('');
    setReplyDone(false);
    setIssuedMessage(msg);

    // 发"令"印
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('court:seal-stamp', {
          detail: { verdict: '行', note: '新令已发' },
        }),
      );
    }

    // 创建任务放 store
    const now = new Date();
    const task = {
      id: `task_${now.getTime()}`,
      title: msg.slice(0, 30),
      description: msg,
      rawCommand: msg,
      status: 'planning' as const,
      mode: 'normal' as const,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    try {
      addTask(task as unknown as Parameters<typeof addTask>[0]);
      selectTask(task.id);
    } catch {
      /* ignore */
    }
    setRaw('');

    // 流式拉取丞相回复
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: msg, style }),
      });
      if (!res.ok || !res.body) throw new Error('upstream');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          try {
            const obj = JSON.parse(payload);
            if (obj.token) setReply((r) => r + obj.token);
            if (obj.done) setReplyDone(true);
          } catch {
            /* ignore */
          }
        }
      }
      setReplyDone(true);
    } catch {
      setReply(
        '臣一时无对 · 请陛下再次下旨。\n（丞相内阁连接不畅，已改走备用应对机制。）',
      );
      setReplyDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-2xl border-2"
      style={{
        borderColor: 'rgba(240,198,106,0.32)',
        background:
          'linear-gradient(135deg, rgba(18,14,6,0.96) 0%, rgba(10,7,4,0.98) 70%, rgba(14,10,18,0.95) 100%)',
        boxShadow:
          '0 18px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(240,198,106,0.12), inset 0 1px 0 rgba(240,198,106,0.22)',
      }}
    >
      {/* 柔光背景 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-1/4 top-0 h-[520px] w-[520px] rounded-full opacity-35"
        style={{
          background:
            'radial-gradient(circle, rgba(61,214,140,0.22) 0%, transparent 60%)',
          filter: 'blur(8px)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-1/4 bottom-0 h-[440px] w-[440px] rounded-full opacity-30"
        style={{
          background:
            'radial-gradient(circle, rgba(240,198,106,0.28) 0%, transparent 60%)',
          filter: 'blur(10px)',
        }}
      />

      {/* 顶金线 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
        style={{
          background:
            'linear-gradient(90deg, transparent, #F0C66A 50%, transparent)',
          boxShadow: '0 1px 8px rgba(240,198,106,0.6)',
        }}
      />

      <div className="relative z-[1] grid gap-5 px-6 py-6 md:grid-cols-[auto_1fr] md:px-8 md:py-7">
        {/* 左 · 丞相头像 + 名号 */}
        <div className="flex flex-col items-center gap-3 md:items-start">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="relative h-[96px] w-[96px] shrink-0 overflow-hidden rounded-full border-2"
            style={{
              borderColor: 'rgba(61,214,140,0.55)',
              boxShadow:
                '0 0 0 4px rgba(61,214,140,0.12), 0 12px 36px rgba(0,0,0,0.6)',
            }}
          >
            <img
              src={assetUrl('/heroes/1-zhuge.webp')}
              alt="诸葛亮 · 丞相"
              className="h-full w-full object-cover"
              style={{ objectPosition: '50% 18%' }}
            />
            {/* 在线脉冲 */}
            <div
              aria-hidden
              className="absolute bottom-1 right-1 h-3 w-3 rounded-full border-2 border-[#0a0704]"
              style={{
                background: '#3DD68C',
                boxShadow: '0 0 10px #3DD68C',
                animation: 'pulse 1.8s ease-in-out infinite',
              }}
            />
          </motion.div>
          <div className="text-center md:text-left">
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.3em]"
              style={{ color: accent }}
            >
              Prime Minister · 在侧候旨
            </div>
            <div
              className="mt-1 text-[22px] font-black tracking-[0.12em]"
              style={{
                color: '#F5E9C9',
                fontFamily: '"Noto Serif SC", serif',
                textShadow: '0 2px 10px rgba(0,0,0,0.7)',
              }}
            >
              丞相诸葛亮
            </div>
            <div
              className="mt-0.5 text-[11px] tracking-[0.18em]"
              style={{ color: style ? `${accent}cc` : '#8A92AC' }}
            >
              {style ? STYLE_GREETING[style] : '181-234 · 三国 · 谋略 · 长链推理'}
            </div>
          </div>
        </div>

        {/* 右 · 对话输入 */}
        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <Sparkles size={14} className="text-[#F0C66A]" />
            <div
              className="text-[12px] font-semibold uppercase tracking-[0.26em]"
              style={{ color: '#F0C66A' }}
            >
              陛下请吩咐 · 一句话即分派
            </div>
          </div>

          <div
            className="relative rounded-xl border-2"
            style={{
              borderColor: 'rgba(240,198,106,0.35)',
              background:
                'linear-gradient(180deg, rgba(10,7,4,0.92) 0%, rgba(6,4,2,0.95) 100%)',
            }}
          >
            <textarea
              ref={inputRef}
              rows={2}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              disabled={submitting}
              placeholder={`例：${ROTATING_PROMPTS[promptIdx]}`}
              className="w-full resize-none bg-transparent px-5 py-4 text-[15px] leading-relaxed outline-none placeholder:text-[#6A7299] disabled:opacity-60"
              style={{
                color: '#F5E9C9',
                fontFamily: '"Noto Serif SC", serif',
              }}
            />

            <div className="flex items-center justify-between border-t border-[#F0C66A]/12 px-4 py-2.5">
              <div className="flex items-center gap-3 text-[11px] text-[#8A92AC]">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-white/15 bg-white/[0.05] px-1.5 py-0.5 font-mono text-[11px]">
                    ⌘
                  </kbd>
                  <kbd className="rounded border border-white/15 bg-white/[0.05] px-1.5 py-0.5 font-mono text-[11px]">
                    ⏎
                  </kbd>
                  速令
                </span>
                <span className="text-[11px] text-[#6A7299]">·</span>
                <span className="text-[11px]">
                  发令后自动进入军机处 · 丞相拆任务 · 群臣并发
                </span>
              </div>
              <button
                type="button"
                onClick={submit}
                disabled={!raw.trim() || submitting}
                className="flex items-center gap-2 rounded-full bg-gradient-to-br from-[#F0C66A] to-[#D4A84B] px-5 py-2 text-[12.5px] font-bold tracking-[0.08em] text-[#04060E] shadow-[0_0_20px_rgba(240,198,106,0.4)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {submitting ? (
                  <>
                    <Sparkles size={13} className="animate-spin" />
                    丞相已接
                  </>
                ) : (
                  <>
                    <Send size={13} />
                    发令
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 快速 prompt chip · 未出结果时显示 */}
          {!issuedMessage && (
            <div className="flex flex-wrap gap-2">
              {[
                '今日最紧一件事？',
                '户部本周现金流如何？',
                '明日晨朝准备',
                '召锦衣卫汇报',
              ].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setRaw(p);
                    setTimeout(() => inputRef.current?.focus(), 30);
                  }}
                  className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-[11.5px] text-[#C8CDD8] transition hover:border-[#F0C66A]/40 hover:bg-[#F0C66A]/10 hover:text-[#F0C66A]"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* 流式回复面板 · 有结果时显示 */}
          <AnimatePresence>
            {issuedMessage && (
              <motion.div
                initial={{ opacity: 0, y: 8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                transition={{ duration: 0.28 }}
                className="overflow-hidden rounded-xl border-2"
                style={{
                  borderColor: `${accent}55`,
                  background:
                    'linear-gradient(180deg, rgba(10,7,14,0.92) 0%, rgba(6,4,8,0.95) 100%)',
                }}
              >
                <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
                  <div className="flex items-center gap-2 text-[12px]">
                    <span
                      className="flex h-2 w-2 rounded-full"
                      style={{
                        background: replyDone ? '#3DD68C' : accent,
                        boxShadow: `0 0 8px ${replyDone ? '#3DD68C' : accent}`,
                        animation: replyDone ? undefined : 'pulse 1s ease-in-out infinite',
                      }}
                    />
                    <span
                      className="font-semibold tracking-[0.14em]"
                      style={{
                        color: '#F5E9C9',
                        fontFamily: '"Noto Serif SC", serif',
                      }}
                    >
                      {replyDone ? '丞相已呈报' : '丞相正在呈报 ...'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={clearReply}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-[#8A92AC] transition hover:bg-white/10 hover:text-[#F5E9C9]"
                    aria-label="收起呈报"
                  >
                    <X size={11} />
                  </button>
                </div>
                <div className="px-5 py-4">
                  <div
                    className="mb-2 text-[11px] uppercase tracking-[0.22em]"
                    style={{ color: `${accent}cc` }}
                  >
                    陛下之旨 ·「{issuedMessage.slice(0, 40)}{issuedMessage.length > 40 ? '…' : ''}」
                  </div>
                  <pre
                    className="whitespace-pre-wrap text-[13.5px] leading-[1.95] tracking-[0.01em]"
                    style={{
                      color: '#E6DBBC',
                      fontFamily: '"Noto Serif SC", serif',
                    }}
                  >
                    {reply || '（臣正提笔 ...）'}
                    {!replyDone && reply && (
                      <span
                        className="ml-1 inline-block h-[1em] w-[6px] translate-y-[2px]"
                        style={{
                          background: accent,
                          animation: 'blink 0.9s step-end infinite',
                        }}
                      />
                    )}
                  </pre>
                </div>
                {replyDone && (
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/8 px-4 py-2.5">
                    <button
                      type="button"
                      onClick={clearReply}
                      className="rounded-full border border-white/12 bg-white/[0.03] px-4 py-1.5 text-[12px] text-[#C8CDD8] transition hover:bg-white/[0.06]"
                    >
                      再下一道旨
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push('/command-center')}
                      className="flex items-center gap-1.5 rounded-full border border-[#F0C66A]/40 bg-[#F0C66A]/10 px-4 py-1.5 text-[12px] font-semibold text-[#F0C66A] transition hover:bg-[#F0C66A]/18"
                    >
                      <Sparkles size={11} />
                      进军机处看拆解
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 底金线 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[1px]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(240,198,106,0.5) 50%, transparent)',
        }}
      />
    </motion.div>
  );
}
