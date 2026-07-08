'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { chaotang } from '@/lib/api/chaotang';

type CommandType = 'instruction' | 'followup' | 'summon' | 'search' | 'material';

export interface DispatchResult {
  taskId: string;
  intent: string;
  taskType: string;
  departments: string[];
  dispatchedSwarms: string[];
  source: 'llm' | 'rule';
  subtaskCount: number;
}

interface Props {
  targetSwarmId?: string;
  onSent?: () => void;
  onDispatched?: (result: DispatchResult) => void;
}

const TYPE_LABELS: Record<CommandType, string> = {
  instruction: '下旨',
  followup: '追问',
  summon: '召见',
  search: '搜查',
  material: '提供材料',
};

const DEPT_LABELS: Record<string, string> = {
  hu_bu: '户部',
  gong_bu: '工部',
  li_bu_rites: '礼部',
  qin_tian_jian: '钦天监',
  jin_yi_wei: '锦衣卫',
  li_bu: '吏部',
  bing_bu: '兵部',
  xing_bu: '刑部',
  prime_minister: '丞相',
  scribe: '史官',
  tai_yi_yuan: '太医院',
};

export function GlobalInteractionBar({ targetSwarmId, onSent, onDispatched }: Props) {
  const [content, setContent] = useState('');
  const [type, setType] = useState<CommandType>('instruction');
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastDispatch, setLastDispatch] = useState<DispatchResult | null>(null);

  async function send() {
    const trimmed = content.trim();
    if (!trimmed) return;
    setSending(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      if (targetSwarmId) {
        setStatusMsg('派遣中…');
        await api.post(`/swarms/${targetSwarmId}/commands`, {
          taskId: 'cmd-' + Date.now(),
          taskTitle: trimmed.slice(0, 40),
          instructions: trimmed,
          actor: '皇帝',
        });
        setContent('');
        setStatusMsg('已派遣 ✓');
        onSent?.();
      } else if (type === 'instruction') {
        // 真·群臣会审(chaotang.orchestrate)：确定性 router 召部门 live agent→callLLM→merge→写主库 tasks。
        // 旧 /prime-minister/dispatch 打 NestJS :3000/:4000(本机均未运行)，已废弃改走真 orchestrate。
        setStatusMsg('丞相会审中：召部门 live agent（最长 90 秒）…');
        const r = await chaotang.orchestrate(trimmed);
        const called = r.called ?? r.route?.departments ?? [];
        const result: DispatchResult = {
          taskId: r.taskId ?? '',
          intent: r.merge.verdict || trimmed,
          taskType: r.merge.escalateToBoss ? '伏候圣裁' : 'orchestrate',
          departments: called,
          dispatchedSwarms: called.map((d) => `swarm-${d.replace(/_/g, '-')}`),
          source: r.merge.grounded ? 'llm' : 'rule',
          subtaskCount: r.merge.contributors?.length ?? 0,
        };
        setLastDispatch(result);
        onDispatched?.(result);
        setContent('');
        setStatusMsg(`已会审 ${called.length} 部 ✓`);
        onSent?.();
      } else {
        setStatusMsg('提交中…');
        await api.post('/commands', { type, content: trimmed });
        setContent('');
        setStatusMsg('已提交 ✓');
        onSent?.();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error('[GlobalInteractionBar] send failed:', err);
      setErrorMsg(msg.includes('401') ? '请先登录' : `失败：${msg}`);
      setStatusMsg(null);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-2">
      {(statusMsg || errorMsg) && (
        <div
          className="px-3 py-2 text-xs"
          style={{
            border: `1px solid ${errorMsg ? '#F43F5E' : '#3DD68C'}`,
            borderRadius: '8px',
            background: errorMsg ? 'rgba(244,63,94,0.08)' : 'rgba(61,214,140,0.06)',
            color: errorMsg ? '#F43F5E' : '#3DD68C',
          }}
          role={errorMsg ? 'alert' : 'status'}
        >
          {errorMsg ?? statusMsg}
        </div>
      )}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{
          border: '1px solid #1A2142',
          borderRadius: '12px',
          background: 'rgba(15,20,40,0.7)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <select
          value={type}
          onChange={e => setType(e.target.value as CommandType)}
          className="rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-600 cursor-pointer"
          style={{ background: 'rgba(10,14,30,0.8)', border: '1px solid #1A2142', color: '#9AA3C4' }}
        >
          {(Object.keys(TYPE_LABELS) as CommandType[]).map(t => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>

        <input
          className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-[#6A7299]"
          style={{ color: '#EAEEFB' }}
          placeholder={
            !targetSwarmId && type === 'instruction'
              ? '下旨内容…（丞相将自动拆解派遣）'
              : `${TYPE_LABELS[type]}内容…`
          }
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) void send();
          }}
        />

        <button
          onClick={() => void send()}
          disabled={sending || !content.trim()}
          className="rounded-lg px-4 py-1.5 text-xs font-semibold disabled:opacity-40 transition-colors"
          style={{ background: '#8A6A2A', color: '#F0C66A' }}
          onMouseEnter={e => {
            if (!sending && content.trim()) e.currentTarget.style.background = '#A07830';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#8A6A2A';
          }}
        >
          {sending ? '…' : '发令'}
        </button>
      </div>

      {lastDispatch && (
        <div
          className="px-4 py-3 text-xs"
          style={{
            border: '1px solid #1A2142',
            borderRadius: '12px',
            background: 'rgba(10,14,30,0.55)',
            color: '#EAEEFB',
          }}
        >
          {/* LLM 降级模式横条 — 当上游 LLM 失败、丞相走本地规则解析时提醒用户 */}
          {lastDispatch.source === 'rule' && (
            <div
              className="mb-2 rounded-md px-2.5 py-1.5 text-[11px]"
              style={{
                background: 'rgba(245,165,36,0.08)',
                border: '1px solid rgba(245,165,36,0.25)',
                color: '#F5A524',
              }}
              role="status"
            >
              ⚠ 上游 LLM 服务不稳，丞相走规则降级 — 派遣有效但分析深度有限。建议稍后重试。
            </div>
          )}
          <div className="mb-1 flex items-center gap-2">
            <span style={{ color: '#F0C66A', fontWeight: 600 }}>丞相已派遣</span>
            <span
              className="rounded px-1.5 py-0.5"
              style={{
                background: lastDispatch.source === 'llm' ? '#3DD68C22' : '#4A82F022',
                color: lastDispatch.source === 'llm' ? '#3DD68C' : '#6BA0FF',
                fontSize: '10px',
              }}
            >
              {lastDispatch.source === 'llm' ? 'LLM 解析' : '规则解析'}
            </span>
            <span style={{ color: '#6A7299' }}>· {lastDispatch.subtaskCount} 子任务</span>
            <button
              onClick={() => setLastDispatch(null)}
              className="ml-auto"
              style={{ color: '#484F72', fontSize: '11px' }}
            >
              ×
            </button>
          </div>
          <p style={{ color: '#9AA3C4' }}>{lastDispatch.intent}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {lastDispatch.departments.map(d => (
              <span
                key={d}
                className="rounded px-1.5 py-0.5"
                style={{
                  background: lastDispatch.dispatchedSwarms.includes(`swarm-${d.replace(/_/g, '-')}`)
                    ? '#8A6A2A33'
                    : '#1A214233',
                  color: lastDispatch.dispatchedSwarms.includes(`swarm-${d.replace(/_/g, '-')}`)
                    ? '#F0C66A'
                    : '#6A7299',
                  fontSize: '11px',
                }}
              >
                {DEPT_LABELS[d] ?? d}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
