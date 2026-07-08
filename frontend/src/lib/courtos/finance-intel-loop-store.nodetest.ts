import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';

test('finance intel loop persists SEC URLs through memorial, return report, and archive', async () => {
  mkdirSync('dev/tmp', { recursive: true });
  rmSync('dev/tmp/finance-intel-loop-store-test.db', { force: true });
  process.env.TURSO_DB_URL = 'file:./dev/tmp/finance-intel-loop-store-test.db';

  const { ensurePrimaryDbReady, upsertPrimaryTask } = await import('../db/primary-store.ts');
  const { collectFinancialSources } = await import('../jinyiwei/financial-source-collector.ts');
  const { sourceUrls } = await import('../jinyiwei/source-gates.ts');
  const {
    createArchiveFromTask,
    createCourtIssue,
    createDecisionBrief,
    createDepartmentMemorial,
    createExecutionRun,
    createImperialInstruction,
    getFinancialSourcesByTask,
    rebindIssueTask,
    updateExecutionReturnReport,
    upsertIntelSignalFromFinancialCollection,
  } = await import('./finance-intel-loop-store.ts');

  const issue = await createCourtIssue({
    userId: 'node-test-user',
    question: 'Evaluate AAPL valuation using SEC filings.',
    intent: 'finance_valuation',
    market: 'US',
    ticker: 'AAPL',
    at: '2026-06-28T00:00:00.000Z',
  });
  const collection = await collectFinancialSources({
    ticker: 'AAPL',
    market: 'US',
    issueId: issue.id,
    taskId: issue.taskId,
    preferredSources: ['sec_edgar'],
  });
  await upsertIntelSignalFromFinancialCollection({ collection, issueId: issue.id, taskId: issue.taskId });

  const taskId = 'task_intel_finance_store_test';
  const routeId = 'intel_route_finance_store_test';
  const evidenceBoundRun = {
    entry_swarm: 'finance',
    source_label: 'LIVE',
    intelligence_pack_id: `jinyiwei_finance_${collection.signalId}`,
    intelligence_pack: {
      sourceLabel: 'LIVE',
      ticker: 'AAPL',
      sourceUrls: sourceUrls(collection.sources),
    },
    evidence_refs: [`intel_signal:${collection.signalId}`],
    missing_evidence: [],
    forbidden_outputs: ['real_trade_order', 'payment_instruction'],
  };

  await upsertPrimaryTask({
    taskId,
    command: 'Hu Bu finance swarm: evaluate AAPL valuation using SEC URLs.',
    title: 'AAPL Hu Bu valuation smoke',
    mode: 'live',
    status: 'running',
    result: {
      source: 'jinyiwei_intel_dispatch',
      evidenceBoundRun,
      jiqunSwarm: {
        sessionId: '20260628_120000_finance_store_test',
        entrySwarm: 'finance',
        sourceLabel: 'LIVE_SWARM',
      },
    },
    at: '2026-06-28T00:01:00.000Z',
  });
  await rebindIssueTask(issue.id, taskId, '2026-06-28T00:01:01.000Z');

  const db = await ensurePrimaryDbReady();
  await db.execute({
    sql: `
      INSERT INTO intel_signal_routes (
        id, signal_id, task_id, user_id, target_agents_json, entry_swarm,
        source_label, status, note, session_id, trace_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      routeId,
      collection.signalId,
      taskId,
      'node-test-user',
      JSON.stringify(['hu_bu']),
      'finance',
      'LIVE_SWARM',
      'running',
      'node test route',
      '20260628_120000_finance_store_test',
      '20260628_120000_finance_store_test',
      '2026-06-28T00:01:02.000Z',
      '2026-06-28T00:01:02.000Z',
    ],
  });
  await db.execute({
    sql: `
      INSERT INTO intel_evidence_packs (
        id, signal_id, task_id, route_id, source_label, pack_json, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      `pack_${routeId}`,
      collection.signalId,
      taskId,
      routeId,
      'LIVE',
      JSON.stringify(evidenceBoundRun),
      '2026-06-28T00:01:02.000Z',
    ],
  });

  const taskSources = await getFinancialSourcesByTask(taskId);
  assert.deepEqual(sourceUrls(taskSources), [
    'https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json',
    'https://data.sec.gov/submissions/CIK0000320193.json',
  ]);

  const memorial = await createDepartmentMemorial({
    taskId,
    departmentId: 'hu_bu',
    sourceLabel: 'LIVE_SWARM',
    memorial: {
      department: 'hu_bu',
      type: 'department_memorial',
      sourceUrls: sourceUrls(taskSources),
      financialSources: taskSources,
      nonAdviceDisclaimer: true,
      recommendedActions: ['create_watchlist'],
    },
    at: '2026-06-28T00:02:00.000Z',
  });
  assert.deepEqual(memorial.memorial.sourceUrls, sourceUrls(collection.sources));

  const brief = await createDecisionBrief({
    taskId,
    issueId: issue.id,
    evidencePackId: `pack_${routeId}`,
    brief: {
      type: 'decision_brief',
      taskId,
      issueId: issue.id,
      departmentMemorials: [memorial.memorial],
      decisionOptions: ['issue_decree', 'request_more_evidence', 'request_review', 'reject'],
      authorizedDecisionRequired: true,
    },
    at: '2026-06-28T00:03:00.000Z',
  });
  const instruction = await createImperialInstruction({
    brief,
    instructionType: 'decree',
    decisionActor: {
      userId: 'node-test-user',
      role: 'owner',
      authorityLevel: 'approver',
    },
    instruction: {
      decision: 'issue_decree',
      reason: 'Create internal watchlist only.',
      executionType: 'create_watchlist',
      noRealTradeAuthorized: true,
    },
    at: '2026-06-28T00:04:00.000Z',
  });
  const execution = await createExecutionRun({
    instruction,
    executor: 'finance_intel_loop_executor',
    status: 'execution_running',
    result: {
      done: true,
      executionType: 'create_watchlist',
      noRealTradeAuthorized: true,
    },
    at: '2026-06-28T00:05:00.000Z',
  });
  await updateExecutionReturnReport({
    instructionId: instruction.id,
    executionRunId: execution.id,
    taskId,
    result: {
      done: true,
      summary: 'AAPL watchlist created and bound to SEC EDGAR URLs.',
      returnedAt: '2026-06-28T00:06:00.000Z',
    },
    at: '2026-06-28T00:06:00.000Z',
  });

  const archived = await createArchiveFromTask({
    taskId,
    outcome: 'watchlist_created',
    lessons: ['SEC URLs are mandatory for LIVE Hu Bu finance loops.'],
    at: '2026-06-28T00:07:00.000Z',
  });
  assert.deepEqual(archived.archive.sourceUrls, sourceUrls(collection.sources));
  assert.equal((archived.archive.issue as { ticker?: string }).ticker, 'AAPL');
  assert.equal((archived.archive.memorials as unknown[]).length, 1);
  assert.equal((archived.archive.executionRuns as unknown[]).length, 1);
  assert.equal((archived.archive.returnReports as unknown[]).length, 1);
  assert.equal(archived.archive.outcome, 'watchlist_created');
});

