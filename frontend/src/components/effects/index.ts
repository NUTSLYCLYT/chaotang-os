/**
 * 朝堂 OS V2 · 动画原语库
 *
 * 5 个核心动画原语，对应 DEMO-BIBLE.md §四 定义的动画语言。
 * 所有原语：
 * - 基于 framer-motion
 * - 尊重 prefers-reduced-motion
 * - 只动 compositor-friendly 属性（transform / opacity / box-shadow / stroke-dashoffset）
 * - 不引入新依赖，仅使用已装的 framer-motion@^12.38.0
 *
 * 归属：m8-demo 分支（demo 冲刺期专用，详见 OWNERS.md）
 */

export { EnterStagger } from './enter-stagger';
export type { EnterStaggerProps } from './enter-stagger';

export { TypewriterText } from './typewriter-text';
export type { TypewriterTextProps } from './typewriter-text';

export { Pulse } from './pulse';
export type { PulseProps } from './pulse';

export { DrawLine } from './draw-line';
export type { DrawLineProps } from './draw-line';

export { NumberCounter } from './number-counter';
export type { NumberCounterProps } from './number-counter';

export { PrimeMinisterHub } from './prime-minister-hub';
export type { PrimeMinisterHubProps } from './prime-minister-hub';
