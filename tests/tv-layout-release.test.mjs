import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');

test('production entry loads the approved layout stylesheet and enhancement script', () => {
  assert.match(html, /<link rel="stylesheet" href="\.\/assets\/tv-layout\.css\?v=20260912-layout">/);
  assert.match(html, /<script src="\.\/js\/tv-layout\.js\?v=20260912-layout"><\/script>/);
  assert.ok(existsSync(fileURLToPath(new URL('assets/tv-layout.css', root))));
  assert.ok(existsSync(fileURLToPath(new URL('js/tv-layout.js', root))));
});

test('production remains a direct auto-playing entry and retains the no-photo video', () => {
  assert.match(html, /<title>K12 電視牆<\/title>/);
  assert.doesNotMatch(html, /document\.write|fetch\(['"]\.\.\/\.\.\/\.\.\/index\.html|get\(['"]still['"]\)/);
  assert.match(html, /awareness-sel-course-intro-quality\.mp4\?v=20260912-photo-free/);
  assert.match(html, /show\(current\);/);
});
