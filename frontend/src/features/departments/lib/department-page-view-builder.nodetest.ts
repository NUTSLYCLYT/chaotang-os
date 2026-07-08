import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDepartmentPageView,
  type DepartmentTaskInsight,
  type LibuPromoOverview,
  normalizeDepartmentPageCode,
} from './department-page-view-builder.ts';
import type { BingbuSalesOverview } from '../../../lib/contracts/bingbu-sales.ts';
import type { HubuOverview } from '../../../lib/contracts/hubu.ts';
import type { LegalOverview } from '../../../lib/contracts/xingbu.ts';

const generatedAt = '2026-07-02T00:00:00.000Z';

const hubuOverview: HubuOverview = {
  summary: {
    total_requested: '180k',
    approved_this_week: '0',
    pending_count: 1,
    avg_roi: '2.1x',
    cash_reserve: 'pending',
    recommendation: 'finance live summary',
    generated_at: generatedAt,
    source: 'turso',
  },
  projects: [
    {
      id: 'pay-1',
      title: 'Supplier final payment review',
      target_dept: 'gongbu',
      owner_dept: 'finance',
      status: 'pending_review',
      requested_budget: '180k',
      estimated_roi: 'pending',
      payback_window: 'pending',
      cash_flow_pressure: 'high',
      priority: 'P0',
      risk_level: 'high',
      recommendation: 'hold for evidence',
      command: 'review final payment',
      acceptance_criteria: ['acceptance proof'],
      created_at: generatedAt,
      updated_at: generatedAt,
    },
  ],
  llm_advice: null,
};

const legalOverview: LegalOverview = {
  summary: {
    totalCases: 1,
    pendingCount: 1,
    closedThisWeek: '0',
    complianceBacklog: 1,
    avgCycleDays: 8,
    closureRate: '0%',
    recommendation: 'legal live summary',
    source: 'turso',
    generatedAt,
  },
  cases: [
    {
      id: 'case-1',
      caseNumber: 'L-1',
      title: 'Contract redline review',
      plaintiff: 'ops',
      defendant: 'customer',
      status: 'pending_review',
      amount: '180k',
      priority: 'P0',
      riskLevel: 'critical',
      legalReferences: ['payment', 'acceptance'],
      evidenceIds: ['contract-v1'],
      summary: 'critical contract risk',
      judge: 'legal',
      createdAt: generatedAt,
      updatedAt: generatedAt,
    },
  ],
  complianceItems: [],
};

const bingbuOverview: BingbuSalesOverview = {
  summary: {
    total_items: 1,
    pending_count: 1,
    high_risk_count: 1,
    recommendation: 'ops live summary',
    generated_at: generatedAt,
    source: 'turso',
  },
  items: [
    {
      id: 'deal-1',
      title: 'Customer pricing push',
      command: 'customer asks for discount',
      status: 'pending_review',
      priority: 'P0',
      counterparty: 'Customer A',
      stage: 'pricing',
      amount: '180k',
      risk_level: 'high',
      recommendation: 'do not discount blindly',
      terms: ['exclusive clause'],
      industry: 'energy',
      delivery: '30 days',
      prepayment: '50k',
      asked_count: 2,
      created_at: generatedAt,
      updated_at: generatedAt,
    },
  ],
};

const libuPromoOverview: LibuPromoOverview = {
  source: 'promo-test',
  count: 2,
  highValueCount: 1,
  byCategory: { case: 1, product: 1 },
  items: [
    {
      title: 'Public case asset',
      category: 'case',
      kind: 'pdf',
      ext: '.pdf',
      tier: 'high',
    },
  ],
};

test('normalizes works alias to gongbu', () => {
  assert.equal(normalizeDepartmentPageCode('works'), 'gongbu');
});

