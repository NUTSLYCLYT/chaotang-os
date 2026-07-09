import assert from 'node:assert/strict';
import test from 'node:test';

import { isConsequentialFinding } from './xingbu-legal-swarm-panel.tsx';

/**
 * 命门回归（2026-07-09 复审修复）：LLM 把违约金/独家/诉讼类条款判成 yellow 时，
 * 前端也必须强制显眼"需人工/法务确认"，不能完全交给模型 level 判断。
 */

test('违约金条款：即便 level=yellow 也强制需人工确认', () => {
  assert.equal(isConsequentialFinding({ level: 'yellow', title: '违约金条款约定不明' }), true);
});

test('独家/诉讼/仲裁关键词命中 impact 字段也算', () => {
  assert.equal(isConsequentialFinding({ level: 'green', title: '条款X', impact: '涉及独家经销安排' }), true);
  assert.equal(isConsequentialFinding({ level: 'green', title: '争议解决', impact: '约定仲裁管辖' }), true);
});

test('无高风险类别关键词 + level 非 red → 不强制', () => {
  assert.equal(isConsequentialFinding({ level: 'yellow', title: '验收标准偏松' }), false);
});
