/** 工部(产品/技术) · 单 agent 配置。数据源 = data/gong_bu-tech.json；算分离=JS 算好优先级分。 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const SEV = { critical: 4, high: 3, medium: 2, low: 1 };

export default {
  deptName: '工部', deptCode: 'gong_bu',
  role: `你是工部尚书——CTO。技术债优先级分(prioScore)与路线图性价比(ROI=value/effort)【已为你算好】，只做工程决策与排期，不要自己心算。结论引用具体分数/工时/事故数；区分"先做/缓做/不做"，预判依赖与风险。只用给定数据。`,
  questions: [
    { id: 'gongbu-debt', q: '本季技术债该按什么顺序还？给出排期(先做哪 3 个)与理由。' },
    { id: 'gongbu-roadmap', q: '路线图三个候选，资源只够 6 人天/冲刺，先做哪个？给依据。' },
    { id: 'gongbu-capacity', q: '团队 6 人、覆盖率 64%、季度 9 次卡死事故——最该投入修复哪一项以最大降事故？' },
    { id: 'gongbu-risk', q: '从工程角度，当前最该警惕的一个系统性风险是什么？' },
  ],
  async buildContext() {
    const d = JSON.parse(await readFile(join(HERE, '..', 'data', 'gong_bu-tech.json'), 'utf8'));
    const debt = d.techDebt
      .map((t) => ({ ...t, prio: ((SEV[t.severity] || 1) * (1 + t.incidentsQtr)) / t.effortWeeks }))
      .sort((a, b) => b.prio - a.prio)
      .map((t) => `${t.id} ${t.item}｜severity=${t.severity} 季度事故=${t.incidentsQtr} 工时=${t.effortWeeks}w 影响=${t.blastRadius} prioScore=${t.prio.toFixed(2)}`)
      .join('\n');
    const rm = d.roadmap
      .map((r) => `${r.id} ${r.feature}｜value=${r.valueScore} 工时=${r.effortWeeks}w ROI(value/工时)=${(r.valueScore / r.effortWeeks).toFixed(2)} 依赖=${r.depends.join(',') || '无'}`)
      .join('\n');
    const m = d.engMetrics;
    return `【技术债(按 prioScore 降序，已算好)】\n${debt}\n\n【路线图(含 ROI)】\n${rm}\n\n【工程度量】团队${m.teamSize}人·速度${m.velocityPtsPerSprint}pt/冲刺·P95部署${m.p95DeployMin}min·MTTR${m.incidentMTTRHours}h·测试覆盖${m.testCoveragePct}%`;
  },
};
