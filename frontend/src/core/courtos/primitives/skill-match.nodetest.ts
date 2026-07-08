import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skillMatch, skillsHave } from './skill-match.ts';
test('磷酸铁锂=锂电(同义)', () => { assert.equal(skillMatch('磷酸铁锂', '锂电'), true); });
test('BMS=电池管理系统', () => { assert.equal(skillMatch('电池管理系统', 'BMS'), true); });
test('无关→不匹配', () => { assert.equal(skillMatch('java', '锂电'), false); });
test('skillsHave', () => { assert.equal(skillsHave(['磷酸铁锂PACK'], '锂电'), true); });
