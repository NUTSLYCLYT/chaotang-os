import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { readFile, rm } from 'node:fs/promises';
import test from 'node:test';

const dbPath = `/tmp/courtos-mvp-api-${process.pid}.db`;
process.env.TURSO_DB_URL = `file:${dbPath}`;

/**
 * 阶段4 部分退役(2026-07-03，铁律16 两段式清理，同日会审后修正)：本文件原名"CourtOS Goal 2 API 骨架"，
 * 断言的 `/api/reviews/*`(7路由)+`/api/registry/departments`+`/api/shiguan/archives`(列表GET)+
 * `[archive_id]`(单条GET)+`shiguan-archive-to-case.ts` 已 git mv 进 `dev/_attic/courtos-mvp-reviews-cluster/`。
 * 取证：`docs/INTEGRATION_FREEZE_2026-06-18.md` 自曝这是当时的"候选功能组"，合并进主干后
 * 全仓 0 客户端调用(dashboard/features/components 均无引用)，从未真正接线到任何页面。
 *
 * ⚠️ 例外(独立会审抓出)：`courtos-decision-store.ts`+`decision-archive-policy.ts` **没有**退役——
 * `retrospective/route.ts` 仍被 `ShiguanPage.tsx` 的"更新复盘状态"按钮真实 fetch 调用(HTTP路径
 * 字符串引用，静态 grep import 抓不到，是本轮第3次撞到的盲区)，故这两个文件+该路由仍在 `src/` 里活着。
 * 详见 `dev/_attic/courtos-mvp-reviews-cluster/EXPIRES-2026-07-24.md`。
 *
 * 本文件保留部分：swarm-deepen(真活功能，独立于上述集群) + schema 表存在性(表未删，只是部分代码退役)。
 */
test('swarm-deepen 端点契约仍在(独立于已退役的 courtos-decision-store 集群)', async (t) => {
  t.after(async () => {
    await rm(dbPath, { force: true });
    await rm(`${dbPath}-shm`, { force: true });
    await rm(`${dbPath}-wal`, { force: true });
  });

  await access(new URL('../../../app/api/court/shangshufang/tasks/[taskId]/swarm-deepen/route.ts', import.meta.url));

  const jiqunApiText = await readFile(new URL('../../../lib/jiqun-api.ts', import.meta.url), 'utf8');
  assert.match(jiqunApiText, /export async function shangshufangSwarmDeepen/);
  assert.match(jiqunApiText, /\/api\/court\/shangshufang\/tasks\/\$\{encodeURIComponent\(taskId\)\}\/swarm-deepen/);

  const shangshufangPageText = await readFile(new URL('../../../features/shangshufang/ShangshufangPage.tsx', import.meta.url), 'utf8');
  assert.match(shangshufangPageText, /shangshufangSwarmDeepen\(draft\.task_id\)/);
  assert.doesNotMatch(shangshufangPageText, /chaotang\.orchestrateAll\(backendCommand/);
});

test('updateArchiveRetrospective 契约仍在(唯一真活的 courtos-decision-store 导出，被 retrospective/route.ts 消费)', async () => {
  const storeText = await readFile(new URL('../../../lib/db/courtos-decision-store.ts', import.meta.url), 'utf8');
  assert.match(storeText, /export async function updateArchiveRetrospective/);
  assert.match(storeText, /export async function getArchive\b/); // updateArchiveRetrospective 内部依赖

  const routeText = await readFile(
    new URL('../../../app/api/shiguan/archives/[archive_id]/retrospective/route.ts', import.meta.url),
    'utf8',
  );
  assert.match(routeText, /updateArchiveRetrospective/);
});

test('已退役集群对应的 schema 表仍在(本次只退役代码，未动表/未做 DB 迁移)', async () => {
  const schemaText = await readFile(new URL('../../../lib/db/schema.ts', import.meta.url), 'utf8');
  for (const table of [
    'decision_tasks',
    'draft_edicts',
    'court_reviews',
    'department_review_runs',
    'memorials',
    'emperor_decisions',
    'shiguan_archives',
    'court_loop_runs',
  ]) {
    assert.match(schemaText, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
    assert.match(schemaText, new RegExp(`name: "${table}"`));
  }
  assert.match(schemaText, /decision_tasks_user_status_updated/);
});