// ── CRITICAL 修复回归(2026-07-03 会审)：createCourtIssue 不同用户同问题文本不再撞 task_id ──
test('createCourtIssue: 两个不同用户问一模一样的问题，得到不同的 task_id(禁 stableTaskId 文本碰撞)', async () => {
  mkdirSync('dev/tmp', { recursive: true });
  rmSync('dev/tmp/finance-intel-loop-store-taskid-test.db', { force: true });
  process.env.TURSO_DB_URL = 'file:./dev/tmp/finance-intel-loop-store-taskid-test.db';

  const { createCourtIssue } = await import('./finance-intel-loop-store.ts');

  const sameQuestion = '分析低温电池市场';
  const issueA = await createCourtIssue({
    userId: 'user-A-critical-fix',
    question: sameQuestion,
    intent: 'finance_valuation',
    at: '2026-07-03T00:00:00.000Z',
  });
  const issueB = await createCourtIssue({
    userId: 'user-B-critical-fix',
    question: sameQuestion,
    intent: 'finance_valuation',
    at: '2026-07-03T00:00:01.000Z',
  });

  assert.notEqual(
    issueA.taskId,
    issueB.taskId,
    `两个不同用户问同一句话，task_id 绝不能相同(会导致下游数据混同+归档跨用户泄露)，实际都是 ${issueA.taskId}`,
  );
});

