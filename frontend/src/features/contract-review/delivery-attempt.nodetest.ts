import assert from 'node:assert/strict';
import test from 'node:test';

import { DeliveryAttemptRegistry } from './delivery-attempt';

test('reuses one idempotency key until delivery success is confirmed', () => {
  let sequence = 0;
  const attempts = new DeliveryAttemptRegistry(() => `key-${++sequence}`);
  const identity = {
    taskId: 'task-1',
    finalMemorialId: 'final-1',
    finalMemorialVersion: 1,
    deliveryFormulaVersion: 'w06-v1',
  };

  assert.equal(attempts.keyFor(identity), 'key-1');
  assert.equal(attempts.keyFor(identity), 'key-1');

  attempts.confirm(identity);
  assert.equal(attempts.keyFor(identity), 'key-2');
});
