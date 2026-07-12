import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('军机处与大殿不再导航或预取已退役页面', () => {
  const activeSources = [
    read('../../../app/(dashboard)/junjichu/page.tsx'),
    read('../../dadian/components/BottomBar.tsx'),
    read('../../dadian/components/ChancellorTodayCard.tsx'),
    read('../../dadian/lib/dadian.ts'),
  ].join('\n');
  assert.doesNotMatch(activeSources, /['"]\/court-briefing(?:[?'"])/);
  assert.doesNotMatch(activeSources, /['"]\/archive(?:[?'"])/);
});

test('Next Link 与 router.push 不手工重复拼 basePath', () => {
  const sources = [
    read('../../departments/components/DepartmentPageViewShell.tsx'),
    read('../../departments/components/HubuBudgetCaseBody.tsx'),
  ].join('\n');
  assert.doesNotMatch(sources, /withBasePath\(`?\/liubu\/hubu/);
});
