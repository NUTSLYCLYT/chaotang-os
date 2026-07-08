/**
 * 技能同义词词典（2026-06-29）
 *
 * 天才设计⑤：修关键词匹配精度——磷酸铁锂⊂锂电、BMS=电池管理系统 等语义等价。
 * 给猎头画像匹配/价库规格匹配复用。纯函数。
 */
const SYNONYM_GROUPS: string[][] = [
  ['锂电', '锂电池', '磷酸铁锂', 'lfp', '三元', '动力电池', '储能电池'],
  ['bms', '电池管理系统', '电池管理'],
  ['嵌入式', '单片机', 'mcu', 'c语言', '固件'],
  ['军工', '装备', '国防', '部队', '军品'],
  ['硬件', 'pcb', '电路设计', '电子工程'],
  ['销售', '商务', '市场', 'bd', '客户经理'],
];
function norm(s: string): string { return s.replace(/\s/g, '').toLowerCase(); }
/** 两个技能词是否语义等价(直接含 或 同组)。 */
export function skillMatch(a: string, b: string): boolean {
  const na = norm(a), nb = norm(b);
  if (na.includes(nb) || nb.includes(na)) return true;
  return SYNONYM_GROUPS.some((g) => g.some((x) => na.includes(x)) && g.some((x) => nb.includes(x)));
}
/** 技能列表里是否有匹配 target 的(含同义)。 */
export function skillsHave(skills: string[], target: string): boolean {
  return skills.some((s) => skillMatch(s, target));
}
