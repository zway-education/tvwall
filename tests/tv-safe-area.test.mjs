import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("電視輪播保留 90% 安全畫面", () => {
  assert.match(html, /const\s+TV_SAFE_AREA_SCALE\s*=\s*0\.9\s*;/);
  assert.match(
    html,
    /Math\.min\(window\.innerWidth\s*\/\s*1920,\s*window\.innerHeight\s*\/\s*1080\)\s*\*\s*TV_SAFE_AREA_SCALE/,
  );
});

test("90% 縮放在常見 16:9 電視四周各保留 5% 空間", () => {
  const match = html.match(/const\s+TV_SAFE_AREA_SCALE\s*=\s*(0\.\d+)\s*;/);
  assert.ok(match, "找不到 TV_SAFE_AREA_SCALE");

  const safeScale = Number(match[1]);
  for (const [width, height] of [
    [1280, 720],
    [1920, 1080],
    [3840, 2160],
  ]) {
    const scale = Math.min(width / 1920, height / 1080) * safeScale;
    const horizontalMargin = (width - 1920 * scale) / 2;
    const verticalMargin = (height - 1080 * scale) / 2;

    assert.equal(horizontalMargin, width * 0.05);
    assert.equal(verticalMargin, height * 0.05);
  }
});
