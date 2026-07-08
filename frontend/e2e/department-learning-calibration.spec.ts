import { expect, test } from '@playwright/test';
import { seedSession } from './fixtures';

const basePath = process.env.PLAYWRIGHT_BASE_PATH ?? '';

test.describe('部门 Agent 自我校准底座', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
    await page.request.post(`${basePath}/api/court/learning/records`, {
      data: { seedAll: true },
    });
  });

  test('后台为 11 个部门 Agent 建档并执行统一校准', async ({ page }) => {
    const response = await page.request.post(`${basePath}/api/court/learning/calibration`, {
      data: { seedAll: true, force: true },
    });

    expect(response.ok()).toBeTruthy();
    const payload = await response.json() as {
      success: boolean;
      data: {
        scanned: number;
        updated: number;
        metrics: {
          total: number;
          confirmed: number;
          confirmedRate: number;
          stillUnknownRate: number;
          dueUnresolved: number;
          resultSourceStale: boolean;
        };
        records: Array<{ id: string; agentCode: string; verdict: string; sourceLabel: string }>;
      };
    };

    expect(payload.success).toBe(true);
    expect(payload.data.scanned).toBe(11);
    expect(payload.data.updated).toBe(11);
    expect(payload.data.records).toHaveLength(11);

    // force=true 让 11 条都执行一次后台校准；无真实结果源时不伪造 confirmed/refuted。
    expect(payload.data.metrics.total).toBe(11);
    expect(payload.data.metrics.confirmed).toBe(0);
    expect(payload.data.metrics.confirmedRate).toBe(0);
    expect(payload.data.metrics.stillUnknownRate).toBeGreaterThan(0);
    expect(typeof payload.data.metrics.resultSourceStale).toBe('boolean');
    expect(payload.data.records.map((record) => record.agentCode).sort()).toEqual([
      'bing_bu',
      'gong_bu',
      'hu_bu',
      'jin_yi_wei',
      'li_bu',
      'li_bu_rites',
      'prime_minister',
      'qin_tian_jian',
      'scribe',
      'tai_yi_yuan',
      'xing_bu',
    ]);
    for (const record of payload.data.records) {
      expect(record.id).toBe(`department_learning_${record.agentCode}`);
      expect(record.verdict).toBe('unknown');
      expect(record.sourceLabel).toBe('RULE_SEED');
    }
  });

  test('影子导师层输出 11 个后台 advisor signal，不要求 UI 展示', async ({ page }) => {
    await page.request.post(`${basePath}/api/court/learning/calibration`, {
      data: { seedAll: true, force: true },
    });

    const response = await page.request.get(`${basePath}/api/court/learning/advisor-signal`);
    expect(response.ok()).toBeTruthy();
    const payload = await response.json() as {
      success: boolean;
      data: {
        signals: Array<{
          agentCode: string;
          weight: number;
          caution: string;
          nudge: string;
          verdict: string;
        }>;
      };
    };

    expect(payload.success).toBe(true);
    expect(payload.data.signals).toHaveLength(11);
    for (const signal of payload.data.signals) {
      expect(signal.weight).toBeGreaterThan(0);
      expect(signal.caution.length).toBeGreaterThan(4);
      expect(signal.nudge.length).toBeGreaterThan(4);
      expect(['confirmed', 'refuted', 'unknown', 'observing']).toContain(signal.verdict);
    }
  });

  // 安全回归(解冻做安全 2026-06-22·会审 CRITICAL):e2e-* 伪造证据后门(isE2eEvidenceId)已删——
  // 非prod 用 e2e-* 凭空伪造"老板签核+史馆归档"双证据提权的旁路必须永久封死。原 happy-path
  // ("confirmed→影子导师上调")覆盖待 test-owner 用真 boss_decision seed 重写(见 line 157 的
  // boss_decision:<id> 范式 + boss-ledger recordOrchestration/signOff),不可长期缺。
  test('e2e-* 伪造证据后门已封死(解冻≠开后门)', async ({ page }) => {
    const response = await page.request.post(`${basePath}/api/court/learning/real-source`, {
      data: {
        source: 'boss_signoff',
        dept: 'hu_bu',
        action: 'signed',
        evidenceId: 'e2e-boss-signoff-001',
      },
    });

    // 后门删后:e2e-* 不再是可信证据,直接写入门拒之(400),不得凭空提权落库。
    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBe(400);
    const payload = (await response.json()) as { success: boolean; error?: string };
    expect(payload.success).toBe(false);
    expect(payload.error ?? '').toContain('trusted evidenceId');
  });

  test('真实结果源拒绝无可信证据的直接写入', async ({ page }) => {
    const response = await page.request.post(`${basePath}/api/court/learning/real-source`, {
      data: {
        source: 'boss_signoff',
        dept: 'hu_bu',
        action: 'signed',
        evidenceId: 'freeform-confirm-me',
      },
    });

    expect(response.status()).toBe(400);
    const payload = await response.json() as { success: boolean; error?: string };
    expect(payload.success).toBe(false);
    expect(payload.error ?? '').toContain('trusted evidenceId');
  });

  test('真实结果源拒绝不存在的 boss_decision 台账证据', async ({ page }) => {
    const response = await page.request.post(`${basePath}/api/court/learning/real-source`, {
      data: {
        source: 'boss_signoff',
        dept: 'hu_bu',
        action: 'signed',
        evidenceId: 'boss_decision:999999999',
      },
    });

    expect(response.status()).toBe(422);
    const payload = await response.json() as {
      success: boolean;
      data: { applied: boolean; record: unknown };
      error?: string;
    };
    expect(payload.success).toBe(false);
    expect(payload.data.applied).toBe(false);
    expect(payload.data.record).toBeNull();
  });
});
