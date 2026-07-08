'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardList,
  Gavel,
  Loader2,
  Network,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from 'lucide-react';
import { EdictStage } from '@/features/shangshufang/components/MemorialScroll';
import { GlassPanel, ImperialButton } from '@/features/shangshufang/components/atoms';
import { SHANGSHUFANG_ASSETS } from '@/features/shangshufang/constants';
import { EDICT_SCROLL_THEME, type EdictView } from '@/features/shangshufang/edict-content';
import { assetUrl } from '@/lib/asset';
import { withBasePath } from '@/lib/base-path';
import type {
  JunjichuCaseFile,
  JunjichuCaseWorkstream,
  JunjichuDepartmentCode,
} from '@/core/courtos/junjichu/case-orchestrator';

const DEPARTMENT_LABEL: Record<JunjichuDepartmentCode, string> = {
  prime_minister: '丞相',
  jin_yi_wei: '锦衣卫',
  hu_bu: '户部',
  bing_bu: '兵部',
  xing_bu: '刑部',
  gong_bu: '工部',
  qin_tian_jian: '钦天监',
  li_bu_rites: '礼部',
  scribe: '史官',
};

const STATUS_LABEL: Record<JunjichuCaseWorkstream['status'], string> = {
  queued: '待命',
  working: '协商中',
  waiting_evidence: '等证据',
  ready: '可汇总',
};

const SAMPLE_COMMANDS = [
  '我想知道今天发生了哪些 AI 有关的大事，并告诉我哪些值得重点关注',
  '我需要去看世界杯，帮我判断怎么买票、预算和风险',
  '这个客户要我们给正式报价，帮我判断值不值得做、怎么报价、有哪些风险',
];

interface CaseResponse {
  success?: boolean;
  data?: {
    case?: JunjichuCaseFile;
    taskId?: string;
    links?: {
      commandCenter?: string;
      briefing?: string;
    };
  };
  message?: string;
  error?: string;
}

function statusTone(status: JunjichuCaseWorkstream['status']) {
  if (status === 'working') return { color: '#F0C66A', bg: 'rgba(240,198,106,0.10)', border: 'rgba(240,198,106,0.36)' };
  if (status === 'ready') return { color: '#3DD68C', bg: 'rgba(61,214,140,0.10)', border: 'rgba(61,214,140,0.34)' };
  if (status === 'waiting_evidence') return { color: '#F58B8B', bg: 'rgba(245,139,139,0.10)', border: 'rgba(245,139,139,0.34)' };
  return { color: '#9AA3C4', bg: 'rgba(255,255,255,0.035)', border: 'rgba(255,255,255,0.10)' };
}

function defaultEdictView(command: string): EdictView {
  return {
    id: 'junjichu-case-empty',
    title: '军机处待立案',
    subtitle: '请先在下方写一句要办的事，丞相会拟出案卷。',
    headerKicker: 'JUNJICHU CASE',
    issuerLine: '军机处案卷',
    question: command.trim() || '等待圣意',
    seal: 'secret',
    meta: {
      accent: EDICT_SCROLL_THEME.junjichu.accent,
      accentSoft: EDICT_SCROLL_THEME.junjichu.accentSoft,
      reporter: '丞相',
      priority: 'medium',
      badges: [
        { label: '规划态', tone: 'amber' },
        { label: '未派发', tone: 'blue' },
      ],
    },
    rows: [
      { label: '圣裁', body: '尚未立案。输入问题后，先生成主责部门、协同部门、蜂群、证据门和回奏格式。' },
      { label: '分奏', body: '军机处会把一句话拆成多部门工位：谁主审、谁补证、谁控风险、谁写回奏。' },
      { label: '质门', body: '没有真实 taskId 前，不显示假完成；没有来源时，不冒充 LIVE。' },
      { label: '后令', body: '点击"丞相立案"，生成同一个 taskId，再进入军机处沙盘。' },
    ],
  };
}

