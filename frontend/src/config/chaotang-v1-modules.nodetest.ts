import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHAOTANG_V1_LIUBU,
  CHAOTANG_V1_PRIMARY_MODULES,
  CHAOTANG_V1_ZHUSI,
} from './chaotang-v1-modules.ts';

test('chaotang 1.0 primary modules are the only top-level product modules', () => {
  assert.deepEqual(
    CHAOTANG_V1_PRIMARY_MODULES.map((item) => item.label),
    ['大殿', '上书房', '军机处', '六部', '诸司', '史馆'],
  );
});

test('chaotang 1.0 secondary modules match the requested liubu and zhusi tree', () => {
  assert.deepEqual(
    CHAOTANG_V1_ZHUSI.map((item) => item.name),
    ['锦衣卫'],
  );

  assert.deepEqual(
    Object.fromEntries(CHAOTANG_V1_LIUBU.map((department) => [
      department.name,
      department.offices.map((office) => office.name),
    ])),
    {
      户部: ['预算司', '出纳司'],
      吏部: ['任免司', '招聘司'],
      礼部: [],
      兵部: ['报价司', '线索司'],
      刑部: ['合同司'],
      工部: ['产研司'],
    },
  );

  assert.equal(CHAOTANG_V1_LIUBU.find((item) => item.name === '礼部')?.status, 'pending');
});
