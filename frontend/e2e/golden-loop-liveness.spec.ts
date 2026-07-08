import { test, expect, type APIRequestContext } from '@playwright/test';
import { seedSession } from './fixtures';
import type { JiqunSessionSummary, JiqunSessionDetail } from '@/lib/jiqun-api';

/**
 * ════════════════════════════════════════════════════════════════════════════
 *  黄金链路 · 真·存活判据 (golden-loop liveness)  —— 朝堂端到端"真跑通"的唯一裁判
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 背景(2026-06-08 就绪度审计 wzjdn5g1l):web 路径的蜂群从未碰过 provider——
 * `production_events.jsonl` 33 条 swarm_api_completed 全是 0-3ms / model=""(真蜂群 ~47s),
 * 唯一 web session run_id="api-swarm-run" 是 pytest fixture 污染。而 e2e/true-loop-contract.spec.ts
 * 用注入假 LIVE_SWARM edict + 把 true-chain-health mock 成全 'real' 来"证明"链路通——那是化妆师。
 *
 * 本 spec 与之**相反**:
 *   - 零 route mock、零注入。经 H3 已证为真的接缝 /jiqun/api/* → Flask :8081 触发**真蜂群**。
 *   - 对真后端产出的会话焊死四把锁,任一不过即判"未跑通":
 *       ① session_id / run_id 是真时间戳格式(^\d{8}_\d{6}),不是 api-swarm-run / study-live-* 等捏造字面量
 *       ② 真实耗时 ≥ 5s(end-start),杀 0-3ms / 1 秒整 的假桩
 *       ③ completed_count > 0 且有 swarm_runs
 *       ④ 至少一个 swarm_run 带真实数值 quality_score(真评分跑过)
 *
 * 设计纪律:
 *   - **会烧 provider token + 可能触发不可逆执行 → 默认 skip**,仅 RUN_LIVENESS=1 时真跑(钦天监/烧钱门)。
 *   - 跳过时显式打 skip 标注,让每次 test 输出都看得见"这道真链路裁判尚未通过"。
 *   - **今天它必红,这正是它的价值**:在它变绿前,任何人不得对外宣称"链路通了"。
 *     绿灯亮的那天才是真的那天,不是 demo 顺利的那天。
 *
 * owner 边界:本 spec 在前端舱(只读后端、不改后端)。让它变绿要后端舱(jiqun_ai)先做:
 *   web/main.py 加 load_dotenv + provider 不可达即 503 + 反作弊真实性门(见就绪度报告 P0)。
 */

// 已知的捏造 id(审计实锤的假桩 + true-loop fixture),命中即判化妆。
// 注意:真会话 id 有两种真实格式 —— CLI 用时间戳(20260608_150654)、study 路径用
// study-live-<hex>(实测 study-live-aaeadfd4,duration 47-63s 真跑)。故**不能**用单一
// 正则当"真"判据(会把真 study-live-* 误杀);改为"黑名单捏造字面量 + 物理耗时"双锁。
const FORGED_IDS = new Set([
  'api-swarm-run',
  'study-live-true-loop',
  'run-command-center',
  'run-hubu',
  'run-gongbu',
]);

// 仅用于排除明显捏造的"非随机"后缀(true-loop / demo / fake / test / stub),
// 真随机 hex 或时间戳都不会命中。这是辅助锁,主锁是耗时与黑名单。
const FORGED_SUFFIX = /-(true-loop|demo|fake|stub|test|sample|placeholder)$/i;

// 一个真实客户样本级别的密旨(储能项目判断,贴近 OPC/兵部真实场景)。
const REAL_SAMPLE_DECREE = '请军机处召集户部与工部，判断 100MWh 冷库储能项目是否推进，并给出报价、交期与风险边界。';

const RUN_LIVENESS = process.env.RUN_LIVENESS === '1';
// 接缝要 cookie courtos.access_token(middleware 仅查存在);若后端 Flask 硬验签,
// 用真 token:BACKEND_TEST_JWT=<真HS256> RUN_LIVENESS=1 pnpm exec playwright test golden-loop-liveness
const BACKEND_JWT = process.env.BACKEND_TEST_JWT ?? '';

function durationMs(s: Pick<JiqunSessionSummary, 'start_time' | 'end_time' | 'duration'>): number {
  if (s.start_time && s.end_time) {
    const ms = Date.parse(s.end_time) - Date.parse(s.start_time);
    if (Number.isFinite(ms) && ms >= 0) return ms;
  }
  // 退化:从 duration 串解析前导数字(如 "47s" / "47.3s" / "47000ms")。
  const m = (s.duration ?? '').match(/([\d.]+)\s*(ms|s)?/i);
  if (!m) return NaN;
  const n = parseFloat(m[1]);
  return /ms/i.test(m[2] ?? 's') ? n : n * 1000;
}

async function listSessions(req: APIRequestContext): Promise<JiqunSessionSummary[]> {
  const res = await req.get('/jiqun/api/swarm/sessions');
  expect(res.status(), '接缝 GET /swarm/sessions 应 200(中间件放行 + Flask 可达)').toBe(200);
  return (await res.json()) as JiqunSessionSummary[];
}

