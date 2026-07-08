/**
 * dept-identity —— 部门身份的单一真相源(SSOT)。铁律2。
 *
 * 系统里部门有三套命名,跨进程传递:
 *   · swarm 路由/agent 码:finance / ops / legal / works ...
 *   · prime-minister 码:  hu_bu / bing_bu / xing_bu ...(见 contracts/prime-minister)
 *   · 中文名:             户部 / 兵部 / 刑部 ...(三套命名的交汇键)
 *
 * 飞轮的偏好边(boss_preferences.edge)用中文名;sign-off 的 chosenDept 用 prime-minister 码;
 * merge 造边用 swarm 码经中文名。任一侧各自维护平行 map → 任一改名即写出永不匹配的孤儿边、
 * 计数器静默空转。故:swarm↔中文↔pm 的桥接只此一处,merge / client 一律 import 它。
 */

import { DEPARTMENT_NAME_CN, getDepartmentLabel } from '@/lib/contracts/prime-minister';

/** swarm 路由/agent 码 → 中文名(含历史别名)。中文名须与 DEPARTMENT_NAME_CN 的值逐字一致。 */
const SWARM_CODE_CN: Record<string, string> = {
  hubu: '户部',
  finance: '户部',
  ops: '兵部',
  legal: '刑部',
  market: '礼部',
  guard: '锦衣卫',
  physician: '太医院',
  works: '工部',
  gong_bu: '工部',
  gongbu: '工部',
  hr: '人和部',
  li_bu: '人和部',
};

/** 中文名 → prime-minister 码(DEPARTMENT_NAME_CN 的反查)。sign-off 的 chosenDept 须用此码。 */
const CN_TO_PM_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(DEPARTMENT_NAME_CN).map(([code, cn]) => [cn, code]),
);

/** swarm 码 → 中文名(未知码原样返回;生产前应被 checkDeptIdentityDrift 拦下)。 */
export function swarmToCn(code: string): string {
  return SWARM_CODE_CN[code] ?? code;
}

/** 中文名 → prime-minister 码;无映射返回 null(调用方须显式处理,禁把 null 当合法)。 */
export function cnToPmCode(cn: string): string | null {
  return CN_TO_PM_CODE[cn] ?? null;
}

/** prime-minister 码 → 中文名(复用 contracts 权威实现)。 */
export const pmToCn = getDepartmentLabel;

/**
 * 一致性断言(铁律2):每个 live swarm 部门在三套命名下必须可双向往返,否则飞轮偏好边会无声错位。
 * 返回漂移描述列表(空数组=一致)。供 dev 启动期 / 回归测试调用,把"静默漂移"变"显式失败"。
 */
export function checkDeptIdentityDrift(liveSwarmCodes: string[]): string[] {
  const drift: string[] = [];
  for (const code of liveSwarmCodes) {
    const cn = SWARM_CODE_CN[code];
    if (!cn) {
      drift.push(`swarm 码「${code}」无中文名映射`);
      continue;
    }
    const pm = CN_TO_PM_CODE[cn];
    if (!pm) {
      drift.push(`中文名「${cn}」(来自 ${code})在 prime-minister 码中缺失`);
      continue;
    }
    const back = getDepartmentLabel(pm);
    if (back !== cn) drift.push(`往返不一致:${code} → ${cn} → ${pm} → ${back}`);
  }
  return drift;
}
