'use client';

/**
 * 户部 · 预算司/出纳司深度预览(2026-07-09)
 *
 * P1(见 docs/liubu-frontend-backend-wiring-plan-2026-07-09.md)：backend/web/routers/hubu.py
 * 的 preview 端点(finance/reporting/intake/cashflow)真实实现、只被会审 L3/L4 通路调过，
 * 用户端不可达。这几个端点吃的是结构化事实包(trialBalance/cashFlow/dataSources 等)，
 * 不是自由文本——不像刑部/兵部那样能直接接一个文本框，真正的表单化数据录入(多科目、
 * 多笔往来款项)是新功能建设，超出本轮"检查/接通已有接口"的边界。这里先给可用的最小
 * 版本：粘贴结构化 JSON 事实包 → 真打后端 → 看真实预览结果，不再是"完全接不到"。
 */
import { useState } from 'react';
import { Loader2, FileJson, ShieldAlert } from 'lucide-react';
import { backendFetch } from '@/lib/backend-api';

const ACCENT = '#3E6E8E';
const C = { warm: '#DCE6EE', dim: '#9AAABB', faint: '#78889A', border: `${ACCENT}30`, live: '#7FC9A8', amber: '#E5B84D', danger: '#E5847A' };

type PanelPhase = 'idle' | 'running' | 'done' | 'error';

interface CourtDocItem { level?: 'red' | 'yellow' | 'green'; title?: string; fix?: string | null }
interface CourtDocShape { light?: 'red' | 'yellow' | 'green'; headline?: string; items?: CourtDocItem[] }

const LIGHT_COLOR: Record<string, string> = { red: C.danger, yellow: C.amber, green: C.live };

export function HubuFinancePreviewPanel({
  title,
  endpoint,
  placeholder,
}: {
  title: string;
  endpoint: string;
  placeholder: string;
}) {
  const [raw, setRaw] = useState('');
  const [phase, setPhase] = useState<PanelPhase>('idle');
  const [result, setResult] = useState<unknown>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const busy = phase === 'running';

  async function runPreview() {
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      setErrorMessage('不是合法 JSON，检查一下括号和逗号。');
      setPhase('error');
      return;
    }
    setPhase('running');
    setErrorMessage('');
    try {
      const res = await backendFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: unknown; error?: string };
      if (!res.ok || !json.success) {
        setErrorMessage(json.error ?? '预览生成失败');
        setPhase('error');
        return;
      }
      setResult(json.data);
      setPhase('done');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  }

  const courtDoc = result as CourtDocShape | null;
  const isCourtDoc = !!courtDoc && typeof courtDoc === 'object' && 'headline' in courtDoc;

  return (
    <div className="mt-3 rounded-[16px] border px-4 py-3.5" style={{ borderColor: C.border, background: `linear-gradient(180deg, ${ACCENT}10 0%, rgba(6,8,14,0.92) 100%)` }}>
      <div className="flex items-center gap-2">
        <FileJson size={14} style={{ color: ACCENT }} />
        <span className="display-serif text-[14px]" style={{ color: C.warm }}>进阶：{title}</span>
        <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ border: `1px solid ${C.live}44`, color: C.live, background: `${C.live}12` }}>户部真链</span>
      </div>
      <p className="mt-1 text-[11.5px]" style={{ color: C.faint }}>
        粘贴结构化事实包(JSON)，真打后端预览端点——只生成预览草稿，不写库、不执行付款/报送。
      </p>

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={placeholder}
        disabled={busy}
        rows={6}
        className="mt-2.5 w-full rounded-[9px] border bg-transparent px-3 py-2 font-mono text-[12px] outline-none disabled:opacity-60"
        style={{ borderColor: C.border, color: C.warm }}
      />
      <button
        type="button"
        onClick={() => void runPreview()}
        disabled={busy || raw.trim().length < 2}
        className="mt-2 inline-flex items-center gap-1.5 rounded-[9px] px-4 py-2 text-[13px] font-semibold transition disabled:opacity-45"
        style={{ background: `linear-gradient(135deg, ${ACCENT}, #86A9F2)`, color: '#04101a' }}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <FileJson size={14} />}
        {busy ? '预览生成中…' : '生成预览'}
      </button>

      {phase === 'error' && (
        <p className="mt-3 text-[12.5px]" style={{ color: C.danger }}>{errorMessage}</p>
      )}

      {phase === 'done' && result != null && (
        <div className="mt-3 rounded-[12px] border px-3 py-2.5" style={{ borderColor: '#ffffff12', background: '#ffffff05' }}>
          {isCourtDoc ? (
            <>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: LIGHT_COLOR[courtDoc?.light ?? 'yellow'] }} />
                <span className="text-[12.5px]" style={{ color: C.dim }}>{courtDoc?.headline || '后端未返回摘要。'}</span>
              </div>
              {courtDoc?.items && courtDoc.items.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {courtDoc.items.map((f, index) => (
                    <div
                      key={`${f.title ?? 'finding'}-${index}`}
                      className="rounded-[10px] border px-2.5 py-2"
                      style={{ borderColor: `${LIGHT_COLOR[f.level ?? 'yellow']}30`, background: `${LIGHT_COLOR[f.level ?? 'yellow']}0a` }}
                    >
                      <div className="flex items-start gap-1.5 text-[11.5px]" style={{ color: C.dim }}>
                        {f.level === 'red' && <ShieldAlert size={13} className="mt-0.5 shrink-0" style={{ color: C.danger }} />}
                        <span><strong style={{ color: C.warm }}>{f.title ?? '核查项'}</strong></span>
                      </div>
                      {f.fix && <p className="mt-1 text-[11px]" style={{ color: C.faint }}>建议：{f.fix}</p>}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px]" style={{ color: C.dim }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
