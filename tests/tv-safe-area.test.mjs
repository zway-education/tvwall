import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("電視輪播使用 95% 響應式安全比例", () => {
  assert.match(html, /const\s+TV_SAFE_AREA_SCALE\s*=\s*0\.95\s*;/);
  assert.match(
    html,
    /Math\.min\(window\.innerWidth\s*\/\s*1920,\s*window\.innerHeight\s*\/\s*1080\)\s*\*\s*TV_SAFE_AREA_SCALE/,
  );
});

test("95% 響應式縮放在常見電視尺寸保留一致安全區且不溢出", () => {
  const match = html.match(/const\s+TV_SAFE_AREA_SCALE\s*=\s*(\d+(?:\.\d+)?)\s*;/);
  assert.ok(match, "找不到 TV_SAFE_AREA_SCALE");

  const safeScale = Number(match[1]);
  for (const [width, height] of [
    [1280, 720],
    [1366, 768],
    [1280, 800],
    [1920, 1080],
    [3840, 2160],
  ]) {
    const fittedScale = Math.min(width / 1920, height / 1080);
    const scale = fittedScale * safeScale;
    const stageWidth = 1920 * scale;
    const stageHeight = 1080 * scale;

    assert.ok(stageWidth <= width);
    assert.ok(stageHeight <= height);
    assert.ok(Math.abs(scale / fittedScale - 0.95) < 1e-9);
  }
});
