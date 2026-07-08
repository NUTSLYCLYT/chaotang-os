import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GOVERNANCE_BY_CODE } from './department-governance.ts';

describe('department governance contract', () => {
  it('keeps every department complete and limits boss-facing verdict candidates', () => {
    for (const [code, config] of Object.entries(GOVERNANCE_BY_CODE)) {
      assert.ok(config.memorials.length >= 6, `${code} memorial count`);
      assert.ok(config.bureaus.length >= 5, `${code} bureau count`);
      assert.ok(config.riskLine, `${code} risk line`);

      const verdictCount = config.memorials.filter((item) => item.triage === 'verdict').length;
      assert.ok(verdictCount <= 3, `${code} verdict count should be <= 3`);
      for (const memorial of config.memorials) {
        assert.ok(memorial.id, `${code} memorial id`);
        assert.ok(memorial.title, `${code} memorial title`);
        assert.ok(['handled', 'briefed', 'verdict'].includes(memorial.triage), `${code} memorial triage`);
      }
    }
  });
});
