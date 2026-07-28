import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("智慧電視使用與舊綠色版一致的實際 viewport 容器", () => {
  assert.match(
    html,
    /<meta\s+name="viewport"\s+content="width=device-width,\s*initial-scale=1,\s*user-scalable=no">/,
  );
  assert.match(html, /class="tv-viewport"\s+id="tvViewport"/);
  assert.match(html, /class="stage-frame"\s+id="stageFrame"/);
  assert.doesNotMatch(html, /TV_SAFE_AREA_SCALE/);
  assert.doesNotMatch(html, /margin-top:\s*-540px/);
  assert.doesNotMatch(html, /margin-left:\s*-960px/);
  assert.doesNotMatch(html, /transform-origin:\s*center/);
});

test("畫布依實際 viewport 等比縮放並由實體 frame 承接尺寸", () => {
  assert.match(html, /const\s+viewport\s*=\s*document\.getElementById\("tvViewport"\)/);
  assert.match(html, /const\s+stageFrame\s*=\s*document\.getElementById\("stageFrame"\)/);
  assert.match(html, /const\s+viewportWidth\s*=\s*viewport\.clientWidth/);
  assert.match(html, /const\s+viewportHeight\s*=\s*viewport\.clientHeight/);
  assert.match(
    html,
    /Math\.min\(viewportWidth\s*\/\s*1920,\s*viewportHeight\s*\/\s*1080\)/,
  );
  assert.match(html, /stageFrame\.style\.width\s*=\s*`\$\{1920\s*\*\s*scale\}px`/);
  assert.match(html, /stageFrame\.style\.height\s*=\s*`\$\{1080\s*\*\s*scale\}px`/);
  assert.match(html, /transform-origin:\s*top left/);
  assert.match(html, /window\.addEventListener\("resize",\s*fit\)/);
  assert.match(html, /window\.addEventListener\("orientationchange",\s*fit\)/);

  for (const [width, height] of [
    [1280, 720],
    [1366, 768],
    [1280, 800],
    [1920, 1080],
    [3840, 2160],
  ]) {
    const scale = Math.min(width / 1920, height / 1080);
    const stageWidth = 1920 * scale;
    const stageHeight = 1080 * scale;

    assert.ok(stageWidth <= width);
    assert.ok(stageHeight <= height);
    assert.ok(Math.abs(stageWidth / stageHeight - 16 / 9) < 1e-9);
  }
});
