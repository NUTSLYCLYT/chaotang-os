import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

export const LOCAL_FEEDBACK_STATUS = 'LOCAL_FEEDBACK_ONLY';
export const TARGET_REMOTE = 'origin';
export const TARGET_REF = 'refs/heads/feature-chaotang-ext';
export const DEFAULT_ACTIVATION_SHA = 'd8d8a6ae23d013bede6b1db649b06eb5ed38ea1f';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const ZERO_SHA = '0'.repeat(40);
const TERMINAL_VERDICTS = new Set([
  'PACKET_REVIEW_GO',
  'PACKET_REVIEW_NO_GO',
  'INSUFFICIENT_EVIDENCE',
]);

function git(cwd, args) {
  return execFileSync('git', args, {cwd, encoding: 'utf8'}).trim();
}

function assertExactCommit(cwd, value, label) {
  if (!SHA_PATTERN.test(value) || value === ZERO_SHA) {
    throw new Error(`${label} must be an exact non-zero 40-character SHA`);
  }
  let resolved;
  try {
    resolved = git(cwd, ['rev-parse', '--verify', `${value}^{commit}`]);
  } catch {
    throw new Error(`${label} is not an available commit object`);
  }
  if (resolved !== value) throw new Error(`${label} did not resolve exactly`);
  return resolved;
}

function isAncestor(cwd, ancestor, descendant) {
  return spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
    cwd,
    stdio: 'ignore',
  }).status === 0;
}

function parents(cwd, commit) {
  const value = git(cwd, ['show', '-s', '--format=%P', commit]);
  return value ? value.split(' ') : [];
}

function changedPaths(cwd, from, to, diffFilter = undefined) {
  const args = ['diff', '--name-only', '-z'];
  if (diffFilter) args.push(`--diff-filter=${diffFilter}`);
  args.push(from, to);
  const value = execFileSync('git', args, {cwd, encoding: 'utf8'});
  return value.split('\0').filter(Boolean);
}

function readObjectPath(cwd, commit, path) {
  try {
    return execFileSync('git', ['show', `${commit}:${path}`], {cwd, encoding: 'utf8'});
  } catch {
    throw new Error(`candidate object is missing ${path}`);
  }
}

function assertApprovalShape(approval, expected) {
  const expectedKeys = [
    'change_id',
    'packet_id',
    'predecessor_integration_sha',
    'report_path',
    'report_sha256',
    'review_version',
    'reviewed_head_sha',
    'schema_version',
    'status',
    'verdict',
  ];
  const actualKeys = Object.keys(approval).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error('approval envelope fields do not match schema v1');
  }
  if (approval.schema_version !== 1) throw new Error('approval schema_version must be 1');
  if (approval.status !== LOCAL_FEEDBACK_STATUS) throw new Error(`approval status must be ${LOCAL_FEEDBACK_STATUS}`);
  if (approval.review_version !== expected.reviewVersion) throw new Error('approval review_version does not match its path');
  if (!/^P\d+(?:\.\d+)?$/.test(approval.packet_id)) throw new Error('approval packet_id is invalid');
  if (approval.change_id !== expected.changeId) throw new Error('approval change_id does not match its change directory');
  if (approval.predecessor_integration_sha !== expected.predecessor) throw new Error('approval predecessor does not match remote SHA');
  if (approval.reviewed_head_sha !== expected.reviewedHead) throw new Error('approval reviewed_head_sha does not match review parent');
  if (approval.report_path !== expected.reportPath) throw new Error('approval report_path does not match its versioned report');
  if (!/^[0-9a-f]{64}$/.test(approval.report_sha256)) throw new Error('approval report_sha256 must be exact lowercase SHA-256');
  if (approval.verdict !== 'PACKET_REVIEW_GO') throw new Error('approval verdict must be PACKET_REVIEW_GO');
}

function assertTerminalVerdict(report) {
  const lines = report.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const terminalLines = lines.filter(line => TERMINAL_VERDICTS.has(line));
  if (terminalLines.length !== 1 || terminalLines[0] !== 'PACKET_REVIEW_GO' || lines.at(-1) !== 'PACKET_REVIEW_GO') {
    throw new Error('review report must contain a single terminal PACKET_REVIEW_GO as its final non-empty line');
  }
}

export function parsePrePushUpdates(input) {
  const updates = [];
  for (const rawLine of input.split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    const fields = rawLine.trim().split(/\s+/);
    if (fields.length !== 4) throw new Error('malformed pre-push update row');
    const [localRef, localSha, remoteRef, remoteSha] = fields;
    if ((!SHA_PATTERN.test(localSha) && localSha !== ZERO_SHA) || (!SHA_PATTERN.test(remoteSha) && remoteSha !== ZERO_SHA)) {
      throw new Error('malformed pre-push SHA');
    }
    updates.push({localRef, localSha, remoteRef, remoteSha});
  }
  return updates;
}

