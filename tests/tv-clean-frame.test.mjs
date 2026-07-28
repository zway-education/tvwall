import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("每一頁都不再顯示右下角進度或暫停介面", () => {
  assert.doesNotMatch(html, /class="progress"/);
  assert.doesNotMatch(html, /\.progress(?:\s|\.|\{)/);
  assert.doesNotMatch(html, /\bconst\s+progress\b/);
  assert.doesNotMatch(html, /\blet\s+paused\b/);
  assert.doesNotMatch(html, /\btogglePause\b/);
  assert.doesNotMatch(html, /event\.code\s*===\s*"Space"/);
});

test("響應式安全畫面外圍使用淺色且沒有黑色陰影", () => {
  const pageFrame = html.match(/html,\s*body\s*\{([^}]+)\}/);
  assert.ok(pageFrame, "找不到 html/body 外框樣式");
  assert.match(pageFrame[1], /background:\s*var\(--paper\)\s*;/);

  const stage = html.match(/\.stage\s*\{([^}]+)\}/);
  assert.ok(stage, "找不到 stage 樣式");
  assert.match(stage[1], /box-shadow:\s*none\s*;/);
});
