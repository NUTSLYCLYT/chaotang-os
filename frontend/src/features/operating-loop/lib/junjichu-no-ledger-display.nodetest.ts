import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 铁律4 回归(2026-06-29 军机处理顺·剥离 build-ledger 显示侧):
 * 建设台账显示已迁工部办公厅;军机处只留圣旨/会审/奏折/执行路径(御前合议),不再展示建设进度。
 * 钉死:军机处页不得重新引入 build-ledger **显示侧**(read/subscribe/抽屉/列表)。
 * 会咬:谁把建设台账显示加回军机处 → 本断言红。
 * 注:create 侧(saveBuildLedgerEntry/persistBuildLedgerEntry 派发写入)允许保留——它写 SSOT,由工部展示。
 */
const PAGE = join(process.cwd(), 'src/app/(dashboard)/command-center/page.tsx');
const src = readFileSync(PAGE, 'utf8');

// 去掉注释行后再断言(避免迁移说明注释里的词触发误报)。
const code = src
  .split('\n')
  .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('{/*'))
  .join('\n');

const FORBIDDEN_DISPLAY = [
  'BuildLedgerDetailDrawer', // 台账详情抽屉
  'readBuildLedger',          // 读取台账(显示侧)
  'subscribeBuildLedger',     // 订阅台账(显示侧)
  'onLedgerDetail',           // 台账点击展开
  'handleLedgerTransition',   // 台账状态流转(显示侧交互)
  'transitionBuildCase',      // 台账状态流转依赖(显示侧·会审补)
];

for (const marker of FORBIDDEN_DISPLAY) {
  test(`军机处页不含 build-ledger 显示侧: ${marker}`, () => {
    assert.ok(!code.includes(marker), `军机处不应再展示建设台账(${marker});它属工部办公厅(见 JUNJICHU-REFACTOR-PLAN)`);
  });
}
