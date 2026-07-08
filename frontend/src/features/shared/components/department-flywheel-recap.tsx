'use client';

/**
 * 部门校准飞轮 · 周报内嵌段（2026-06-29）
 *
 * 把已建好却隐形的"部门学习飞轮"点亮给人看：各部从老板拍板/史馆旧案的真结果里学，
 * confirmed/refuted 越积越准。纯读 `/api/court/learning/records`(只读) + 客户端纯函数
 * summarizeDepartmentLearning 汇总；不碰会写库的 calibration、不改周报结构(仅插一段)。
 *
 * 诚实：records 为空 → 显"飞轮待启动"，不编；resultSourceStale → 显"结果源未接,空转"预警。
 * 配色匹配周报羊皮纸(非暗金驾驶舱)。
 */
import useSWR from 'swr';

import { withBasePath } from '@/lib/base-path';
import { summarizeDepartmentLearning } from '@/lib/department-learning/loop';
import { computeSignalSourceReliability } from '@/lib/department-learning/qintian-signal-tracking';
import { useIntelSignals } from '@/lib/hooks/use-intel-signals';
import type { DepartmentLearningRecord } from '@/lib/contracts/department-learning';

const GOLD = '#8A6224';
const INK = '#5A3E1A';
const ALERT = '#B4533A';
const OBSERVATORY = '#6C4FA0';

async function fetchRecords(url: string): Promise<DepartmentLearningRecord[]> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return [];
  const json = (await res.json()) as { success?: boolean; data?: { records?: DepartmentLearningRecord[] } };
  return json?.data?.records ?? [];
}

interface BacktestFinding { id: string; command: string; engineVerdict: string; missedRisks: string[]; }
interface BacktestReport { replayed: number; missedCount: number; missed: BacktestFinding[]; }

async function fetchBacktest(url: string): Promise<BacktestReport> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return { replayed: 0, missedCount: 0, missed: [] };
  const json = (await res.json()) as { data?: BacktestReport };
  return json?.data ?? { replayed: 0, missedCount: 0, missed: [] };
}

