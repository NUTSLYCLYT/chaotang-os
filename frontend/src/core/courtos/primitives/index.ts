/**
 * 朝堂决策操作系统 · 通用原语库（2026-06-29）
 *
 * 部门无关的决策原语。任何部门/新决策系统 import 这里组装自己的决策流，不各写一套(铁律2)。
 * 见 CATALOG.md 的 11 原语全表与组装范式。
 */
export * from './stamp-pipeline'; // 盖章流水线(多方会审,worst-wins,不群聊)
export * from './credibility'; // 可信度加权(谁判断历来准→加权,达利欧护城河)
export * from './skill-match'; // 同义词匹配(磷酸铁锂=锂电,修关键词精度)
// 已有共享原语(原位复用,不搬):
export { classifyDecree } from '../decree-classifier'; // 下旨分流(开创=立项/处置=裁决)
export { projectMaturity } from '../project-maturity'; // 立项成熟度(真字段占比→可拍板)
