import test from 'node:test';
import assert from 'node:assert/strict';
import {rolloutAlerts} from './rollout-watch.mjs';

const base={stage:'observe',status:'ROLLOUT',external:'VERIFIED',anchorBacklog:0,lastTransition:null,metrics:{observation:{falsePositiveRate:0,maxOverheadSeconds:1}},releaseStreak:0,acceptance:{passed:0,required:12}};

test('watch classifies Observe backlog as warning and enforced anchor lag as P0',()=>{
  assert.deepEqual(rolloutAlerts({...base,anchorBacklog:2},{eligible:true}),[{severity:'P1',code:'ANCHOR_BACKLOG',count:2}]);
  const alerts=rolloutAlerts({...base,stage:'enforce_paths',external:'EXTERNAL_REQUIRED',anchorBacklog:3},{eligible:true});
  assert.ok(alerts.some(alert=>alert.code==='ANCHOR_NOT_VERIFIED'&&alert.severity==='P0'));
  assert.ok(alerts.some(alert=>alert.code==='ANCHOR_BACKLOG'&&alert.severity==='P0'));
});

test('watch reports rollback incidents and fails mandatory invariant losses',()=>{
  const alerts=rolloutAlerts({...base,stage:'mandatory',status:'ENFORCED',lastTransition:{event:'rollout.auto_rollback',reason:'incident'},releaseStreak:19,acceptance:{passed:11,required:12}},{eligible:false});
  for(const code of ['AUTOMATIC_ROLLBACK','RELEASE_STREAK_LOST','ACCEPTANCE_SET_LOST','ENFORCED_ELIGIBILITY_LOST'])assert.ok(alerts.some(alert=>alert.code===code));
  assert.ok(alerts.filter(alert=>alert.severity==='P0').length>=3);
});