export function DepartmentFlywheelRecap() {
  const { data: records } = useSWR<DepartmentLearningRecord[]>(
    withBasePath('/api/court/learning/records'),
    fetchRecords,
    { refreshInterval: 120_000, revalidateOnFocus: true },
  );
  const { data: bt } = useSWR<BacktestReport>(
    withBasePath('/api/court/learning/backtest'),
    fetchBacktest,
    { refreshInterval: 120_000, revalidateOnFocus: true },
  );
  const { signals: intelSignals } = useIntelSignals();
  const list = records ?? [];
  const m = summarizeDepartmentLearning(list);
  // 钦天监事件预测·按情报来源可靠度回溯(2026-07-04)：只读，不新增页面/cron——溶解进本
  // 已有周报飞轮段(铁律5)。records 里暂无 citedSignalIds 的预测→空数组，诚实显"待启动"。
  const sourceReliability = computeSignalSourceReliability(list, intelSignals);

  return (
    <div className="px-10 pb-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: GOLD }}>
        Department Calibration · 部门校准飞轮
      </div>

      {m.total === 0 ? (
        <div
          className="mt-3 rounded-lg border-2 border-dashed px-4 py-3 text-[12px] italic"
          style={{ borderColor: GOLD, color: GOLD, background: 'rgba(138,98,36,0.05)' }}
        >
          飞轮待启动 · 老板拍板或史馆旧案回填后，各部开始从真结果里学，准度逐周累积。
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[
              { label: '已兑现 confirmed', value: m.confirmed, hint: '判断被结果证实' },
              { label: '已证伪 refuted', value: m.refuted, hint: '判断被结果推翻' },
              { label: '校准中', value: m.observing + m.unknown, hint: '待结果源兑现' },
            ].map((t) => (
              <div
                key={t.label}
                className="rounded-lg border px-3 py-2"
                style={{ borderColor: GOLD, background: 'rgba(255,255,255,0.45)' }}
              >
                <div className="text-[10px] tracking-[0.15em]" style={{ color: GOLD }}>{t.label}</div>
                <div className="mt-0.5 text-[20px] font-bold tabular-nums" style={{ color: INK, fontFamily: '"Noto Serif SC", serif' }}>
                  {t.value}
                </div>
                <div className="text-[10px]" style={{ color: GOLD }}>{t.hint}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[12px]" style={{ color: INK }}>
            兑现率 <span className="font-bold">{Math.round(m.confirmedRate * 100)}%</span>
            （{m.confirmed}/{m.total} 项已从真结果校准）
            {m.resultSourceStale && (
              <span className="ml-2 italic" style={{ color: '#B4533A' }}>
                · ⚠ 有 {m.dueUnresolved} 项过期未兑现，结果源待接，飞轮在空转
              </span>
            )}
          </div>
        </>
      )}

      {/* 决策回测：回放历史决定，AI 会多提示几个老板漏的风险 */}
      {bt && bt.replayed > 0 && (
        <div className="mt-4 rounded-lg border-2 px-4 py-3" style={{ borderColor: bt.missedCount > 0 ? ALERT : GOLD, background: bt.missedCount > 0 ? 'rgba(180,83,58,0.06)' : 'rgba(138,98,36,0.05)' }}>
          <div className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: bt.missedCount > 0 ? ALERT : GOLD }}>
            Decision Backtest · 决策回测
          </div>
          <div className="mt-1.5 text-[13px] font-bold" style={{ color: INK, fontFamily: '"Noto Serif SC", serif' }}>
            回放过去 {bt.replayed} 个决定 ·
            {bt.missedCount > 0
              ? ` AI 会多提示 ${bt.missedCount} 个你当时漏的风险`
              : ' AI 与你的判断一致，无遗漏风险'}
          </div>
          {bt.missed.slice(0, 3).map((f) => (
            <div key={f.id} className="mt-2 border-t pt-2 text-[11.5px]" style={{ borderColor: 'rgba(138,98,36,0.2)', color: INK }}>
              <div className="font-medium">「{f.command}」<span className="italic" style={{ color: GOLD }}>· 你当时采纳</span></div>
              <div style={{ color: ALERT }}>⚠ {f.missedRisks.join('；')}</div>
            </div>
          ))}
        </div>
      )}

      {/* 钦天监 · 情报来源可靠度(2026-07-04)：哪家情报来源引用过的预测，事后被证实/证伪的比例。
          样本不足(尚无 confirmed/refuted)诚实显"暂无足够样本"，不编 0%/NaN(用户红线)。 */}
      <div className="mt-4 rounded-lg border-2 border-dashed px-4 py-3" style={{ borderColor: OBSERVATORY, background: 'rgba(108,79,160,0.05)' }}>
        <div className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: OBSERVATORY }}>
          🔭 Qintian Signal Reliability · 钦天监 · 情报来源可靠度
        </div>
        {sourceReliability.length === 0 ? (
          <div className="mt-1.5 text-[12px] italic" style={{ color: OBSERVATORY }}>
            暂无钦天监预测引用记录 · 户部/工部驾驶舱产生真引用锦衣卫信号的预测后，此处开始累积。
          </div>
        ) : (
          <div className="mt-2 space-y-1.5">
            {sourceReliability.map((r) => (
              <div key={r.source} className="flex items-center justify-between text-[12px]" style={{ color: INK }}>
                <span className="font-medium">{r.source}</span>
                <span>
                  {r.reliabilityRate === null
                    ? <span className="italic" style={{ color: OBSERVATORY }}>暂无足够样本（{r.totalCitations} 次引用，待结果源核验）</span>
                    : <span>兑现率 <span className="font-bold">{Math.round(r.reliabilityRate * 100)}%</span>（{r.confirmed}/{r.confirmed + r.refuted}，{r.totalCitations} 次引用）</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
