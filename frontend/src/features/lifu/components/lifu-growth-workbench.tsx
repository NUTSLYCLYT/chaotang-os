'use client';

/**
 * 礼部 · 中栏 hero 工作台（关系台账 + 流量增长 · 2026-06-29）
 *
 * 两个 tab：
 *   - 关系台账：填干系人 → prioritizeStakeholders → RFM+Salience+Mendelow 优先序
 *   - 流量增长：填渠道 → rankChannels → ROI 排序 + 预算搬家建议
 *
 * 纯客户端（数据不出浏览器，铁律9 咨询面）。
 * 诚实：humanJudged 标注人工裁量字段；薄数据如实标不足。
 * sourceLabel 全程显示 LOCAL，不冒充 LIVE。
 */
import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Scale,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';

import { CrisisTab } from './lifu-crisis-tab';
import { NegotiationTab } from './lifu-negotiation-tab';

import {
  prioritizeStakeholders,
  type StakeholderRecord,
  type StakeholderPriority,
} from '@/features/lifu/lib/lifu-stakeholder-priority';
import {
  rankChannels,
  type ChannelMetrics,
  type ChannelROI,
  type GrowthDecision,
} from '@/features/lifu/lib/lifu-growth';
import { ACCENT } from '@/features/lifu/lib/lifu-roster';

// ── helpers ──────────────────────────────────────────────────────────────────

type Tab = 'relationship' | 'growth' | 'crisis' | 'negotiation';

const SALIENCE_LABEL: Record<string, string> = {
  definitive: 'Definitive 决策者',
  dominant: 'Dominant 主导者',
  dangerous: 'Dangerous 高危关系',
  dependent: 'Dependent 有利者',
  dormant: 'Dormant 潜在',
  discretionary: 'Discretionary 酌情',
  demanding: 'Demanding 催促型',
  non: 'Non 无影响',
};

const MENDELOW_LABEL: Record<string, string> = {
  manage_closely: '紧密管理',
  keep_satisfied: '保持满意',
  keep_informed: '定期沟通',
  monitor: '观察',
};

const VERDICT_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  scale: { label: '加投', color: '#3DD68C', bg: '#3DD68C0d', border: '#3DD68C30' },
  keep: { label: '维持观察', color: '#E5B84D', bg: '#E5B84D0e', border: '#E5B84D34' },
  cut: { label: '砍预算', color: '#E5604D', bg: '#E5604D12', border: '#E5604D3a' },
  insufficient: { label: '数据不足', color: '#6a7080', bg: '#6a70800d', border: '#6a708030' },
};

// ── 关系台账 tab ──────────────────────────────────────────────────────────────

const EMPTY_STAKEHOLDER: Omit<StakeholderRecord, 'id'> = {
  name: '',
  recencyDays: 30,
  frequency: 1,
  monetary: 0,
  power: false,
  legitimacy: false,
  urgency: false,
  interest: false,
};

function newRow(idx: number): StakeholderRecord {
  return { ...EMPTY_STAKEHOLDER, id: `s-${Date.now()}-${idx}`, name: '' };
}

