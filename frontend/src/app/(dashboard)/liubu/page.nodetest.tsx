import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

import LiubuPage from './page.tsx';

test('六部 hub 渲染礼部工作台入口', () => {
  const markup = renderToStaticMarkup(<LiubuPage />);

  assert.match(markup, /href="\/liubu\/libu_rites"/);
});
