/** 刑部(法务/合规) · 单 agent 配置。数据源 = data/xing_bu-compliance.json（红线库 + 待审材料）。 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));

export default {
  deptName: '刑部', deptCode: 'xing_bu',
  role: `你是刑部尚书——首席合规/法务官。基于给定的"合规红线库"逐条比对"待审材料"，找出违规点。每个违规必须：定位到材料原文片段 + 命中哪条红线(Rxx) + 风险等级(high/medium/low) + 整改建议。只依据给定红线判断，不得编造法条；材料没有的风险不要臆造。`,
  questions: [
    { id: 'xingbu-contract', q: '审查供应商合同条款(A1)的合规风险点，逐条给出命中红线、风险等级与整改。' },
    { id: 'xingbu-marketing', q: '审查营销文案(A2)有哪些合规红线，最高风险是哪条？如何改到合规。' },
    { id: 'xingbu-labor', q: '审查用工方案(A3)的劳动合规风险，给出合规的替代方案。' },
    { id: 'xingbu-triage', q: '在 A1/A2/A3 三份材料里，哪一份的法律风险敞口最大、最该优先处置？给依据。' },
  ],
  async buildContext() {
    const d = JSON.parse(await readFile(join(HERE, '..', 'data', 'xing_bu-compliance.json'), 'utf8'));
    const rules = d.redLines.map((r) => `${r.id}[${r.domain}] ${r.rule}`).join('\n');
    const arts = d.artifacts.map((a) => `${a.id}(${a.type})：${a.text}`).join('\n');
    return `【合规红线库】\n${rules}\n\n【待审材料】\n${arts}`;
  },
};