// ── 会审防线回归(2026-07-03)：createArchiveFromTask 拒绝为混同多个 user_id 的 task_id 归档 ──
test('createArchiveFromTask: task_id 下 court_issues 混了多个 user_id 时拒绝归档(mixed-owner 防线)', async () => {
  mkdirSync('dev/tmp', { recursive: true });
  rmSync('dev/tmp/finance-intel-loop-store-mixedowner-test.db', { force: true });
  process.env.TURSO_DB_URL = 'file:./dev/tmp/finance-intel-loop-store-mixedowner-test.db';

  const { ensurePrimaryDbReady, upsertPrimaryTask } = await import('../db/primary-store.ts');
  const { createArchiveFromTask } = await import('./finance-intel-loop-store.ts');

  const collidedTaskId = 'task_mixed_owner_test';
  await upsertPrimaryTask({
    taskId: collidedTaskId,
    command: '模拟碰撞任务',
    status: 'submitted',
    at: '2026-07-03T00:00:00.000Z',
  });

  const db = await ensurePrimaryDbReady();
  // 手工模拟"碰撞已经发生"的场景：同一 task_id 下插入两条不同 user_id 的 court_issues。
  for (const [issueId, userId] of [
    ['issue_mixed_a', 'user-A-mixed'],
    ['issue_mixed_b', 'user-B-mixed'],
  ]) {
    await db.execute({
      sql: `
        INSERT INTO court_issues (id, task_id, user_id, title, question, intent, status, created_at, updated_at)
        VALUES (?, ?, ?, 'title', 'question', 'finance_valuation', 'issue_created', ?, ?)
      `,
      args: [issueId, collidedTaskId, userId, '2026-07-03T00:00:00.000Z', '2026-07-03T00:00:00.000Z'],
    });
  }

  await assert.rejects(
    () => createArchiveFromTask({ taskId: collidedTaskId, outcome: 'x', lessons: [] }),
    /archive_owner_conflict/,
    'task_id 下混了多个 user_id 时必须拒绝归档，不得静默挑一个当 owner',
  );
});

// ── HIGH 修复回归(2026-07-03 会审)：getCourtIssueOwnerUserId 是 archive/from-task/route.ts
// IDOR 修复的地基——route 本身依赖 next/headers 会话上下文，无法在 node:test 里直接跑，
// 故测这个纯查询函数的正确性，证明路由的归属校验有可验证的数据基础。
test('getCourtIssueOwnerUserId: 正确返回任务归属人，无对应 issue 时返回 null(供路由拒绝)', async () => {
  mkdirSync('dev/tmp', { recursive: true });
  rmSync('dev/tmp/finance-intel-loop-store-owner-test.db', { force: true });
  process.env.TURSO_DB_URL = 'file:./dev/tmp/finance-intel-loop-store-owner-test.db';

  const { createCourtIssue, getCourtIssueOwnerUserId } = await import('./finance-intel-loop-store.ts');

  const issue = await createCourtIssue({
    userId: 'owner-check-user',
    question: '这是谁的任务',
    intent: 'finance_valuation',
    at: '2026-07-03T00:00:00.000Z',
  });

  assert.equal(
    await getCourtIssueOwnerUserId(issue.taskId),
    'owner-check-user',
    '应正确返回创建该任务的真实 user_id',
  );
  assert.equal(
    await getCourtIssueOwnerUserId('task_never_existed'),
    null,
    '不存在的 task_id 应返回 null(路由据此拒绝而非误放行)',
  );
});

