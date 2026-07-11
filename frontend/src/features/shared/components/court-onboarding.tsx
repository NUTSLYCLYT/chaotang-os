/**
 * 朝堂 OS · 60 秒首次引导
 *
 * 触发：首次用户 · 登朝大片结束之后 4.5s 展开（让用户先看到首屏）
 *   - localStorage `courtos.onboarded` 为空 → 触发
 *   - 陛下完成 onboarding → 写入 `courtos.onboarded` = "1"
 *
 * 3 步：
 *   Step 1 · 选择陛下风格（严 / 仁 / 勤）→ 写 localStorage `courtos.ruler.style`
 *   Step 2 · 亲下第一道旨（预填 prompt · 可改）→ 发令触发「行」印 · 跳军机处
 *   Step 3 · 朝堂动线提示（⌘K · 钦天监 · 晨朝简报）→ 点"进入朝堂"关闭
 *
 * 不用登朝大片的同一 localStorage key，两者解耦：
 *   - 登朝大片每天触发一次
 *   - onboarding 永久只触发一次
 */

'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronRight,
  Crown,
  Shield,
  Flame,
  ScrollText,
  Sparkles,
  Keyboard,
  Bell,
  Sunrise,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { shouldBlockCourtOnboarding } from '@/features/shared/lib/court-onboarding-paths';

const ONBOARDED_KEY = 'courtos.onboarded';
const RULER_STYLE_KEY = 'courtos.ruler.style';

export type RulerStyle = 'strict' | 'benevolent' | 'diligent';

interface StyleOption {
  id: RulerStyle;
  icon: LucideIcon;
  label: string;
  sub: string;
  accent: string;
  bullets: string[];
  tone: string;
}

const STYLES: StyleOption[] = [
  {
    id: 'strict',
    icon: Shield,
    label: '严政陛下',
    sub: 'Strict Sovereign',
    accent: '#F43F5E',
    bullets: ['丞相说话直切要害', '风险必驳 · 不求人情', '急事必先 · 慢事必砍'],
    tone: '臣丞相为您备"直言进谏"模式。',
  },
  {
    id: 'benevolent',
    icon: Crown,
    label: '仁政陛下',
    sub: 'Benevolent Sovereign',
    accent: '#F0C66A',
    bullets: ['丞相说话温和缜密', '利害权衡 · 照顾全局', '慢事留周旋 · 急事速裁'],
    tone: '臣丞相为您备"圆融议政"模式。',
  },
  {
    id: 'diligent',
    icon: Flame,
    label: '勤政陛下',
    sub: 'Diligent Sovereign',
    accent: '#3DD68C',
    bullets: ['丞相每日主动呈报', '多线并发 · 不等陛下', '执行回写 · 全链透明'],
    tone: '臣丞相为您备"日日勤问"模式。',
  },
];

const DEFAULT_DECREE =
  '制定 2027 年旗舰产品发布战略 · 财务预算 · 竞品扫描 · 营销节奏 · 全球合规 · 上市时机';

const QA_SKIP_PARAM = 'skipOnboarding';

