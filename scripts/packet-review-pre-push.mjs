#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {
  DEFAULT_ACTIVATION_SHA,
  LOCAL_FEEDBACK_STATUS,
  TARGET_REF,
  TARGET_REMOTE,
  parsePrePushUpdates,
  verifyPacketReviewPush,
} from './lib/packet-review-local-feedback.mjs';

const status = {
  implementation: LOCAL_FEEDBACK_STATUS,
  target_remote: TARGET_REMOTE,
  target_ref: TARGET_REF,
  activation_sha: DEFAULT_ACTIVATION_SHA,
  bootstrap_policy: 'exact_activation_commit_only',
  security_boundary: false,
  required_check_verified: false,
  bypassable_by: [
    'git push --no-verify',
    'local hook tampering',
    'alternate client or machine',
  ],
  note: 'Local workflow feedback only; external signature and protected required check are not configured.',
};

try {
  if (process.argv.includes('--status')) {
    console.log(JSON.stringify(status, null, 2));
    process.exit(0);
  }

  const remoteName = process.argv[2];
  if (!remoteName) throw new Error('pre-push remote name is required');
  const updates = parsePrePushUpdates(readFileSync(0, 'utf8'));
  const results = updates.map(update => verifyPacketReviewPush({
    cwd: process.cwd(),
    remoteName,
    remoteRef: update.remoteRef,
    remoteSha: update.remoteSha,
    localSha: update.localSha,
    activationSha: DEFAULT_ACTIVATION_SHA,
  }));
  const enforced = results.filter(result => result.status === LOCAL_FEEDBACK_STATUS);
  if (enforced.length > 0) {
    console.error(`D6 ${LOCAL_FEEDBACK_STATUS}: ${enforced.length} SHA/DAG-bound packet update(s) accepted.`);
    console.error('Not a security boundary; bypassable with --no-verify or local hook tampering.');
  }
} catch (error) {
  console.error(`PACKET REVIEW LOCAL FEEDBACK STOP: ${error.message}`);
  console.error('D6 status: LOCAL_FEEDBACK_ONLY; external required check is not configured.');
  process.exitCode = 1;
}