test('decision side branches surface needs_evidence and rejected as case stages', async () => {
  mkdirSync('dev/tmp', { recursive: true });
  rmSync('dev/tmp/finance-intel-loop-store-branch-stage-test.db', { force: true });
  process.env.TURSO_DB_URL = 'file:./dev/tmp/finance-intel-loop-store-branch-stage-test.db';

  const {
    createCourtIssue,
    createDecisionBrief,
    createDepartmentMemorial,
    createImperialInstruction,
    getFinanceIntelLoopCase,
    updateDecisionBriefStatus,
    updateImperialInstructionStatus,
    updateIssueStatus,
  } = await import('./finance-intel-loop-store.ts');

  const issue = await createCourtIssue({
    userId: 'branch-stage-user',
    question: 'Evaluate AAPL valuation using SEC filings.',
    intent: 'finance_valuation',
    market: 'US',
    ticker: 'AAPL',
    at: '2026-07-06T00:00:00.000Z',
  });
  const memorial = await createDepartmentMemorial({
    taskId: issue.taskId,
    departmentId: 'hu_bu',
    sourceLabel: 'LIVE_SWARM',
    memorial: { department: 'hu_bu', missingEvidence: [] },
    at: '2026-07-06T00:01:00.000Z',
  });
  const brief = await createDecisionBrief({
    taskId: issue.taskId,
    issueId: issue.id,
    brief: {
      type: 'decision_brief',
      taskId: issue.taskId,
      issueId: issue.id,
      departmentMemorials: [memorial.memorial],
      decisionOptions: ['issue_decree', 'request_more_evidence', 'request_review', 'reject'],
    },
    at: '2026-07-06T00:02:00.000Z',
  });
  const evidenceOrder = await createImperialInstruction({
    brief,
    instructionType: 'evidence_order',
    decisionActor: { userId: 'branch-stage-user', role: 'owner', authorityLevel: 'owner' },
    instruction: { decision: 'request_more_evidence', reason: 'Need one more source.' },
    at: '2026-07-06T00:03:00.000Z',
  });
  await updateIssueStatus(issue.id, 'needs_evidence', '2026-07-06T00:04:00.000Z');
  await updateDecisionBriefStatus(brief.id, 'needs_evidence', '2026-07-06T00:04:00.000Z');
  await updateImperialInstructionStatus(evidenceOrder.id, 'needs_evidence', '2026-07-06T00:04:00.000Z');

  const needsEvidenceCase = await getFinanceIntelLoopCase(issue.taskId) as { stage?: string; instruction?: { status?: string } } | null;
  assert.equal(needsEvidenceCase?.stage, 'needs_evidence');
  assert.equal(needsEvidenceCase?.instruction?.status, 'needs_evidence');

  const rejectedIssue = await createCourtIssue({
    userId: 'branch-stage-user',
    question: 'Reject this finance case.',
    intent: 'finance_valuation',
    market: 'US',
    ticker: 'MSFT',
    at: '2026-07-06T01:00:00.000Z',
  });
  const rejectedBrief = await createDecisionBrief({
    taskId: rejectedIssue.taskId,
    issueId: rejectedIssue.id,
    brief: {
      type: 'decision_brief',
      taskId: rejectedIssue.taskId,
      issueId: rejectedIssue.id,
      departmentMemorials: [],
      decisionOptions: ['issue_decree', 'request_more_evidence', 'request_review', 'reject'],
    },
    at: '2026-07-06T01:01:00.000Z',
  });
  const rejectOrder = await createImperialInstruction({
    brief: rejectedBrief,
    instructionType: 'reject_order',
    decisionActor: { userId: 'branch-stage-user', role: 'owner', authorityLevel: 'owner' },
    instruction: { decision: 'reject', reason: 'Not worth pursuing.' },
    at: '2026-07-06T01:02:00.000Z',
  });
  await updateIssueStatus(rejectedIssue.id, 'rejected', '2026-07-06T01:03:00.000Z');
  await updateDecisionBriefStatus(rejectedBrief.id, 'rejected', '2026-07-06T01:03:00.000Z');
  await updateImperialInstructionStatus(rejectOrder.id, 'rejected', '2026-07-06T01:03:00.000Z');

  const rejectedCase = await getFinanceIntelLoopCase(rejectedIssue.taskId) as { stage?: string; instruction?: { status?: string } } | null;
  assert.equal(rejectedCase?.stage, 'rejected');
  assert.equal(rejectedCase?.instruction?.status, 'rejected');
});
