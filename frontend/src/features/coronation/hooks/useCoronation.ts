'use client';

/**
 * useCoronation — 播放登基 demo 时间线,驱动真状态机。
 * 浏览器计时器播放"脚本化但状态为真"的场景(CORONATION_SPEC §2)。
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { coronationReducer, initialCoronationState } from '../lib/coronation-machine';
import { DEMO_SCENARIO, DEMO_SCENARIO_DURATION_MS } from '../lib/coronation-scenario';

export function useCoronation() {
  const [state, dispatch] = useReducer(coronationReducer, undefined, initialCoronationState);
  const timers = useRef<number[]>([]);
  const [playing, setPlaying] = useState(false);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const issueDecree = useCallback(
    (decree: string) => {
      clearTimers();
      dispatch({ type: 'RESET' });
      dispatch({ type: 'ISSUE_DECREE', decree });
      setPlaying(true);
      for (const step of DEMO_SCENARIO) {
        const id = window.setTimeout(() => dispatch(step.event), step.atMs);
        timers.current.push(id);
      }
      const endId = window.setTimeout(() => setPlaying(false), DEMO_SCENARIO_DURATION_MS + 200);
      timers.current.push(endId);
    },
    [clearTimers],
  );

  const reset = useCallback(() => {
    clearTimers();
    dispatch({ type: 'RESET' });
    setPlaying(false);
  }, [clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return { state, issueDecree, reset, playing };
}
