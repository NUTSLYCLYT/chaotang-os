'use client';

/**
 * 登基 90s 原型 · 骨架(CORONATION_SPEC)
 *
 * 桩骨架:空殿 → 下第一道旨 → 群臣依次苏醒(因果链)→ 含一位谏官出列 →
 * 诚实演出"慢"/回奏 → 峰终。视觉先用占位,封神细节后续迭代。
 * 全局"演示态"标记(provenance=demo):封神不靠骗。
 */

import { useCoronation } from './hooks/useCoronation';
import { ProvenanceBadge } from './components/ProvenanceBadge';
import { SAMPLE_DECREES } from './lib/coronation-scenario';
import type { Minister, MinisterState } from './lib/coronation-machine';

const STATE_LABEL: Record<MinisterState, string> = {
  asleep: '未就位',
  waking: '就位',
  thinking: '思忖',
  reporting: '回奏',
  remonstrating: '出列谏言',
  slow: '告退去查…',
  silent_failed: '臣办不成',
};

function MinisterRow({ m }: { m: Minister }) {
  const dim = m.state === 'asleep';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        padding: '6px 0',
        opacity: dim ? 0.35 : 1,
        transition: 'opacity 240ms ease',
      }}
    >
      <span style={{ width: 56, color: '#C6BB9D', fontFamily: 'var(--font-serif)' }}>{m.name}</span>
      <span style={{ width: 72, fontSize: 12, color: '#8F835F' }}>{STATE_LABEL[m.state]}</span>
      <ProvenanceBadge provenance={m.provenance} />
      {m.line && <span style={{ fontSize: 13, color: '#EAEEFB' }}>{m.line}</span>}
    </div>
  );
}

export function CoronationPrototype() {
  const { state, issueDecree, reset, playing } = useCoronation();

  return (
    <div style={{ minHeight: '100%', background: '#04060E', color: '#EAEEFB', padding: 24 }}>
      {/* 全局演示态标记 */}
      <div style={{ marginBottom: 16 }}>
        <ProvenanceBadge provenance={state.provenance} />
        <span style={{ marginLeft: 8, fontSize: 11, color: '#8F835F' }}>
          登基原型 · 假数据真状态机(成功/慢/失败/谏言皆真分支)
        </span>
      </div>

      {state.phase === 'empty_hall' ? (
        <div>
          <p style={{ color: '#8F835F', marginBottom: 12 }}>空荡的大殿,只待陛下第一道旨。</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SAMPLE_DECREES.map((d) => (
              <button
                key={d}
                onClick={() => issueDecree(d)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: '1px solid #F0C66A55',
                  background: '#F0C66A10',
                  color: '#F0C66A',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 12, color: '#F0C66A', fontFamily: 'var(--font-serif)' }}>
            旨:{state.decree}
          </div>
          <div>
            {state.ministers.map((m) => (
              <MinisterRow key={m.id} m={m} />
            ))}
          </div>
          {state.phase === 'reported' && (
            <div style={{ marginTop: 16, fontSize: 12, color: '#B9F6D2' }}>
              满朝已回奏 —— 此处应落"属于你自己的具体结果"(峰终,待迭代)。
            </div>
          )}
          <button
            onClick={reset}
            disabled={playing}
            style={{
              marginTop: 20,
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid #ffffff22',
              background: 'transparent',
              color: '#8F835F',
              cursor: playing ? 'default' : 'pointer',
              opacity: playing ? 0.4 : 1,
            }}
          >
            重来
          </button>
        </div>
      )}
    </div>
  );
}