function caseToEdictView(caseFile: JunjichuCaseFile): EdictView {
  const primary = DEPARTMENT_LABEL[caseFile.plan.primaryDepartment];
  const departments = caseFile.plan.departments.map((code) => DEPARTMENT_LABEL[code]).join('、');
  const working = caseFile.workstreams
    .filter((item) => item.status === 'working')
    .map((item) => `${DEPARTMENT_LABEL[item.department]}：${item.mission}`)
    .join('\n');
  const blockingGates = caseFile.qualityGates
    .filter((gate) => gate.blocking)
    .map((gate) => `${gate.label}：${gate.reason}`)
    .join('\n');

  return {
    id: caseFile.caseId,
    title: caseFile.title,
    subtitle: caseFile.plan.answerFormat,
    headerKicker: 'JUNJICHU CASE',
    issuerLine: '军机处案卷 · 丞相证据编排',
    question: caseFile.originalCommand,
    seal: 'secret',
    meta: {
      accent: EDICT_SCROLL_THEME.junjichu.accent,
      accentSoft: EDICT_SCROLL_THEME.junjichu.accentSoft,
      petitioner: '上书房',
      reporter: primary,
      priority: caseFile.plan.evidencePolicy === 'url_required' ? 'high' : 'medium',
      badges: [
        { label: caseFile.sourceLabel, tone: 'amber' },
        { label: `${caseFile.progressPct}%`, tone: 'blue' },
        { label: primary, tone: 'green' },
      ],
    },
    rows: [
      { label: '圣裁', body: `本案由${primary}主审。目标：${caseFile.objective}` },
      { label: '分奏', body: `参审部门：${departments}\n蜂群：${caseFile.plan.swarms.join('、')}` },
      { label: '证据', body: caseFile.returnPolicy.evidenceRule },
      { label: '协商', body: working || '丞相已定调，等待部门开始回写。' },
      { label: '风险', body: blockingGates || '暂无阻断质门。' },
      { label: '后令', body: caseFile.nextActions.join('\n') },
      { label: '来源', body: `taskId：${caseFile.taskId}\nsourceLabel：${caseFile.sourceLabel}\ncreatedAt：${caseFile.createdAt}` },
    ],
    sealDate: new Date(caseFile.createdAt).toLocaleString('zh-CN', { hour12: false }),
  };
}

function SideTitle({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2 px-3 pt-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#F0C66A]/22 bg-[#F0C66A]/[0.06] text-[#F0C66A]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-[#F5E9C9]" style={{ fontFamily: 'var(--font-serif)' }}>{title}</span>
        <span className="block truncate text-[10.5px] text-[#8F98B8]">{subtitle}</span>
      </span>
    </div>
  );
}

function DepartmentLine({ code, active }: { code: JunjichuDepartmentCode; active?: boolean }) {
  return (
    <div
      className="flex items-center justify-between rounded-lg border px-2.5 py-2"
      style={{
        borderColor: active ? 'rgba(240,198,106,0.38)' : 'rgba(255,255,255,0.09)',
        background: active ? 'rgba(240,198,106,0.08)' : 'rgba(255,255,255,0.025)',
      }}
    >
      <span className="text-[12px] font-semibold text-[#EAEEFB]" style={{ fontFamily: 'var(--font-serif)' }}>{DEPARTMENT_LABEL[code]}</span>
      <span className={active ? 'text-[10px] text-[#F0C66A]' : 'text-[10px] text-[#7C86A6]'}>
        {active ? '主责' : '协同'}
      </span>
    </div>
  );
}

function WorkstreamLine({ item, primary }: { item: JunjichuCaseWorkstream; primary: boolean }) {
  const tone = statusTone(item.status);
  return (
    <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: tone.border, background: tone.bg }}>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[12px] font-semibold text-[#F5E9C9]" style={{ fontFamily: 'var(--font-serif)' }}>
          {DEPARTMENT_LABEL[item.department]} · {item.agentName}
        </span>
        <span className="shrink-0 text-[10px]" style={{ color: tone.color }}>{primary ? '主责 · ' : ''}{STATUS_LABEL[item.status]}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/35">
        <div className="h-full rounded-full" style={{ width: `${item.progressPct}%`, background: tone.color }} />
      </div>
      <p className="mt-1.5 line-clamp-2 text-[10.5px] leading-5 text-[#9AA3C4]">{item.expectedOutput}</p>
    </div>
  );
}

/**
 * 军机处 · 案卷立案视图
 *
 * 嵌入 /command-center 中，替代旧 /junjichu/cases 独立路由。
 * 保留完整的立案表单、丞相编排结果展示。
 */
