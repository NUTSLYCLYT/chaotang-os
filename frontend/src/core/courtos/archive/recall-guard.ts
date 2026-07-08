/**
 * 朝堂 OS · 史馆召回租户隔离守卫(纯函数,无 server-only/无 DB,可单测)
 *
 * 设计依据:dev/notes/chain-audit-2026-06-25.md CRITICAL#3 + 4 大神评估(Schneier/Karpathy/Deming/Munger 一致)。
 * 史馆 court_archives 跨租户召回=信息泄露 + RAG 决策投毒双杀(违铁律1)。本守卫把召回的 default-deny
 * 与 SQL 命门(OR 链必须整组加括号、user_id 强过滤、合成/DEMO/FALLBACK 不进召回)抽成可被 CI 钉死的纯逻辑。
 *
 * 命门(4 大神一致):若把 WHERE 写成 `user_id = ? OR term LIKE ?...` 漏了括号,OR 会短路掉 user_id 谓词
 * → 全表泄露原样复活,且只要正向断言"能召回我自己的案子"就照样全绿。所以 OR 链恒整组括号 + 负向断言。
 *
 * 本文件保持【纯】(无 server-only/无 logger/无 @/ 值导入),以便 recall-guard.nodetest.ts 直接单测命门。
 */

/** 不可被当作可引用先例的源标(合成/兜底/演示),SSOT 在 reality-state；此处仅列召回排除集。 */
export const NON_RECALLABLE_SOURCES = ['DEMO', 'FALLBACK'] as const;

/**
 * default-deny:谁的归档可以进入召回。
 * 登录用户(具体 user_id)=可召回自己的;空/缺失/anonymous=一律不召回(anonymous 只写不召,防匿名桶互窜)。
 */
export function isRecallableUser(userId: string | null | undefined): boolean {
  return typeof userId === 'string' && userId.length > 0 && userId !== 'anonymous';
}

/**
 * 从问题抽关键片段。中文无空格 → 整句会变成一个词,LIKE 只能召回一字不差的旧案(飞轮死结)。
 * 修:先按分隔符切,短词(2-4字/英文)直接留;长中文片段再滑动 3-4 字 n-gram,
 * 让"华东大客户独家供货协议"与其换措辞的问法共享 3-4 字子串 → LIKE 跨措辞召回。
 * 上限 12(防 OR 链膨胀);SQL 结构(租户隔离/OR整组括号)不变,命门不动。
 */
