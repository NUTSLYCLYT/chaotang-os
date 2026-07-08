'use client';

/**
 * 第一刀(Jobs:先封一个大臣的回奏,再封满朝)。
 * 只雕「下旨 → 户部首字回奏 <1.5s」那一段,做到像魔术:
 *   空殿 → 下旨(帝金落印)→ 一瞬静默 → 户部苏醒(帝金辉光)→ 逐字开口 → 首字延迟可感且真测。
 * 用已注册的冻结 utility class(gold-text/display-serif/animate-pulse-glow/animate-fade-in-up),不碰冻结资产。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTypewriter } from '../hooks/useTypewriter';
import { ProvenanceBadge } from './ProvenanceBadge';
import { SAMPLE_DECREES } from '../lib/coronation-scenario';

type Beat = 'empty' | 'hush' | 'waking' | 'speaking' | 'done';

const HUBU_LINE = '毛利率已逼近安全线,压价空间仅三个点,陛下三思。';
const HUSH_MS = 420; // 下旨后一瞬静默(屏息)
const WAKE_MS = 440; // 户部苏醒到开口(累计 ≈860ms,稳在 1.5s 内)

export function FirstDecreeBeat() {
  const [beat, setBeat] = useState<Beat>('empty');
  const [decree, setDecree] = useState('');
  const { text, streaming, firstCharMs, stream, reset } = useTypewriter();
  const timers = useRef<number[]>([]);

  const clear = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const issue = useCallback(
    (d: string) => {
      clear();
      reset();
      setDecree(d);
      const t0 = performance.now();
      setBeat('hush');
      timers.current.push(window.setTimeout(() => setBeat('waking'), HUSH_MS));
      timers.current.push(
        window.setTimeout(() => {
          setBeat('speaking');
          stream(HUBU_LINE, t0); // 首字延迟从「下旨那刻」真实测量
        }, HUSH_MS + WAKE_MS),
      );
    },
    [clear, reset, stream],
  );

  // 流式结束 → done
  useEffect(() => {
    if (beat === 'speaking' && !streaming && text.length >= HUBU_LINE.length) setBeat('done');
  }, [beat, streaming, text]);

  const restart = useCallback(() => {
    clear();
    reset();
    setDecree('');
    setBeat('empty');
  }, [clear, reset]);

  useEffect(() => () => clear(), [clear]);

  const lit = beat === 'waking' || beat === 'speaking' || beat === 'done';
  const latencyOk = firstCharMs !== null && firstCharMs <= 1500;

  return (
    <div
      style={{
        minHeight: '100%',
        background: 'radial-gradient(120% 90% at 50% 30%, #0a1020 0%, #04060E 70%)',
        color: '#EAEEFB',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 28,
      }}
    >
      <div style={{ position: 'absolute', top: 16, left: 16 }}>
        <ProvenanceBadge provenance="demo" />
        <span style={{ marginLeft: 8, fontSize: 11, color: '#5a5340' }}>登基 · 第一刀(户部首字)</span>
      </div>

      {beat === 'empty' ? (
        <div className="animate-fade-in-up" style={{ textAlign: 'center', maxWidth: 560 }}>
          <p className="page-eyebrow" style={{ marginBottom: 14 }}>空荡的大殿,只待第一道旨</p>
          <h1 className="display-serif gold-text" style={{ fontSize: 30, marginBottom: 24 }}>
            陛下,请下第一道旨
          </h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            {SAMPLE_DECREES.map((d) => (
              <button
                key={d}
                onClick={() => issue(d)}
                style={{
                  padding: '11px 18px',
                  borderRadius: 999,
                  border: '1px solid #F0C66A44',
                  background: '#F0C66A0E',
                  color: '#F0C66A',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontFamily: 'var(--font-serif)',
                  transition: 'all 160ms ease',
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* 旨:帝金落印 */}
          <div
            className="display-serif gold-text animate-fade-in-up"
            style={{ fontSize: 22, textAlign: 'center', maxWidth: 640, opacity: 0.92 }}
          >
            「{decree}」
          </div>

          {/* 户部:苏醒辉光 + 开口 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, minHeight: 200 }}>
            <div
              className={lit ? 'animate-pulse-glow' : undefined}
              style={{
                width: 88,
                height: 88,
                borderRadius: '50%',
                border: `2px solid ${lit ? '#F0C66A' : '#2a2c38'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-serif)',
                fontSize: 30,
                color: lit ? '#F0C66A' : '#3a3c48',
                background: lit ? 'radial-gradient(circle, #F0C66A22 0%, transparent 70%)' : 'transparent',
                // 首字落地的一击:speaking 起轻微放大
                transform: beat === 'speaking' || beat === 'done' ? 'scale(1.06)' : 'scale(1)',
                transition: 'all 520ms cubic-bezier(0.16,1,0.3,1)',
              }}
            >
              户
            </div>
            <span style={{ fontSize: 11, letterSpacing: '0.18em', color: '#8F835F' }}>
              {beat === 'hush' ? '满朝屏息……' : '户 部'}
            </span>

            {/* 回奏(逐字) */}
            {(beat === 'speaking' || beat === 'done') && (
              <div style={{ maxWidth: 560, textAlign: 'center', minHeight: 28 }}>
                <span
                  className="display-serif"
                  style={{ fontSize: 18, color: '#F5E9C9', lineHeight: 1.7 }}
                >
                  {text}
                  {streaming && (
                    <span className="animate-breathe" style={{ color: '#F0C66A' }}>▍</span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* 首字延迟:真实测量,可感 + 诚实 */}
          {firstCharMs !== null && (
            <div
              className="animate-fade-in-up"
              style={{
                fontSize: 12,
                color: latencyOk ? '#3DD68C' : '#F0C66A',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              ⚡ 首字回奏 {(firstCharMs / 1000).toFixed(2)}s {latencyOk ? '· 稳在 1.5s 内' : '· 超 1.5s,待优化'}
            </div>
          )}

          {beat === 'done' && (
            <div className="animate-fade-in-up" style={{ textAlign: 'center', color: '#5a5340', fontSize: 12 }}>
              下一拍:满朝回奏 + 谏官出列(待迭代)
              <div style={{ marginTop: 14 }}>
                <button
                  onClick={restart}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 8,
                    border: '1px solid #ffffff22',
                    background: 'transparent',
                    color: '#8F835F',
                    cursor: 'pointer',
                  }}
                >
                  再来一道旨
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