test('builds a non-empty page view for every department', () => {
  for (const code of ['finance', 'gongbu', 'personnel', 'market', 'ops', 'legal'] as const) {
    const view = buildDepartmentPageView({ code, generatedAt });
    assert.ok(view, `${code} view`);
    assert.equal(view.department.code, code);
    assert.ok(view.leftRail.length >= 2, `${code} left rail`);
    assert.ok(view.rightRail.length >= 1, `${code} right rail`);
    assert.ok(view.mainEdict.rows.length >= 5, `${code} edict rows`);
  }
});

test('live adapters feed department-level page data', () => {
  const finance = buildDepartmentPageView({ code: 'finance', generatedAt, hubuOverview });
  const legal = buildDepartmentPageView({ code: 'legal', generatedAt, legalOverview });
  const ops = buildDepartmentPageView({ code: 'ops', generatedAt, bingbuOverview });
  const market = buildDepartmentPageView({ code: 'market', generatedAt, libuPromoOverview });

  assert.ok(finance);
  assert.ok(legal);
  assert.ok(ops);
  assert.ok(market);
  assert.equal(finance.integrity.mode, 'live');
  assert.ok(finance.leftRail.some((section) => section.id === 'hubu-money-health'));
  assert.ok(finance.leftRail.some((section) => section.id === 'hubu-pending-projects'));
  assert.equal(legal.mainEdict.seal, 'secret');
  assert.ok(ops.leftRail.some((section) => section.id === 'bingbu-battlefield'));
  assert.ok(market.leftRail.some((section) => section.id === 'libu-promo-assets'));
});

test('finance current task case is echoed into the central scroll', () => {
  const taskInsights: DepartmentTaskInsight[] = [
    {
      id: 'case-finance-1',
      title: 'Budget release for urgent supplier payment',
      command: 'release supplier payment after checking cash impact',
      status: 'report_ready',
      updatedAt: generatedAt,
      reason: 'finance keyword or routing hit',
      verdict: 'hold until acceptance proof is attached',
      evidence: ['cash impact memo missing', 'acceptance proof missing'],
      nextSteps: ['attach acceptance proof', 'ask treasury to re-check cash buffer'],
      relatedDepartments: ['gongbu', 'legal'],
      tone: 'amber',
    },
  ];

  const view = buildDepartmentPageView({ code: 'finance', generatedAt, hubuOverview, taskInsights });
  assert.ok(view);
  assert.equal(view.mainEdict.rows[0].label, '当前待办');
  assert.match(view.mainEdict.rows.map((row) => row.body).join('\n'), /case-finance-1/);
  assert.match(view.mainEdict.rows.map((row) => row.body).join('\n'), /acceptance proof/);
  assert.doesNotMatch(view.mainEdict.rows[0].body, /finance live summary/);
});

test('department pages stay department-level and expose blocked value modules', () => {
  for (const code of ['finance', 'gongbu', 'personnel', 'market', 'ops', 'legal'] as const) {
    const view = buildDepartmentPageView({ code, generatedAt });
    assert.ok(view);
    assert.equal(view.leftRail.some((section) => section.id === 'bureau-capabilities' || section.id === 'bureau-work-queue'), false);
    assert.ok([...view.leftRail, ...view.rightRail].some((section) => section.kind === 'blocked_value'), `${code} blocked value`);
    assert.ok(view.commandBar.length >= 4, `${code} command bar`);
  }
});