export function extractRecallTerms(question: string): string[] {
  const terms = new Set<string>();
  for (const seg of question.split(/[\s,，。;；、:：!！?？()（）"'`]+/)) {
    const s = seg.trim();
    if (s.length < 2) continue;
    if (s.length <= 4) terms.add(s); // 短词/英文词直接留
    for (const n of [3, 4]) {
      for (let i = 0; i + n <= s.length; i++) terms.add(s.slice(i, i + n));
    }
  }
  return Array.from(terms).slice(0, 12);
}

export interface RecallQuery {
  sql: string;
  args: (string | number)[];
}

/**
 * 构建租户隔离的召回 SQL。返回 null = 不召回(fail-closed):用户不可召回 或 无有效关键词。
 * SQL 三过滤恒在:① user_id = ?(强等值,NULL 旧行天然不命中) ② synthetic = 0(合成案不漂白)
 * ③ source_label 排除 DEMO/FALLBACK ④ term 的 OR 链【整组括号】。
 */
export function buildRecallQuery(question: string, userId: string | null | undefined, limit = 3): RecallQuery | null {
  // fail-closed:用户不可召回(空/缺失/anonymous)→ 不召回(anonymous 只写不召,告警由 server 侧 caller 出)。
  if (!isRecallableUser(userId)) return null;
  const terms = extractRecallTerms(question);
  if (terms.length === 0) return null;

  // ⚠️ OR 链必须整组包在一对括号里 —— 命门,见文件头。
  // MED-1 修复: LEFT JOIN shiguan_archives 在 task_id 无唯一约束时产生一对多重复行，
  //   同一 court_archives 行被放大 N 倍，挤占 LIMIT、徽章多计。
  //   改为相关子查询取每 task 最新一条 retrospective_status，确保召回结果按 ca 行不重复。
  const termOr = terms.map(() => 'original_question LIKE ?').join(' OR ');
  const sourceExcluded = NON_RECALLABLE_SOURCES.map(() => '?').join(',');
  const sql =
    `SELECT ca.id, ca.original_question, ca.verdict, ca.source_label, ca.created_at, ca.reusable_lessons_json,\n` +
    `             (SELECT s.retrospective_status FROM shiguan_archives s WHERE s.task_id = ca.task_id ORDER BY s.created_at DESC LIMIT 1) AS retrospective_status\n` +
    `      FROM court_archives ca\n` +
    `      WHERE ca.user_id = ?\n` +
    `        AND ca.synthetic = 0\n` +
    `        AND (ca.source_label IS NULL OR ca.source_label NOT IN (${sourceExcluded}))\n` +
    `        AND (${termOr})\n` +
    `      ORDER BY ca.created_at DESC LIMIT ?`;
  const args: (string | number)[] = [
    userId as string,
    ...NON_RECALLABLE_SOURCES,
    ...terms.map((t) => `%${t}%`),
    limit,
  ];
  return { sql, args };
}

/**
 * 阶段4②(2026-07-03)：archive_records(finance-intel-loop 归档)召回桥接。
 *
 * 隔离粒度决策(用户明确选定"补 user_id 再接"，非租户级共享)：archive_records 表本身无 user_id 列，
 * 且写入方 `archive/from-task/route.ts` 此前把 `requireSessionUserId()` 的结果直接丢弃、从未传入
 * `createArchiveFromTask`——但 `createArchiveFromTask` 早已把创建该任务的 `court_issues` 整行(含
 * `user_id`)打包进 `archive_json.issue` 字段。故不需要 schema 迁移，用 `json_extract` 从 JSON 里
 * 取出 `issue.userId` 做等值过滤，隔离粒度与 `buildRecallQuery` 的 court_archives 完全一致(用户级)。
 *
 * 命门(同 buildRecallQuery)：user_id 强等值 AND 连接(绝不被 term 的 OR 短路)、term OR 链整组括号、
 * fail-closed(不可召回用户/无关键词 → null，不查全表)。
 *
 * `archive.issue` 为 null(该任务创建时无对应 court_issues 行，理论上不应发生但防御性处理)时，
 * `json_extract` 对 JSON null 取值返回 SQL NULL，天然不等于任何真实 user_id 字符串 → 不命中，
 * 与"无主档案不召回"的 fail-closed 精神一致，不会误放行(已用裸 sqlite3 CLI 手工验证此边界)。
 *
 * ⚠️ 会审提醒(2026-07-03)：`json_extract`/`json_each` 是本仓首次使用，目前本部署未配置
 * `TURSO_DB_URL`(见 `src/lib/db/turso.ts` 的 fallback 逻辑)，实际跑的是本地嵌入式 libSQL
 * (`file:./.chaotang-main-*.db`)，与本文件/nodetest 的验证环境一致，非远程 Turso sqld。
 * 若未来切换到真远程 `TURSO_DB_URL`，务必在该实例上手工跑一次带 json_each 的 smoke query
 * 再上线——不同 sqld 版本/编译选项对 JSON1 扩展的支持可能与本地 libSQL 客户端不完全一致。
 */
export function buildArchiveRecordsRecallQuery(
  question: string,
  userId: string | null | undefined,
  limit = 3,
): RecallQuery | null {
  if (!isRecallableUser(userId)) return null;
  const terms = extractRecallTerms(question);
  if (terms.length === 0) return null;

  // ⚠️ OR 链必须整组包在一对括号里 —— 命门,见文件头。term 匹配对象:issue.question + outcome + lessons
  // 数组(json_each 展开)，覆盖"问题原文"和"复盘结论/教训"两类可被跨措辞召回的内容。
  const termOr = terms
    .map(
      () =>
        `(json_extract(archive_json, '$.issue.question') LIKE ?\n` +
        `           OR json_extract(archive_json, '$.outcome') LIKE ?\n` +
        `           OR EXISTS (SELECT 1 FROM json_each(archive_json, '$.lessons') je WHERE je.value LIKE ?))`,
    )
    .join(' OR ');
  const sql =
    `SELECT id, archive_json, created_at\n` +
    `      FROM archive_records\n` +
    `      WHERE json_extract(archive_json, '$.issue.userId') = ?\n` +
    `        AND (${termOr})\n` +
    `      ORDER BY created_at DESC LIMIT ?`;
  const args: (string | number)[] = [
    userId as string,
    ...terms.flatMap((t) => [`%${t}%`, `%${t}%`, `%${t}%`]),
    limit,
  ];
  return { sql, args };
}