export function verifyPacketReviewPush({
  cwd = process.cwd(),
  remoteName,
  remoteRef,
  remoteSha,
  localSha,
  activationSha,
}) {
  if (remoteName !== TARGET_REMOTE || remoteRef !== TARGET_REF) {
    return {allowed: true, status: 'not_target'};
  }

  const predecessor = assertExactCommit(cwd, remoteSha, 'remote SHA');
  const candidate = assertExactCommit(cwd, localSha, 'local SHA');
  const activation = assertExactCommit(cwd, activationSha, 'activation SHA');

  if (!isAncestor(cwd, activation, predecessor)) {
    if (isAncestor(cwd, predecessor, activation)) {
      if (candidate !== activation) {
        throw new Error('pre-activation target update must end at the exact activation commit');
      }
      return {allowed: true, status: 'pre_activation'};
    }
    throw new Error('activation history is divergent from the target update');
  }
  if (!isAncestor(cwd, predecessor, candidate)) throw new Error('target update must be fast-forward');

  const mergeParents = parents(cwd, candidate);
  if (mergeParents.length !== 2 || mergeParents[0] !== predecessor) {
    throw new Error('candidate must be one no-ff merge whose first parent is the remote predecessor');
  }
  const reviewCommit = mergeParents[1];
  const reviewParents = parents(cwd, reviewCommit);
  if (reviewParents.length !== 1) throw new Error('review commit must have exactly one implementation parent');
  const reviewedHead = reviewParents[0];
  if (!isAncestor(cwd, predecessor, reviewedHead)) throw new Error('reviewed implementation must descend from remote predecessor');

  const mergeTree = git(cwd, ['rev-parse', `${candidate}^{tree}`]);
  const reviewTree = git(cwd, ['rev-parse', `${reviewCommit}^{tree}`]);
  if (mergeTree !== reviewTree) throw new Error('merge tree differs from the independently reviewed tree');

  const approvalPattern = /^\.harness\/changes\/([a-z0-9][a-z0-9-]*)\/packet_review\/approval-v([1-9][0-9]*)\.json$/;
  const approvalPaths = changedPaths(cwd, predecessor, candidate, 'A').filter(path => approvalPattern.test(path));
  if (approvalPaths.length !== 1) throw new Error('candidate must add exactly one versioned packet approval envelope');
  const approvalPath = approvalPaths[0];
  const match = approvalPath.match(approvalPattern);
  const changeId = match[1];
  const reviewVersion = Number(match[2]);
  const reportPath = `.harness/changes/${changeId}/packet_review/review-v${reviewVersion}.md`;
  const summaryPath = `.harness/changes/${changeId}/summary.md`;

  const rootChangeSummaries = changedPaths(cwd, predecessor, candidate, 'A').filter(path =>
    /^\.harness\/changes\/[a-z0-9][a-z0-9-]*\/summary\.md$/.test(path),
  );
  if (rootChangeSummaries.length !== 1 || rootChangeSummaries[0] !== summaryPath) {
    throw new Error('candidate must introduce exactly one root change matching the approval change_id');
  }

  const reviewChanges = changedPaths(cwd, reviewedHead, reviewCommit).sort();
  const expectedReviewChanges = [approvalPath, reportPath].sort();
  if (JSON.stringify(reviewChanges) !== JSON.stringify(expectedReviewChanges)) {
    throw new Error('review-only commit may add only its versioned approval envelope and report');
  }
  const addedReviewPaths = changedPaths(cwd, reviewedHead, reviewCommit, 'A').sort();
  if (JSON.stringify(addedReviewPaths) !== JSON.stringify(expectedReviewChanges)) {
    throw new Error('review report and approval envelope must be newly added, not reused');
  }

  let approval;
  try {
    approval = JSON.parse(readObjectPath(cwd, reviewCommit, approvalPath));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('approval envelope is not valid JSON');
    throw error;
  }
  assertApprovalShape(approval, {
    reviewVersion,
    changeId,
    predecessor,
    reviewedHead,
    reportPath,
  });

  const report = readObjectPath(cwd, reviewCommit, reportPath);
  const reportDigest = createHash('sha256').update(report).digest('hex');
  if (reportDigest !== approval.report_sha256) throw new Error('approval report_sha256 does not match report bytes');
  assertTerminalVerdict(report);

  const summary = readObjectPath(cwd, reviewCommit, summaryPath);
  const packetLines = summary.split(/\r?\n/).map(line => line.trim()).filter(line => line.startsWith('Packet ID:'));
  if (packetLines.length !== 1 || packetLines[0] !== `Packet ID: ${approval.packet_id}`) {
    throw new Error('root change summary must contain one exact Packet ID matching the approval');
  }

  return {
    allowed: true,
    status: LOCAL_FEEDBACK_STATUS,
    packetId: approval.packet_id,
    changeId,
    reviewedHead,
    reviewCommit,
    candidate,
  };
}
