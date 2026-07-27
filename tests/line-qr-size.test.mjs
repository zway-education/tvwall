import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function cssBlock(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
  assert.ok(match, `找不到 CSS selector：${selector}`);
  return match[1];
}

test("第 1 頁 LINE QR 放大為 340px", () => {
  assert.match(
    cssBlock(".restored-line-panel--old-1"),
    /--qr-size:\s*340px\s*;/,
  );
});

test("第 5 頁 LINE QR 放大為 360px", () => {
  assert.match(
    cssBlock(".restored-line-panel--old-5"),
    /--qr-size:\s*360px\s*;/,
  );
});

test("兩個活動 QR Code 尺寸保持不變", () => {
  assert.match(cssBlock(".signup-panel img"), /width:\s*320px\s*;/);
  assert.match(cssBlock(".signup-panel img"), /height:\s*320px\s*;/);
  assert.match(cssBlock(".focus-event__qr img"), /width:\s*226px\s*;/);
  assert.match(cssBlock(".focus-event__qr img"), /height:\s*226px\s*;/);
});