test('department pages expose entrances to their bureaus', () => {
  for (const code of ['finance', 'gongbu', 'personnel', 'ops', 'legal'] as const) {
    const view = buildDepartmentPageView({ code, generatedAt });
    assert.ok(view);
    assert.ok(view.leftRail.findIndex((section) => section.id === 'bureau-entrances') >= 2, `${code} bureau entrance follows pinned modules`);
    const entrances = view.leftRail.find((section) => section.id === 'bureau-entrances');
    assert.ok(entrances, `${code} bureau entrances`);
    assert.ok(entrances.items.length >= 1, `${code} bureau entrance count`);
    assert.match(entrances.items[0].href ?? '', /^\/liubu\//);
    assert.ok(entrances.items.every((item) => item.label && item.body && item.href), `${code} entrance content`);
  }

  const market = buildDepartmentPageView({ code: 'market', generatedAt });
  assert.ok(market);
  assert.equal(market.leftRail.some((section) => section.id === 'bureau-entrances'), false);
});

test('department page module labels use user-facing language', () => {
  const view = buildDepartmentPageView({
    code: 'gongbu',
    generatedAt,
    taskInsights: [
      {
        id: 'task-gongbu-plan',
        title: 'PACK review',
        command: 'request delivery tests',
        status: 'report_ready',
        updatedAt: generatedAt,
        reason: 'gongbu page action',
        evidence: ['missing test record'],
        trueChainPlan: {
          id: 'gongbu-feasibility',
          label: 'Gongbu feasibility',
          method: 'POST',
          endpoint: '/api/court/dept/gong-bu/feasibility',
          payload: { task_input: 'test PACK' },
          note: 'manual fire only',
        },
      },
    ],
  });

  assert.ok(view);
  const titles = [...view.leftRail, ...view.rightRail].map((section) => section.title);
  assert.ok(titles.includes('当前待办'));
  assert.ok(titles.includes('待确认执行'));
  assert.ok(titles.includes('依据与缺口'));
  assert.ok(titles.includes('数据来源与缺口'));
  assert.ok(titles.includes('可办理事项'));
  assert.equal(titles.includes('真实任务派生'), false);
  assert.equal(titles.includes('持久化真链准备'), false);
  assert.equal(titles.includes('任务证据与门禁'), false);
  assert.equal(titles.includes('数据诚实度'), false);
});

test('current task item titles are cleaned for users', () => {
  const view = buildDepartmentPageView({
    code: 'legal',
    generatedAt,
    taskInsights: [
      {
        id: 'action-1',
        title: 'finance · 交刑部复核',
        command: 'finance department page action: 交刑部复核',
        status: 'report_ready',
        updatedAt: generatedAt,
        reason: 'finance -> legal · 交刑部复核',
        tone: 'amber',
      },
      {
        id: 'brief-1',
        title: '请军机处围绕“分析比亚迪当前股票的投资价值，重点考察收入、利润和现金流。”组织会审',
        command: '分析比亚迪当前股票的投资价值，重点考察收入、利润和现金流。',
        status: 'report_ready',
        updatedAt: generatedAt,
        reason: 'legal risk keyword or routing hit',
        tone: 'amber',
      },
    ],
  });

  assert.ok(view);
  const tasks = [...view.leftRail, ...view.rightRail].find((section) => section.id === 'primary-task-insights');
  assert.ok(tasks);
  assert.equal(tasks.items[0].label, '户部移交：交刑部复核');
  assert.equal(tasks.items[1].label, '分析比亚迪当前股票的投资价值，重点考察收入、利润和现金流');
  assert.equal(tasks.items[0].value, '待处理');
  assert.equal(tasks.items[1].value, '待处理');
  assert.doesNotMatch(tasks.items.map((item) => item.label).join('\n'), /finance|请军机处|组织会审/i);
});

test('department pages expose evidence, blocked value, and archive actions', () => {
  for (const code of ['finance', 'gongbu', 'personnel', 'market', 'ops', 'legal'] as const) {
    const view = buildDepartmentPageView({ code, generatedAt });
    assert.ok(view);
    const allRails = [...view.leftRail, ...view.rightRail];
    assert.ok(
      allRails.some((section) => section.kind === 'evidence_list' || section.id === 'integrity'),
      `${code} evidence or integrity rail`,
    );
    assert.ok(allRails.some((section) => section.kind === 'blocked_value'), `${code} blocked value rail`);
    assert.ok(view.commandBar.some((command) => command.id === 'archive'), `${code} archive command`);
    assert.ok(
      view.commandBar.some((command) => !['archive'].includes(command.id) && !command.disabledReason),
      `${code} operational command`,
    );
  }
});

test('handoff commands carry structured target departments', () => {
  const finance = buildDepartmentPageView({ code: 'finance', generatedAt });
  const ops = buildDepartmentPageView({ code: 'ops', generatedAt });
  const market = buildDepartmentPageView({ code: 'market', generatedAt });

  assert.ok(finance);
  assert.ok(ops);
  assert.ok(market);
  assert.equal(finance.commandBar.find((item) => item.id === 'handoff_legal')?.targetDepartment, 'legal');
  assert.equal(ops.commandBar.find((item) => item.id === 'handoff_finance')?.targetDepartment, 'finance');
  assert.equal(ops.commandBar.find((item) => item.id === 'handoff_gongbu')?.targetDepartment, 'gongbu');
  assert.equal(market.commandBar.find((item) => item.id === 'handoff_legal')?.targetDepartment, 'legal');
});

test('gongbu task insights surface verdict, evidence, and true-chain plan separately', () => {
  const taskInsights: DepartmentTaskInsight[] = [
    {
      id: 'task-gongbu-plan',
      title: 'PACK review',
      command: 'request delivery tests',
      status: 'report_ready',
      updatedAt: generatedAt,
      reason: 'gongbu page action',
      verdict: 'hold for delivery evidence',
      evidence: ['missing test record'],
      nextSteps: ['add regression report'],
      trueChainPlan: {
        id: 'gongbu-feasibility',
        label: 'Gongbu feasibility',
        method: 'POST',
        endpoint: '/api/court/dept/gong-bu/feasibility',
        resultEndpoint: '/api/court/dept/gong-bu/feasibility/result?sid={session_id}',
        payload: { task_input: 'test PACK' },
        note: 'manual fire only',
      },
      tone: 'blue',
    },
  ];

  const view = buildDepartmentPageView({ code: 'gongbu', generatedAt, taskInsights });
  assert.ok(view);
  assert.equal(view.integrity.mode, 'partial');
  assert.match(view.mainEdict.rows[0].body, /hold for delivery evidence/);
  const trueChainRail = view.rightRail.find((section) => section.id === 'primary-task-true-chain');
  const evidenceRail = view.rightRail.find((section) => section.id === 'primary-task-source');
  assert.ok(trueChainRail);
  assert.ok(evidenceRail);
  assert.equal(trueChainRail.items[0].value, '待确认');
  assert.match(trueChainRail.items[0].details?.find((detail) => detail.label === '触发')?.value ?? '', /需要你确认/);
  assert.match(trueChainRail.items[0].details?.find((detail) => detail.label === '材料')?.value ?? '', /办事材料/);
  assert.doesNotMatch(JSON.stringify(trueChainRail), /\/api\/court\/dept\/gong-bu\/feasibility/);
  assert.doesNotMatch(JSON.stringify(trueChainRail), /task_input/);
  assert.match(evidenceRail.items[0].body ?? '', /missing test record/);
});

test('personnel task insights surface responsibility chain', () => {
  const taskInsights: DepartmentTaskInsight[] = [
    {
      id: 'task-personnel-1',
      title: 'Sales DRI appointment',
      command: 'appoint sales DRI and signature chain',
      status: 'report_ready',
      updatedAt: generatedAt,
      reason: 'personnel accountability keyword or routing hit',
      verdict: 'responsibility chain required',
      evidence: ['each step has DRI and deadline'],
      nextSteps: ['add signature chain'],
      tone: 'amber',
    },
  ];

  const view = buildDepartmentPageView({ code: 'personnel', generatedAt, taskInsights });
  assert.ok(view);
  assert.equal(view.integrity.mode, 'partial');
  assert.match(view.mainEdict.rows[0].body, /responsibility chain/);
  assert.match(view.mainEdict.rows[2].body, /signature chain/);
  assert.ok(view.rightRail.some((section) => section.id === 'primary-task-source'));
});
