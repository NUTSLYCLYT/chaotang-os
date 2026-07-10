import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toBackendApiPath } from './backend-api';

describe('backend API transport aliases', () => {
  it('keeps court chaotang compatibility inside the transport layer', () => {
    assert.equal(
      toBackendApiPath('/api/court/chaotang/tasks/task-1'),
      '/api/chaotang/tasks/task-1',
    );
    assert.equal(toBackendApiPath('/api/court/chaotang?limit=5'), '/api/chaotang?limit=5');
  });

  it('keeps court shangshufang compatibility inside the transport layer', () => {
    assert.equal(
      toBackendApiPath('/api/court/shangshufang/tasks/task-1/status'),
      '/api/shangshufang/tasks/task-1/status',
    );
    assert.equal(toBackendApiPath('/api/court/shangshufang'), '/api/shangshufang');
  });

  it('maps legacy department overview aliases to backend-owned routes', () => {
    assert.equal(toBackendApiPath('/api/court/hubu/overview'), '/api/chaotang/dept/finance/overview');
    assert.equal(toBackendApiPath('/api/court/bingbu/overview'), '/api/chaotang/dept/ops/overview');
    assert.equal(toBackendApiPath('/api/court/libu/promo'), '/api/chaotang/dept/market/overview');
  });

  it('maps legacy service aliases without creating a frontend BFF contract', () => {
    assert.equal(toBackendApiPath('/api/court/legal/overview'), '/api/legal/overview');
    assert.equal(toBackendApiPath('/api/court/swarm/roster'), '/api/swarm/roster');
    assert.equal(toBackendApiPath('/api/court/court-session/latest'), '/api/court-session/latest');
  });
});
