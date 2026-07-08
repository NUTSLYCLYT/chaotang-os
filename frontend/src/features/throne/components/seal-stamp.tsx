'use client';

/**
 * 朱砂大印 · Seal Stamp overlay
 *
 * 发令瞬间的仪式感覆盖层。从天而降、旋转、砸下、水波、淡出。
 * 总耗时约 1.6 秒。onComplete 触发路由。
 */

import { useEffect, useState } from 'react';

export interface SealStampProps {
  open: boolean;
  /** 大印上刻的字 */
  inscription?: string;
  onComplete: () => void;
}

export function SealStamp({ open, inscription = '御旨', onComplete }: SealStampProps) {
  const [phase, setPhase] = useState<'idle' | 'falling' | 'landed' | 'fading'>('idle');

  useEffect(() => {
    if (!open) {
      setPhase('idle');
      return;
    }
    setPhase('falling');
    const t1 = setTimeout(() => setPhase('landed'), 650);
    const t2 = setTimeout(() => setPhase('fading'), 1200);
    const t3 = setTimeout(() => onComplete(), 1800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [open, onComplete]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      aria-hidden
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background: phase === 'fading' ? 'rgba(4,6,14,0)' : 'rgba(4,6,14,0.82)',
        backdropFilter: phase === 'fading' ? 'blur(0)' : 'blur(6px)',
        transition: 'all 600ms ease-out',
      }}
    >
      {/* Concentric ripple on impact */}
      {phase === 'landed' && (
        <>
          <div
            className="absolute h-56 w-56 rounded-full"
            style={{
              border: '2px solid rgba(220, 38, 38, 0.6)',
              animation: 'ripple 900ms ease-out forwards',
            }}
          />
          <div
            className="absolute h-56 w-56 rounded-full"
            style={{
              border: '1px solid rgba(220, 38, 38, 0.4)',
              animation: 'ripple 900ms ease-out 180ms forwards',
            }}
          />
        </>
      )}

      {/* Seal */}
      <div
        className="relative flex items-center justify-center"
        style={{
          width: 180,
          height: 180,
          transform:
            phase === 'falling'
              ? 'translateY(-180px) scale(1.4) rotate(-18deg)'
              : phase === 'landed'
              ? 'translateY(0) scale(1) rotate(0deg)'
              : 'translateY(0) scale(1) rotate(0deg)',
          opacity: phase === 'fading' ? 0 : 1,
          transition:
            phase === 'falling'
              ? 'transform 650ms cubic-bezier(.55,.085,.68,.53)'
              : phase === 'landed'
              ? 'transform 220ms cubic-bezier(.34,1.56,.64,1)'
              : 'opacity 600ms ease-out',
        }}
      >
        {/* Outer glow */}
        <div
          className="absolute inset-0 rounded-md blur-xl"
          style={{
            background: 'radial-gradient(circle, rgba(220,38,38,0.6), transparent 70%)',
          }}
        />
        {/* Stamp body — carved red stone */}
        <div
          className="relative flex h-full w-full items-center justify-center rounded-md"
          style={{
            background:
              'linear-gradient(135deg, #C1272D 0%, #8B1A1F 50%, #5E0F13 100%)',
            border: '6px double #FBE7BB',
            boxShadow:
              '0 20px 40px rgba(0,0,0,0.6), inset 0 0 20px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,220,150,0.3)',
          }}
        >
          {/* Inscription */}
          <div
            className="display-serif text-[48px] font-black leading-none"
            style={{
              color: '#FBE7BB',
              textShadow:
                '0 2px 0 rgba(0,0,0,0.6), 0 -1px 0 rgba(255,200,120,0.4)',
              letterSpacing: inscription.length > 2 ? '-2px' : '0',
            }}
          >
            {inscription}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes ripple {
          0% {
            transform: scale(0.4);
            opacity: 0.9;
          }
          100% {
            transform: scale(3.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
