import test from 'node:test';
import assert from 'node:assert/strict';
import { htmlToText } from '@/lib/utils/html';

test('htmlToText removes markup, decodes entities, and preserves meaningful breaks', () => {
  assert.equal(
    htmlToText('<p>更新&nbsp;&nbsp;至&nbsp;12集</p><br><div>下一段 &amp; 片段</div>'),
    '更新 至 12集\n\n下一段 & 片段',
  );
});

test('htmlToText decodes numeric entities and leaves invalid or unknown entities unchanged', () => {
  assert.equal(
    htmlToText('&#19968;&#x4E8C; &#x1F3AC; &unknown; &#x110000;'),
    '一二 🎬 &unknown; &#x110000;',
  );
});

test('htmlToText normalizes empty and whitespace-only input', () => {
  assert.equal(htmlToText(null), '');
  assert.equal(htmlToText(''), '');
  assert.equal(htmlToText('  <p>  内容  </p>\n\n\n'), '内容');
});
