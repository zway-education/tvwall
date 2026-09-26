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

test('released SEL artwork and LINE background resolve from production assets', () => {
  for (const name of ['sel-core-v3', 'sel-assessment-v3', 'sel-course-v3', 'sel-parent-v3', 'sel-openmind-v3', 'sel-early-v3', 'line-editorial-bg-v1']) {
    assert.match(html, new RegExp(`\\./assets/${name}\\.png`));
    assert.ok(existsSync(fileURLToPath(new URL(`assets/${name}.png`, root))));
  }
  assert.doesNotMatch(html, /opendesign\/mockups\/tvwall-original-optimization/);
  assert.match(html, /id: "lineEditorialTemplate", label: "覺知教育 LINE 聯繫"/);
});