function StakeholderRow({
  row,
  onChange,
  onRemove,
  canRemove,
}: {
  row: StakeholderRecord;
  onChange: (r: StakeholderRecord) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const inputCls =
    'w-full rounded-[8px] border bg-transparent px-2.5 py-1.5 text-[11.5px] text-[#E9DDBE] placeholder:text-[#3a3e4c] focus:outline-none focus-visible:ring-1';
  const ring = 'focus-visible:ring-[#C070D0]'; // 静态字面量(=ACCENT),Tailwind JIT 才扫得到,动态拼接会被 purge
  const bdr = { borderColor: `${ACCENT}28` };

  function toggle(field: keyof Pick<StakeholderRecord, 'power' | 'legitimacy' | 'urgency' | 'interest'>) {
    onChange({ ...row, [field]: !row[field] });
  }

  function BoolChip({
    label,
    field,
  }: {
    label: string;
    field: 'power' | 'legitimacy' | 'urgency' | 'interest';
  }) {
    const active = row[field];
    return (
      <button
        type="button"
        onClick={() => toggle(field)}
        className="rounded-[6px] border px-2 py-0.5 text-[10px] transition"
        style={{
          borderColor: active ? `${ACCENT}60` : '#ffffff14',
          background: active ? `${ACCENT}18` : 'transparent',
          color: active ? ACCENT : '#5a6070',
        }}
        title={`${label}: 人工判断`}
      >
        {label}
      </button>
    );
  }

  return (
    <div
      className="rounded-[12px] border px-3 py-2.5"
      style={{ borderColor: `${ACCENT}18`, background: 'rgba(6,8,14,0.45)' }}
    >
      <div className="flex items-center gap-2">
        <input
          value={row.name}
          onChange={(e) => onChange({ ...row, name: e.target.value })}
          placeholder="干系人姓名/机构"
          className={`${inputCls} ${ring} flex-1`}
          style={bdr}
        />
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded-[6px] p-1 text-[#4a5060] transition hover:text-[#E5604D]"
            aria-label="删除"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      {/* RFM 数值 */}
      <div className="mt-2 grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-[#6a7080]">距上次接触(天)</label>
          <input
            type="number"
            min={0}
            value={row.recencyDays}
            onChange={(e) => onChange({ ...row, recencyDays: Math.max(0, Number(e.target.value)) })}
            className={`${inputCls} ${ring} mt-0.5`}
            style={bdr}
          />
        </div>
        <div>
          <label className="text-[10px] text-[#6a7080]">接触次数</label>
          <input
            type="number"
            min={0}
            value={row.frequency}
            onChange={(e) => onChange({ ...row, frequency: Math.max(0, Number(e.target.value)) })}
            className={`${inputCls} ${ring} mt-0.5`}
            style={bdr}
          />
        </div>
        <div>
          <label className="text-[10px] text-[#6a7080]">合作价值(元)</label>
          <input
            type="number"
            min={0}
            value={row.monetary}
            onChange={(e) => onChange({ ...row, monetary: Math.max(0, Number(e.target.value)) })}
            className={`${inputCls} ${ring} mt-0.5`}
            style={bdr}
          />
        </div>
      </div>
      {/* 人工裁量 */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-[#5a6070]">人工判断：</span>
        <BoolChip label="有权" field="power" />
        <BoolChip label="正当" field="legitimacy" />
        <BoolChip label="紧迫" field="urgency" />
        <BoolChip label="关注你" field="interest" />
      </div>
    </div>
  );
}

function PriorityResult({ result }: { result: StakeholderPriority }) {
  const [open, setOpen] = useState(false);
  const salLabel = SALIENCE_LABEL[result.salience.class] ?? result.salience.class;
  const menLabel = MENDELOW_LABEL[result.mendelow] ?? result.mendelow;
  const hasHuman = result.humanJudged.length > 0;

  return (
    <div
      className="rounded-[10px] border px-3 py-2.5"
      style={{ borderColor: `${ACCENT}22`, background: `${ACCENT}08` }}
    >
      <div className="flex items-center gap-3">
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
          style={{ background: `${ACCENT}22`, color: ACCENT }}
        >
          #{result.rank}
        </span>
        <span className="flex-1 text-[13px] font-semibold text-[#F5E9C9]">{result.name}</span>
        <span className="text-[11px]" style={{ color: `${ACCENT}cc` }}>
          RFM {result.rfm.code}
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 text-[#5a6070] transition hover:text-[#b6ab8c]"
        >
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>
      <div className="mt-1 flex flex-wrap gap-2 text-[10.5px]">
        <span className="text-[#9aa0ad]">{result.rfm.segment}</span>
        <span className="text-[#5a6070]">·</span>
        <span style={{ color: `${ACCENT}99` }}>{salLabel}</span>
        <span className="text-[#5a6070]">·</span>
        <span className="text-[#8a9aaa]">{menLabel}</span>
      </div>
      {open && (
        <div className="mt-2 space-y-1">
          <div className="text-[10.5px] text-[#6a7880]">
            R={result.rfm.r} F={result.rfm.f} M={result.rfm.m} · Salience优先级={result.salience.priority}
          </div>
          {hasHuman && (
            <div
              className="rounded-[6px] border border-dashed px-2 py-1 text-[10px]"
              style={{ borderColor: '#E5B84D28', color: '#E5B84D99' }}
            >
              ⚠ humanJudged：{result.humanJudged.join('；')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RelationshipTab() {
  const [rows, setRows] = useState<StakeholderRecord[]>([newRow(0)]);
  const [results, setResults] = useState<StakeholderPriority[] | null>(null);
  const [running, setRunning] = useState(false);

  function addRow() {
    setRows((r) => [...r, newRow(r.length)]);
  }

  function updateRow(idx: number, updated: StakeholderRecord) {
    setRows((r) => r.map((row, i) => (i === idx ? updated : row)));
  }

  function removeRow(idx: number) {
    setRows((r) => r.filter((_, i) => i !== idx));
  }

  function analyse() {
    const valid = rows.filter((r) => r.name.trim());
    if (valid.length === 0) return;
    setRunning(true);
    setTimeout(() => {
      setResults(prioritizeStakeholders(valid));
      setRunning(false);
    }, 0);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 输入区 */}
      <div
        className="rounded-[20px] border px-4 pt-4 pb-3"
        style={{ borderColor: `${ACCENT}1c`, background: 'rgba(6,8,14,0.55)' }}
      >
        <div className="mb-3 flex items-center gap-2">
          <Users size={15} style={{ color: ACCENT }} />
          <span className="text-[13px] font-semibold text-[#F5E9C9]">
            关系台账司 · 干系人优先序
          </span>
          <span className="ml-auto text-[10px] text-[#5f5a48]">数据不出浏览器（铁律9）</span>
        </div>

        <div className="space-y-2">
          {rows.map((row, idx) => (
            <StakeholderRow
              key={row.id}
              row={row}
              onChange={(r) => updateRow(idx, r)}
              onRemove={() => removeRow(idx)}
              canRemove={rows.length > 1}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[11.5px] text-[#b6ab8c] transition hover:text-[#F5E9C9] focus:outline-none focus-visible:ring-1"
            style={{ borderColor: `${ACCENT}28` }}
          >
            <Plus size={12} /> 新增干系人
          </button>

          <button
            type="button"
            onClick={analyse}
            disabled={!rows.some((r) => r.name.trim()) || running}
            className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: running ? `${ACCENT}30` : ACCENT,
              color: running ? ACCENT : '#040A10',
            }}
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
            {running ? '分析中…' : '分析优先序'}
          </button>

          <span className="ml-auto text-[10px] text-[#5f5a48]">
            LOCAL · P/L/U/Interest 为人工判断
          </span>
        </div>
      </div>

      {/* 结果区 */}
      {results && (
        <div
          className="rounded-[20px] border p-4"
          style={{ borderColor: `${ACCENT}28`, background: `${ACCENT}06` }}
        >
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 size={14} style={{ color: ACCENT }} />
            <span className="text-[13px] font-semibold text-[#F5E9C9]">
              优先序清单 · {results.length} 人
            </span>
            <span
              className="ml-auto rounded-full border px-2 py-0.5 text-[10px]"
              style={{ borderColor: `${ACCENT}30`, color: `${ACCENT}cc` }}
            >
              LOCAL · RFM+Salience+Mendelow
            </span>
          </div>
          <div className="space-y-2">
            {results.map((r) => (
              <PriorityResult key={r.id} result={r} />
            ))}
          </div>
          <p className="mt-3 text-[10px] text-[#4a5060]">
            综合序 = Salience 优先级（×10）+ RFM 三维分。人工裁量字段影响 Salience/Mendelow 结论，如实标 humanJudged。
          </p>
        </div>
      )}

      {/* 空状态 */}
      {!results && !running && (
        <div
          className="flex flex-1 flex-col items-center justify-center rounded-[20px] border border-dashed py-10"
          style={{ borderColor: `${ACCENT}14` }}
        >
          <Users size={32} style={{ color: `${ACCENT}38` }} />
          <p className="mt-3 text-[13px] text-[#5f6570]">填入干系人信息，点「分析优先序」</p>
          <p className="mt-1 text-[11px] text-[#3a3e4c]">
            RFM 五分位 + Salience 三维 + Mendelow 象限
          </p>
        </div>
      )}
    </div>
  );
}

// ── 流量增长 tab ──────────────────────────────────────────────────────────────

const EMPTY_CHANNEL: Omit<ChannelMetrics, 'channel'> = {
  spend: 0,
  conversions: 0,
};

function newChannel(idx: number): ChannelMetrics & { _id: string } {
  return { ...EMPTY_CHANNEL, channel: '', _id: `c-${Date.now()}-${idx}` };
}

type ChannelRow = ChannelMetrics & { _id: string };

function ChannelRowInput({
  row,
  onChange,
  onRemove,
  canRemove,
}: {
  row: ChannelRow;
  onChange: (r: ChannelRow) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const inputCls =
    'w-full rounded-[8px] border bg-transparent px-2.5 py-1.5 text-[11.5px] text-[#E9DDBE] placeholder:text-[#3a3e4c] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C070D0]';
  const bdr = { borderColor: `${ACCENT}28` };

  return (
    <div
      className="rounded-[12px] border px-3 py-2.5"
      style={{ borderColor: `${ACCENT}18`, background: 'rgba(6,8,14,0.45)' }}
    >
      <div className="flex items-center gap-2">
        <input
          value={row.channel}
          onChange={(e) => onChange({ ...row, channel: e.target.value })}
          placeholder="渠道名（公众号/视频号/SEM/展会…）"
          className={`${inputCls} flex-1`}
          style={bdr}
        />
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded-[6px] p-1 text-[#4a5060] transition hover:text-[#E5604D]"
            aria-label="删除"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label className="text-[10px] text-[#6a7080]">投入(元)</label>
          <input
            type="number"
            min={0}
            value={row.spend}
            onChange={(e) => onChange({ ...row, spend: Math.max(0, Number(e.target.value)) })}
            className={`${inputCls} mt-0.5`}
            style={bdr}
          />
        </div>
        <div>
          <label className="text-[10px] text-[#6a7080]">转化数</label>
          <input
            type="number"
            min={0}
            value={row.conversions}
            onChange={(e) => onChange({ ...row, conversions: Math.max(0, Number(e.target.value)) })}
            className={`${inputCls} mt-0.5`}
            style={bdr}
          />
        </div>
        <div>
          <label className="text-[10px] text-[#6a7080]">营收(元，可选)</label>
          <input
            type="number"
            min={0}
            value={row.revenue ?? ''}
            onChange={(e) =>
              onChange({
                ...row,
                revenue: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)),
              })
            }
            placeholder="—"
            className={`${inputCls} mt-0.5`}
            style={bdr}
          />
        </div>
        <div>
          <label className="text-[10px] text-[#6a7080]">点击数(可选)</label>
          <input
            type="number"
            min={0}
            value={row.clicks ?? ''}
            onChange={(e) =>
              onChange({
                ...row,
                clicks: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)),
              })
            }
            placeholder="—"
            className={`${inputCls} mt-0.5`}
            style={bdr}
          />
        </div>
      </div>
    </div>
  );
}

function ChannelResult({ r }: { r: ChannelROI }) {
  const cfg = VERDICT_CONFIG[r.verdict];
  return (
    <div
      className="rounded-[10px] border px-3 py-2"
      style={{ borderColor: cfg.border, background: cfg.bg }}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className="shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase"
          style={{ background: `${cfg.color}22`, color: cfg.color }}
        >
          {cfg.label}
        </span>
        <span className="flex-1 text-[13px] font-semibold text-[#E9DDBE]">{r.channel}</span>
        {r.roas != null && (
          <span className="font-mono text-[11.5px] text-[#b6ab8c]">ROAS {r.roas}</span>
        )}
        {r.cac != null && (
          <span className="font-mono text-[11px] text-[#7a8090]">CAC ¥{r.cac}</span>
        )}
      </div>
      <p className="mt-1 text-[11px]" style={{ color: `${cfg.color}bb` }}>
        {r.reason}
      </p>
      {r.thin && r.roas != null && (
        <p className="mt-0.5 text-[10.5px] text-[#E5B84D88]">
          ⚠ 转化样本薄，结论参考为主
        </p>
      )}
    </div>
  );
}

function GrowthTab() {
  const [channels, setChannels] = useState<ChannelRow[]>([newChannel(0)]);
  const [decision, setDecision] = useState<GrowthDecision | null>(null);
  const [running, setRunning] = useState(false);

  function addChannel() {
    setChannels((c) => [...c, newChannel(c.length)]);
  }

  function updateChannel(idx: number, updated: ChannelRow) {
    setChannels((c) => c.map((row, i) => (i === idx ? updated : row)));
  }

  function removeChannel(idx: number) {
    setChannels((c) => c.filter((_, i) => i !== idx));
  }

  function analyse() {
    const valid = channels.filter((r) => r.channel.trim() && r.spend > 0);
    if (valid.length === 0) return;
    setRunning(true);
    setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const metrics = valid.map(({ _id, ...rest }) => rest);
      setDecision(rankChannels(metrics));
      setRunning(false);
    }, 0);
  }

  const canAnalyse = channels.some((r) => r.channel.trim() && r.spend > 0);

  return (
    <div className="flex flex-col gap-3">
      {/* 输入区 */}
      <div
        className="rounded-[20px] border px-4 pt-4 pb-3"
        style={{ borderColor: `${ACCENT}1c`, background: 'rgba(6,8,14,0.55)' }}
      >
        <div className="mb-3 flex items-center gap-2">
          <BarChart2 size={15} style={{ color: ACCENT }} />
          <span className="text-[13px] font-semibold text-[#F5E9C9]">
            流量增长司 · 渠道 ROI 决策
          </span>
          <span className="ml-auto text-[10px] text-[#5f5a48]">数据不出浏览器（铁律9）</span>
        </div>

        <div className="space-y-2">
          {channels.map((row, idx) => (
            <ChannelRowInput
              key={row._id}
              row={row}
              onChange={(r) => updateChannel(idx, r)}
              onRemove={() => removeChannel(idx)}
              canRemove={channels.length > 1}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={addChannel}
            className="inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[11.5px] text-[#b6ab8c] transition hover:text-[#F5E9C9] focus:outline-none focus-visible:ring-1"
            style={{ borderColor: `${ACCENT}28` }}
          >
            <Plus size={12} /> 新增渠道
          </button>

          <button
            type="button"
            onClick={analyse}
            disabled={!canAnalyse || running}
            className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: running ? `${ACCENT}30` : ACCENT,
              color: running ? ACCENT : '#040A10',
            }}
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
            {running ? '分析中…' : '分析 ROI'}
          </button>

          <span className="ml-auto text-[10px] text-[#5f5a48]">
            LOCAL · ROAS/CAC 确定性计算
          </span>
        </div>
      </div>

      {/* 结果区 */}
      {decision && (
        <div
          className="rounded-[20px] border p-4"
          style={{ borderColor: `${ACCENT}28`, background: `${ACCENT}06` }}
        >
          {/* 建议横幅 */}
          <div
            className="mb-3 rounded-[12px] border px-3 py-2.5"
            style={{ borderColor: `${ACCENT}28`, background: `${ACCENT}0c` }}
          >
            <div className="flex items-start gap-2">
              <TrendingUp size={14} style={{ color: ACCENT }} className="mt-0.5 shrink-0" />
              <div>
                <span className="text-[11px] uppercase tracking-[0.16em]" style={{ color: `${ACCENT}88` }}>
                  预算搬家建议
                </span>
                <p className="mt-0.5 text-[12.5px] text-[#E9DDBE]">{decision.recommendation}</p>
              </div>
            </div>
          </div>

          {/* ROI 排序 */}
          <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-[#8f835f]">
            渠道 ROI 排序 · {decision.ranked.length} 个
          </div>
          <div className="space-y-2">
            {decision.ranked.map((r, idx) => (
              <ChannelResult key={`${r.channel}-${idx}`} r={r} />
            ))}
          </div>

          <p className="mt-3 text-[10px] text-[#4a5060]">
            LOCAL · 咨询面板，非投放执行（铁律9）。薄转化（&lt;10次）只观察不下定论。
          </p>
        </div>
      )}

      {/* 空状态 */}
      {!decision && !running && (
        <div
          className="flex flex-1 flex-col items-center justify-center rounded-[20px] border border-dashed py-10"
          style={{ borderColor: `${ACCENT}14` }}
        >
          <BarChart2 size={32} style={{ color: `${ACCENT}38` }} />
          <p className="mt-3 text-[13px] text-[#5f6570]">填入渠道数据，点「分析 ROI」</p>
          <p className="mt-1 text-[11px] text-[#3a3e4c]">
            ROAS 排序 + 预算搬家建议（薄数据如实标不足）
          </p>
        </div>
      )}
    </div>
  );
}

// ── 主导出 ────────────────────────────────────────────────────────────────────

export function LifuGrowthWorkbench() {
  const [tab, setTab] = useState<Tab>('relationship');

  const tabBtn = (t: Tab, label: string, Icon: React.ComponentType<{ size?: number }>) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === t}
      onClick={() => setTab(t)}
      className="inline-flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-[12.5px] font-semibold transition focus:outline-none focus-visible:ring-2"
      style={{
        background: tab === t ? `${ACCENT}22` : 'transparent',
        color: tab === t ? ACCENT : '#6a7080',
        borderBottom: tab === t ? `2px solid ${ACCENT}` : '2px solid transparent',
      }}
    >
      <Icon size={14} />
      {label}
    </button>
  );

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto">
      {/* Tab 切换 */}
      <div
        className="flex flex-wrap gap-1 rounded-[14px] border p-1"
        style={{ borderColor: `${ACCENT}1c`, background: 'rgba(6,8,14,0.45)' }}
      >
        {tabBtn('relationship', '关系台账', Users)}
        {tabBtn('growth', '流量增长', BarChart2)}
        {tabBtn('crisis', '危机公关', AlertTriangle)}
        {tabBtn('negotiation', '对外谈判', Scale)}
        <div className="ml-auto flex items-center">
          <span
            className="rounded-full border px-2 py-0.5 text-[10px]"
            style={{ borderColor: `${ACCENT}28`, color: `${ACCENT}88` }}
          >
            <AlertCircle size={10} className="mr-1 inline" />
            LOCAL
          </span>
        </div>
      </div>

      {/* Tab 内容 */}
      {tab === 'relationship' && <RelationshipTab />}
      {tab === 'growth' && <GrowthTab />}
      {tab === 'crisis' && <CrisisTab />}
      {tab === 'negotiation' && <NegotiationTab />}
    </div>
  );
}
