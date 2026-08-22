import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const verticalHtml = readFileSync(new URL("../vertical.html", import.meta.url), "utf8");

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

test("舊截圖內嵌的播放狀態會由乾淨底部遮罩移除", () => {
  assert.match(html, /\.slide--captured-controls::after\s*\{[^}]*bottom:\s*0[^}]*height:\s*58px[^}]*background:/s);
  assert.match(html, /item\.src\.startsWith\("\.\/new-"\)[\s\S]*slide\.classList\.add\("slide--captured-controls"\)/);
});

test("直式頁不再顯示控制列，也不能由空白鍵誤觸暫停", () => {
  assert.match(verticalHtml, /\.progress,\s*\.controls\s*\{\s*display:\s*none\s*!important;\s*\}/);
  assert.doesNotMatch(verticalHtml, /if\s*\(e\.key\s*===\s*['"]\s['"]\)/);
});
