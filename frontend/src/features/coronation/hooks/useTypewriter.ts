'use client';

/**
 * useTypewriter — 大臣"开口说话"的逐字流式。
 * 关键:firstCharMs 是【真实测量】的首字延迟(从下旨那刻起),用来把 <1.5s 变得可感且诚实
 * (CORONATION_SPEC §1.3:首字回奏 <1.5s;§2:不假状态——延迟是真测的,不是写死的)。
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export function useTypewriter(charMs = 42) {
  const [text, setText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [firstCharMs, setFirstCharMs] = useState<number | null>(null);
  const timer = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  /** full=要说的话;decreeAtMs=下旨的时间戳(performance.now()),用于测真实首字延迟 */
  const stream = useCallback(
    (full: string, decreeAtMs: number) => {
      stop();
      setText('');
      setFirstCharMs(null);
      setStreaming(true);
      let i = 0;
      timer.current = window.setInterval(() => {
        i += 1;
        setText(full.slice(0, i));
        if (i === 1) setFirstCharMs(performance.now() - decreeAtMs);
        if (i >= full.length) {
          stop();
          setStreaming(false);
        }
      }, charMs);
    },
    [charMs, stop],
  );

  const reset = useCallback(() => {
    stop();
    setText('');
    setFirstCharMs(null);
    setStreaming(false);
  }, [stop]);

  useEffect(() => () => stop(), [stop]);

  return { text, streaming, firstCharMs, stream, reset };
}