export function CourtOnboarding() {
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [style, setStyle] = useState<RulerStyle | null>(null);
  const [decree, setDecree] = useState(DEFAULT_DECREE);
  const blockedOnThisRoute = shouldBlockCourtOnboarding(pathname);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (blockedOnThisRoute) {
      setVisible(false);
      return;
    }
    try {
      const skipForQa =
        new URLSearchParams(window.location.search).get(QA_SKIP_PARAM) === '1';
      if (skipForQa) {
        // Allow browser QA / Playwright flows to opt out explicitly.
        window.localStorage.setItem(ONBOARDED_KEY, '1');
        setVisible(false);
        return;
      }
      const already = window.localStorage.getItem(ONBOARDED_KEY);
      if (already) return;
      // 登朝大片约 3.5s · 晨朝简报约 3.8s · onboarding 在 5s 后进场 · 让陛下先看到首屏
      const t = setTimeout(() => setVisible(true), 5000);
      return () => clearTimeout(t);
    } catch {
      /* ignore */
    }
  }, [blockedOnThisRoute]);

  if (blockedOnThisRoute) return null;

  const finish = () => {
    try {
      window.localStorage.setItem(ONBOARDED_KEY, '1');
      if (style) window.localStorage.setItem(RULER_STYLE_KEY, style);
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  const issueDecree = () => {
    if (!decree.trim()) return;
    // 发「行」印
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('court:seal-stamp', {
          detail: { verdict: '行', note: '首道旨已下' },
        }),
      );
    }
    finish();
    window.setTimeout(() => {
      router.push('/command-center');
    }, 820);
  };

  // 独立复审(2026-07-11)发现的真实点击穿透 bug:底部御前对话栏(footer)及其容器
  // 实测 z-index 是 210/215,比这个弹窗原来的 z-[180] 更高,弹窗按钮会被footer的
  // 附件上传图标挡住点击——纯粹是数值比较问题,不是层叠上下文转义问题。改成
  // z-[241],压过全仓库目前已知最高的普通 UI z-index(240,global-edict-quick-dock),
  // 仍留在 toast(z-[9999])之下。同时改用 portal 直接挂到 document.body,避免
  // 弹窗以后又被嵌套到某个开新层叠上下文的祖先节点里,重蹈同类覆辙。
  // createPortal 的第二个参数在服务端渲染时会立即求值,document 在服务端不存在,
  // 所以这里必须显式判断,不能只靠 visible(那个只影响子节点渲染与否)。
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[241] flex items-center justify-center overflow-hidden px-3 py-3 backdrop-blur-md sm:px-4 sm:py-4"
          style={{
            background:
              'radial-gradient(ellipse at 50% 50%, rgba(240,198,106,0.08), rgba(0,0,0,0.82))',
          }}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl border-2 sm:max-h-[calc(100dvh-32px)]"
            style={{
              borderColor: 'rgba(240,198,106,0.4)',
              background:
                'linear-gradient(160deg, rgba(22,18,10,0.98) 0%, rgba(10,7,4,0.99) 60%, rgba(14,10,6,0.98) 100%)',
              boxShadow:
                '0 32px 84px rgba(0,0,0,0.7), 0 0 0 1px rgba(240,198,106,0.2)',
            }}
          >
            {/* 顶金线 */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
              style={{
                background:
                  'linear-gradient(90deg, transparent, #F0C66A 50%, transparent)',
                boxShadow: '0 1px 10px rgba(240,198,106,0.6)',
              }}
            />

            {/* 放射金光 */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 opacity-45"
              style={{
                background:
                  'radial-gradient(circle, rgba(240,198,106,0.22) 0%, transparent 60%)',
                filter: 'blur(6px)',
              }}
            />

            {/* 步骤指示条 */}
            <div className="relative z-[1] flex shrink-0 flex-col items-start justify-between gap-3 border-b border-[#F0C66A]/15 px-4 py-3 sm:flex-row sm:items-center sm:px-7 sm:py-4">
              <div className="flex items-center gap-2">
                <Sunrise size={14} className="text-[#F0C66A]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F0C66A] sm:text-[11px] sm:tracking-[0.3em]">
                  陛下御极 · 开朝仪轨
                </span>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-[3px] rounded-full transition-all"
                    style={{
                      width: n === step ? 24 : 12,
                      background:
                        n < step
                          ? '#3DD68C'
                          : n === step
                            ? '#F0C66A'
                            : 'rgba(255,255,255,0.12)',
                      boxShadow: n === step ? '0 0 8px #F0C66A' : undefined,
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="relative z-[1] min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {/* ====== Step 1 ====== */}
            {step === 1 && (
              <motion.div
                key="s1"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                className="px-4 py-5 sm:px-7 sm:py-6 md:px-10 md:py-8"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#F0C66A]">
                  Step 1 · 朝政之风
                </div>
                <h2
                  className="mt-3 text-[24px] font-black leading-[1.15] tracking-[0.06em] sm:text-[28px] sm:tracking-[0.1em] md:text-[32px]"
                  style={{
                    color: '#F5E9C9',
                    fontFamily: '"Noto Serif SC", serif',
                    textShadow: '0 0 24px rgba(240,198,106,0.25)',
                  }}
                >
                  陛下欲以何种风范临朝？
                </h2>
                <p className="mt-2 text-[13.5px] leading-[1.85] text-[#B8C0DA]">
                  风格不同，丞相与百官奏对的语气、决策路径、审议严度皆异。日后可随时再改。
                </p>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  {STYLES.map((s) => {
                    const Icon = s.icon;
                    const active = style === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setStyle(s.id)}
                        className="group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all hover:-translate-y-0.5"
                        style={{
                          borderColor: active ? s.accent : 'rgba(255,255,255,0.08)',
                          background: active
                            ? `linear-gradient(160deg, ${s.accent}18, rgba(10,7,4,0.7))`
                            : 'rgba(255,255,255,0.02)',
                          boxShadow: active
                            ? `0 8px 28px ${s.accent}33`
                            : undefined,
                        }}
                      >
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg border"
                          style={{
                            background: `${s.accent}22`,
                            borderColor: `${s.accent}66`,
                            color: s.accent,
                          }}
                        >
                          <Icon size={18} />
                        </div>
                        <div
                          className="mt-3 text-[18px] font-black tracking-[0.1em]"
                          style={{
                            color: '#F5E9C9',
                            fontFamily: '"Noto Serif SC", serif',
                          }}
                        >
                          {s.label}
                        </div>
                        <div
                          className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.22em]"
                          style={{ color: `${s.accent}cc` }}
                        >
                          {s.sub}
                        </div>
                        <ul className="mt-3 space-y-1 text-[12px] leading-6 text-[#C8CDD8]">
                          {s.bullets.map((b) => (
                            <li key={b} className="flex items-start gap-1.5">
                              <span
                                className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full"
                                style={{ background: s.accent }}
                              />
                              {b}
                            </li>
                          ))}
                        </ul>
                        <div
                          className="mt-3 text-[11px] italic"
                          style={{ color: `${s.accent}aa` }}
                        >
                          {s.tone}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex flex-col-reverse items-stretch gap-3 sm:mt-8 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={finish}
                    className="rounded-full border border-white/10 px-4 py-2.5 text-center text-[11px] tracking-[0.18em] text-[#8A92AC] transition hover:text-[#F5E9C9] sm:border-0 sm:px-0 sm:text-left"
                  >
                    跳过 · 直接进朝堂
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!style}
                    className="flex items-center gap-2 rounded-full bg-gradient-to-br from-[#F0C66A] to-[#D4A84B] px-6 py-2.5 text-[12.5px] font-bold tracking-[0.08em] text-[#04060E] shadow-[0_0_20px_rgba(240,198,106,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    下一步 · 亲下第一道旨
                    <ArrowRight size={13} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ====== Step 2 ====== */}
            {step === 2 && (
              <motion.div
                key="s2"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                className="px-4 py-5 sm:px-7 sm:py-6 md:px-10 md:py-8"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#F0C66A]">
                  Step 2 · 第一道旨
                </div>
                <h2
                  className="mt-3 text-[24px] font-black leading-[1.15] tracking-[0.06em] sm:text-[28px] sm:tracking-[0.1em] md:text-[32px]"
                  style={{
                    color: '#F5E9C9',
                    fontFamily: '"Noto Serif SC", serif',
                    textShadow: '0 0 24px rgba(240,198,106,0.25)',
                  }}
                >
                  请陛下亲下开朝第一道旨
                </h2>
                <p className="mt-2 text-[13.5px] leading-[1.85] text-[#B8C0DA]">
                  以下是示范旨意 · 陛下可改、可增、可留白。点「发令」后，丞相即拆任务、分派群臣，您将直通军机处。
                </p>

                <div
                  className="mt-5 rounded-xl border-2"
                  style={{
                    borderColor: 'rgba(240,198,106,0.4)',
                    background: 'rgba(10,7,4,0.85)',
                  }}
                >
                  <textarea
                    value={decree}
                    onChange={(e) => setDecree(e.target.value)}
                    rows={4}
                    className="w-full resize-none bg-transparent px-5 py-4 text-[15px] leading-[1.85] outline-none placeholder:text-[#6A7299]"
                    style={{
                      color: '#F5E9C9',
                      fontFamily: '"Noto Serif SC", serif',
                    }}
                  />
                  <div className="flex flex-col gap-1.5 border-t border-[#F0C66A]/15 px-4 py-2.5 text-[11px] text-[#8A92AC] sm:flex-row sm:items-center sm:justify-between">
                    <span>字数 {decree.length} · 一句话也可，细节交给丞相</span>
                    <span className="flex items-center gap-1.5">
                      <Sparkles size={11} className="text-[#F0C66A]" />
                      丞相将自动拆 3-7 个子任务
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex flex-col-reverse items-stretch gap-3 sm:mt-8 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-full border border-white/10 px-4 py-2.5 text-center text-[12px] tracking-[0.1em] text-[#8A92AC] transition hover:text-[#F5E9C9] sm:border-0 sm:px-0 sm:text-left"
                  >
                    ← 返回上一步
                  </button>
                  <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="rounded-full border border-white/15 px-5 py-2.5 text-[12px] font-medium text-[#C8CDD8] transition hover:bg-white/5"
                    >
                      先不下旨 · 看动线
                    </button>
                    <button
                      type="button"
                      onClick={issueDecree}
                      disabled={!decree.trim()}
                      className="flex items-center gap-2 rounded-full bg-gradient-to-br from-[#F0C66A] to-[#D4A84B] px-6 py-2.5 text-[12.5px] font-bold tracking-[0.08em] text-[#04060E] shadow-[0_0_20px_rgba(240,198,106,0.4)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ScrollText size={13} />
                      发令 · 落「行」印
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ====== Step 3 ====== */}
            {step === 3 && (
              <motion.div
                key="s3"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                className="px-4 py-5 sm:px-7 sm:py-6 md:px-10 md:py-8"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#F0C66A]">
                  Step 3 · 朝堂动线
                </div>
                <h2
                  className="mt-3 text-[24px] font-black leading-[1.15] tracking-[0.06em] sm:text-[28px] sm:tracking-[0.1em] md:text-[32px]"
                  style={{
                    color: '#F5E9C9',
                    fontFamily: '"Noto Serif SC", serif',
                    textShadow: '0 0 24px rgba(240,198,106,0.25)',
                  }}
                >
                  朝堂在此 · 永远为您
                </h2>
                <p className="mt-2 text-[13.5px] leading-[1.85] text-[#B8C0DA]">
                  三件事记牢即可。余下 8 殿 11 臣，您随召随到。
                </p>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  <HintCard
                    icon={Keyboard}
                    accent="#F0C66A"
                    title="⌘ K · 任意召见"
                    body="任一页按 ⌘K（Mac）/ Ctrl+K（Win）· 一句话召见 11 位大臣中的任一位"
                  />
                  <HintCard
                    icon={Bell}
                    accent="#3DD68C"
                    title="钦天监 · 候星中"
                    body="右下角永久在侧。有急章自动铃响。点开看当前三件要紧事 + 一键传召"
                  />
                  <HintCard
                    icon={Sunrise}
                    accent="#D4A84B"
                    title="晨朝简报 · 每日一次"
                    body="每天第一次登朝 · 自动呈上昨日实绩 + 今日待办 + 连朝天数徽章"
                  />
                </div>

                <div
                  className="mt-6 rounded-xl border-2 bg-gradient-to-br from-[#F0C66A]/8 to-transparent px-5 py-4"
                  style={{ borderColor: 'rgba(240,198,106,0.3)' }}
                >
                  <div
                    className="text-[12px] font-semibold uppercase tracking-[0.22em]"
                    style={{ color: '#F0C66A' }}
                  >
                    陛下御笔 · 批示仪式
                  </div>
                  <div className="mt-1 text-[13px] leading-[1.8] text-[#E6DBBC]">
                    每次您在军机处点「准」「驳」「再议」· <b>金玺即从右上飞入</b> · 盖下后朱印扩散 · 批示 0.8s 入史。一次批准 → 紧接金花撒落 · 卷轴入库庆典。
                  </div>
                </div>

                <div className="mt-6 flex flex-col-reverse items-stretch gap-3 sm:mt-8 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="rounded-full border border-white/10 px-4 py-2.5 text-center text-[12px] tracking-[0.1em] text-[#8A92AC] transition hover:text-[#F5E9C9] sm:border-0 sm:px-0 sm:text-left"
                  >
                    ← 返回改旨
                  </button>
                  <button
                    type="button"
                    onClick={finish}
                    className="flex items-center gap-2 rounded-full bg-gradient-to-br from-[#F0C66A] to-[#D4A84B] px-7 py-2.5 text-[13px] font-bold tracking-[0.1em] text-[#04060E] shadow-[0_0_24px_rgba(240,198,106,0.45)] transition hover:brightness-110"
                  >
                    <Crown size={14} />
                    进入朝堂
                    <ChevronRight size={14} />
                  </button>
                </div>
              </motion.div>
            )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function HintCard({
  icon: Icon,
  accent,
  title,
  body,
}: {
  icon: LucideIcon;
  accent: string;
  title: string;
  body: string;
}) {
  return (
    <div
      className="rounded-xl border-2 p-4"
      style={{
        borderColor: `${accent}44`,
        background: `linear-gradient(160deg, ${accent}10, rgba(10,7,4,0.8))`,
      }}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg border"
        style={{
          background: `${accent}20`,
          borderColor: `${accent}55`,
          color: accent,
        }}
      >
        <Icon size={16} />
      </div>
      <div
        className="mt-3 text-[14px] font-bold tracking-[0.06em]"
        style={{
          color: '#F5E9C9',
          fontFamily: '"Noto Serif SC", serif',
        }}
      >
        {title}
      </div>
      <div className="mt-2 text-[12px] leading-6 text-[#C8CDD8]">{body}</div>
    </div>
  );
}
