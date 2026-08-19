import test from 'node:test';
import assert from 'node:assert/strict';
import { htmlToText } from '../../../lib/utils/html';

test('GH-ISSUE-242: htmlToText removes markup and decodes nbsp content', () => {
  assert.equal(
    htmlToText('<p>简介&nbsp;&nbsp;&nbsp;内容</p><br>第二行 &amp; 片段'),
    '简介 内容\n\n第二行 & 片段',
  );
});

test('htmlToText handles numeric, unknown, invalid, and empty entities', () => {
  assert.equal(htmlToText('&#19968;&#x4E8C; &#x1F3AC; &unknown; &#x110000;'), '一二 🎬 &unknown; &#x110000;');
  assert.equal(htmlToText(null), '');
});
