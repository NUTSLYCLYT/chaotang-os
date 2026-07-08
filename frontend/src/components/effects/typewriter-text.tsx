/**
 * 朝堂 OS V2 · 动画原语 · TypewriterText
 *
 * 文字打字机效果。用于：
 * - 丞相研判的文字 stream
 * - 报告中心段落浮现
 * - 剧本口播字幕
 *
 * 性能：用 useState 计时器，每字间隔 30ms 默认。
 * 无障碍：尊重 prefers-reduced-motion（直接一次性显示）。
 *
 * 用法：
 *   <TypewriterText text="丞相研判：识别为分析任务..." />
 *   <TypewriterText text="..." startDelayMs={500} onDone={() => next()} />
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

export interface TypewriterTextProps {
  text: string;
  /** 每字间隔 ms（默认 30，中文建议 40-50） */
  charDelayMs?: number;
  /** 开始前的延迟 ms（默认 0） */
  startDelayMs?: number;
  /** 写完时的回调 */
  onDone?: () => void;
  /** 是否显示光标（默认 true） */
  showCaret?: boolean;
  /** 额外 className */
  className?: string;
}

export function TypewriterText({
  text,
  charDelayMs = 30,
  startDelayMs = 0,
  onDone,
  showCaret = true,
  className,
}: TypewriterTextProps) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState('');
  const [done, setDone] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (reduce) {
      // 无障碍：一次性全显示
      setShown(text);
      setDone(true);
      onDoneRef.current?.();
      return;
    }

    setShown('');
    setDone(false);
    let cancelled = false;
    let idx = 0;

    const start = setTimeout(() => {
      const tick = () => {
        if (cancelled) return;
        idx += 1;
        if (idx > text.length) {
          setDone(true);
          onDoneRef.current?.();
          return;
        }
        setShown(text.slice(0, idx));
        setTimeout(tick, charDelayMs);
      };
      tick();
    }, startDelayMs);

    return () => {
      cancelled = true;
      clearTimeout(start);
    };
  }, [text, charDelayMs, startDelayMs, reduce]);

  return (
    <span className={className}>
      {shown}
      {showCaret && !done && !reduce && (
        <span
          className="inline-block w-[1px] h-[1em] align-middle ml-[1px] animate-pulse"
          style={{ background: 'currentColor' }}
          aria-hidden
        />
      )}
    </span>
  );
}