test.describe('黄金链路 · 真·存活判据 (web 触发真蜂群)', () => {
  test.skip(
    !RUN_LIVENESS,
    '真链路裁判:烧 provider token + 可能不可逆,默认不跑。' +
      '修完后端 P0(load_dotenv/真实性门)后:RUN_LIVENESS=1 [BACKEND_TEST_JWT=<真JWT>] pnpm exec playwright test golden-loop-liveness。' +
      '今日它必红——绿灯亮才算真跑通。',
  );

  test.beforeEach(async ({ page, context }) => {
    await seedSession(page);
    // 若提供真后端 JWT,覆盖接缝 cookie 值(否则用 e2e-token,后端硬验签时会 401→真信号)。
    if (BACKEND_JWT) {
      await context.addCookies([
        { name: 'courtos.access_token', value: BACKEND_JWT, url: 'http://127.0.0.1:3002' },
        { name: 'courtos.access_token', value: BACKEND_JWT, url: 'http://localhost:3002' },
      ]);
    }
  });

  test('经接缝触发真蜂群 → 产出会话四把锁全过(非捏造id · ≥5s · 有完成 run · 真评分)', async ({ page }) => {
    const req = page.request;

    // 1) 触发前快照,锁定"本次新增"的会话,避免误判旧的真 CLI 会话。
    const before = await listSessions(req);
    const beforeIds = new Set(before.map((s) => s.session_id));

    // 2) 经真接缝触发真蜂群(镜像前端 jiqun/swarm/page.tsx:58 的真实调用,零 mock)。
    const trigger = await req.post('/jiqun/api/swarm/run', { data: { task_input: REAL_SAMPLE_DECREE } });
    expect(
      trigger.status(),
      '触发被拒:401/403=接缝需真JWT(传 BACKEND_TEST_JWT);其它=后端 /swarm/run 不可用。这本身就是"未跑通"的真信号。',
    ).toBeLessThan(400);

    // 3) 轮询直到出现"新"会话且 completed(真蜂群 ~47s,给 150s 上限)。
    let fresh: JiqunSessionSummary | undefined;
    await expect
      .poll(
        async () => {
          const now = await listSessions(req);
          fresh = now.find((s) => !beforeIds.has(s.session_id) && /complete|done|pass/i.test(s.status));
          return fresh ? 'done' : 'pending';
        },
        {
          message: '等真蜂群完成超时:web 路径很可能根本没碰 provider(0ms 假桩)或 litellm down。',
          timeout: 150_000,
          intervals: [3_000],
        },
      )
      .toBe('done');

    const session = fresh!;

    // ── 锁 ①:会话 id 不是捏造字面量/捏造后缀(真 study-live-<hex> / 时间戳 均放行) ──
    expect(FORGED_IDS.has(session.session_id), `session_id 命中捏造名单:${session.session_id}`).toBe(false);
    expect(session.session_id, `session_id 命中捏造后缀:${session.session_id}`).not.toMatch(FORGED_SUFFIX);

    // ── 锁 ②:真实耗时 ≥ 5s(杀 0-3ms / 1秒整 假桩) ──
    const ms = durationMs(session);
    expect(ms, `会话耗时 ${ms}ms < 5000ms,物理上不可能是真蜂群(真跑 ~47s)`).toBeGreaterThanOrEqual(5000);

    // ── 锁 ③:有完成的 swarm_runs ──
    expect(session.completed_count, 'completed_count 应 > 0').toBeGreaterThan(0);
    const detailRes = await req.get(`/jiqun/api/swarm/sessions/${encodeURIComponent(session.session_id)}`);
    expect(detailRes.status()).toBe(200);
    const detail = (await detailRes.json()) as JiqunSessionDetail;
    expect(detail.swarm_runs.length, '真会话必须有 swarm_runs').toBeGreaterThan(0);

    for (const r of detail.swarm_runs) {
      expect(FORGED_IDS.has(r.run_id), `swarm_run.run_id 命中捏造名单:${r.run_id}`).toBe(false);
      expect(r.run_id, `swarm_run.run_id 命中捏造后缀:${r.run_id}`).not.toMatch(FORGED_SUFFIX);
    }

    // ── 锁 ④:至少一个 run 带真实数值 quality_score(真评分跑过,非占位) ──
    const scored = detail.swarm_runs.filter(
      (r) => typeof r.quality_score === 'number' && Number.isFinite(r.quality_score),
    );
    expect(scored.length, '无任何 run 带真实数值 quality_score → 评分链未真跑').toBeGreaterThan(0);
  });

  test('上书房下旨页可达(真链路前置:UI 入口不死)', async ({ page }) => {
    // 不烧 token 的轻量前置:真用户下旨入口必须真渲染(非 404/错误态)。
    await page.goto('/study');
    await expect(page.getByRole('region', { name: '今日御案' })).toBeVisible({ timeout: 15_000 });
  });
});