export function CasesView() {
  const [command, setCommand] = useState(SAMPLE_COMMANDS[0]);
  const [caseFile, setCaseFile] = useState<JunjichuCaseFile | null>(null);
  const [links, setLinks] = useState<{ commandCenter?: string; briefing?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const view = useMemo(() => (caseFile ? caseToEdictView(caseFile) : defaultEdictView(command)), [caseFile, command]);
  const commandCenterHref = links?.commandCenter ?? (caseFile ? `/command-center?taskId=${encodeURIComponent(caseFile.taskId)}` : '/command-center');

  async function submitCase() {
    const clean = command.trim();
    if (clean.length < 5) {
      setError('请把要办的事写得再具体一点。');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(withBasePath('/api/court/junjichu/cases'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ command: clean }),
      });
      const json = (await res.json()) as CaseResponse;
      if (!res.ok || !json.success || !json.data?.case) {
        throw new Error(json.message ?? json.error ?? '军机处立案失败');
      }
      setCaseFile(json.data.case);
      setLinks(json.data.links ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative h-full min-h-[760px] overflow-hidden bg-[#04060E]">
      <img
        src={assetUrl(SHANGSHUFANG_ASSETS.bgScene)}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-60"
        draggable={false}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(19,41,55,0.30),rgba(4,6,14,0.88)_62%,rgba(4,6,14,0.96))]" />

      <main className="relative z-10 mx-auto flex h-full max-w-[1680px] flex-col px-4 pb-4 pt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#F0C66A]">JUNJICHU · CASE ROOM</div>
            <h1 className="mt-1 text-[22px] font-semibold text-[#F5E9C9]" style={{ fontFamily: 'var(--font-serif)' }}>
              军机处案卷
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/court-briefing" className="rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1.5 text-[12px] text-[#D7DFF2] transition hover:border-[#F0C66A]/45 hover:text-[#F0C66A]">
              回上书房
            </Link>
            <Link href={commandCenterHref} className="inline-flex items-center gap-1.5 rounded-full border border-[#F0C66A]/45 bg-[#F0C66A]/[0.08] px-3.5 py-1.5 text-[12px] text-[#F0C66A] transition hover:bg-[#F0C66A]/15">
              进沙盘 <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[300px_minmax(520px,1fr)_330px]">
          <GlassPanel accent="#F0C66A" className="min-h-0">
            <SideTitle icon={<Gavel size={16} />} title="丞相拟案" subtitle="先判主责，再定协同" />
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
              <div className="rounded-lg border border-[#F0C66A]/14 bg-[#05070D]/35 p-3">
                <div className="text-[10px] font-semibold tracking-[0.16em] text-[#B6AB8C]">当前圣意</div>
                <p className="mt-2 text-[12px] leading-6 text-[#D7DFF2]">{command || '等待输入'}</p>
              </div>
              <div className="space-y-2">
                {(caseFile?.plan.departments ?? ['prime_minister', 'jin_yi_wei', 'qin_tian_jian', 'scribe']).map((dept) => (
                  <DepartmentLine
                    key={dept}
                    code={dept}
                    active={caseFile ? dept === caseFile.plan.primaryDepartment : dept === 'prime_minister'}
                  />
                ))}
              </div>
              {caseFile && (
                <div className="rounded-lg border border-[#3DD68C]/18 bg-[#3DD68C]/[0.045] p-3">
                  <div className="text-[11px] font-semibold text-[#B9F6D2]">丞相判断</div>
                  <p className="mt-2 text-[11.5px] leading-6 text-[#B8C0DA]">{caseFile.plan.userFacingReason}</p>
                </div>
              )}
            </div>
          </GlassPanel>

          <div className="junjichu-case-stage min-h-0">
            <EdictStage
              view={view}
              customBodyScroll="styled"
              footer={
                <div className="flex flex-col gap-2">
                  {error && <div className="text-[11px] text-[#8F2D25]">{error}</div>}
                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <textarea
                      value={command}
                      onChange={(event) => setCommand(event.target.value)}
                      className="min-h-[42px] flex-1 resize-none rounded-lg border border-[#7A4A08]/28 bg-[#fff8e0]/45 px-3 py-2 text-[13px] leading-6 text-[#2e2410] outline-none transition focus:border-[#2f6f7a]/65"
                      style={{ fontFamily: 'var(--font-serif)' }}
                      placeholder="写一句要办的事..."
                    />
                    <ImperialButton
                      variant="gold"
                      size="sm"
                      serif
                      loading={submitting}
                      icon={submitting ? <Loader2 size={13} /> : <ClipboardList size={13} />}
                      onClick={() => void submitCase()}
                    >
                      丞相立案
                    </ImperialButton>
                  </div>
                </div>
              }
            />
          </div>

          <GlassPanel accent="#7EC8E3" className="min-h-0">
            <SideTitle icon={<Waypoints size={16} />} title="协商进度" subtitle="部门工位与质门" />
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-[#F0C66A]/18 bg-[#F0C66A]/[0.05] p-2">
                  <div className="text-[16px] font-bold text-[#F0C66A]">{caseFile?.progressPct ?? 0}%</div>
                  <div className="mt-0.5 text-[9px] text-[#8F98B8]">案卷进度</div>
                </div>
                <div className="rounded-lg border border-[#7EC8E3]/18 bg-[#7EC8E3]/[0.05] p-2">
                  <div className="text-[16px] font-bold text-[#A7DDF0]">{caseFile?.workstreams.length ?? 0}</div>
                  <div className="mt-0.5 text-[9px] text-[#8F98B8]">智能体</div>
                </div>
                <div className="rounded-lg border border-[#F58B8B]/18 bg-[#F58B8B]/[0.05] p-2">
                  <div className="text-[16px] font-bold text-[#F58B8B]">{caseFile?.qualityGates.filter((gate) => gate.blocking).length ?? 0}</div>
                  <div className="mt-0.5 text-[9px] text-[#8F98B8]">阻断门</div>
                </div>
              </div>

              <section className="rounded-xl border border-[#7EC8E3]/16 bg-[#05070D]/35 p-2.5">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-medium tracking-[0.14em] text-[#B6AB8C]">
                  <Bot size={13} className="text-[#7EC8E3]" />
                  智能体工位
                  <span className="h-px flex-1 bg-gradient-to-r from-[#7EC8E3]/18 to-transparent" />
                </div>
                <div className="space-y-2">
                  {(caseFile?.workstreams ?? []).length > 0 ? (
                    caseFile!.workstreams.map((item) => (
                      <WorkstreamLine key={item.id} item={item} primary={item.department === caseFile!.plan.primaryDepartment} />
                    ))
                  ) : (
                    <div className="rounded-lg border border-white/8 bg-white/[0.025] px-3 py-5 text-center text-[11px] text-[#8F98B8]">
                      立案后显示每个智能体在做什么。
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-[#F0C66A]/16 bg-[#05070D]/35 p-2.5">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-medium tracking-[0.14em] text-[#B6AB8C]">
                  <ShieldCheck size={13} className="text-[#F0C66A]" />
                  质门
                  <span className="h-px flex-1 bg-gradient-to-r from-[#F0C66A]/18 to-transparent" />
                </div>
                <div className="space-y-2">
                  {(caseFile?.qualityGates ?? []).slice(0, 5).map((gate) => (
                    <div key={gate.id} className="rounded-lg border border-white/8 bg-white/[0.025] px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[11.5px] text-[#EAEEFB]">{gate.label}</span>
                        <span className={gate.blocking ? 'text-[10px] text-[#F58B8B]' : 'text-[10px] text-[#9AA3C4]'}>
                          {gate.blocking ? '阻断' : '检查'}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[10.5px] leading-5 text-[#8F98B8]">{gate.reason}</p>
                    </div>
                  ))}
                  {!caseFile && (
                    <div className="rounded-lg border border-white/8 bg-white/[0.025] px-3 py-4 text-[11px] leading-6 text-[#8F98B8]">
                      质门会根据内容自动设置：实时情报要 URL，报价要户部假设和刑部确认，法务要人工门。
                    </div>
                  )}
                </div>
              </section>
            </div>
          </GlassPanel>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {SAMPLE_COMMANDS.map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => setCommand(sample)}
              className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] text-[#AEB8D4] transition hover:border-[#F0C66A]/35 hover:text-[#F0C66A]"
            >
              <Sparkles size={12} className="mr-1 inline" />
              {sample.slice(0, 22)}...
            </button>
          ))}
          {caseFile && (
            <Link href={commandCenterHref} className="inline-flex items-center gap-1.5 rounded-full border border-[#3DD68C]/30 bg-[#3DD68C]/[0.06] px-3 py-1.5 text-[11px] text-[#B9F6D2]">
              <Network size={12} />
              taskId {caseFile.taskId}
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
