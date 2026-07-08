// H2 回归断言：rowToSourceTask 从 toBackendTask 驼峰行正确映射 command 非空
// 移至共享目录，hubu/bingbu 路由共用此工具函数。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowToSourceTask } from './row-to-source-task.ts';

// toBackendTask 实际返回的驼峰字段（验证 H2 修复：raw_command → rawCommand）
const backendTaskRow = {
  id: 'task_abc',
  title: '采购审批',
  rawCommand: '申请储能采购预算 100万 风险高',
  status: 'submitted',
  updatedAt: '2026-06-28T10:00:00Z',
};

test('rowToSourceTask: rawCommand 正确映射为 command，非空', () => {
  const task = rowToSourceTask(backendTaskRow);
  assert.equal(task.id, 'task_abc');
  assert.equal(task.command, '申请储能采购预算 100万 风险高', 'rawCommand 应映射为 command（H2 核心）');
  assert.ok(task.command.length > 0, 'command 必须非空');
  assert.equal(task.title, '采购审批');
  assert.equal(task.status, 'submitted');
  assert.equal(task.updatedAt, '2026-06-28T10:00:00Z');
});

test('rowToSourceTask: 缺字段安全降级为空串', () => {
  const task = rowToSourceTask({ id: 'x' });
  assert.equal(task.id, 'x');
  assert.equal(task.command, '', '缺 rawCommand 时 command 为空串');
  assert.equal(task.title, '');
  assert.equal(task.status, '');
  assert.equal(task.updatedAt, '');
});

test('rowToSourceTask: 不读 raw_command (snake_case)，旧字段已废弃', () => {
  // 如果某行只有 raw_command(snake) 而没有 rawCommand(camel)，command 应为空
  // 这测试确保我们不再意外读旧字段
  const task = rowToSourceTask({ id: 'y', raw_command: '旧字段', title: 't' });
  assert.equal(task.command, '', '不读 raw_command snake_case 字段');
});

// —— MED-2 提取层覆盖：result_json.sourceLabel 透传(去漂白管道的入口)——
test('rowToSourceTask: 透传 result.sourceLabel 顶层字符串', () => {
  const task = rowToSourceTask({ id: 'z', rawCommand: '客户报价', result: { sourceLabel: 'FALLBACK' } });
  assert.equal(task.sourceLabel, 'FALLBACK', 'result.sourceLabel 应原样透传');
});

test('rowToSourceTask: result 缺失/非对象/sourceLabel 非字符串 → 不带 sourceLabel', () => {
  assert.equal('sourceLabel' in rowToSourceTask({ id: 'a', result: null }), false, 'result=null 不带');
  assert.equal('sourceLabel' in rowToSourceTask({ id: 'b' }), false, '无 result 不带');
  assert.equal('sourceLabel' in rowToSourceTask({ id: 'c', result: { sourceLabel: 123 } }), false, '非字符串不带');
  assert.equal('sourceLabel' in rowToSourceTask({ id: 'd', result: 'oops' }), false, 'result 非对象不带');
});
