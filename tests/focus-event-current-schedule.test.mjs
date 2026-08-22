import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const focusEvent = html.match(/<template id="focusEvent">([\s\S]*?)<\/template>/)?.[1] ?? "";

test("開智班試上課程顯示三個正確場次", () => {
  assert.match(focusEvent, /開智班試上課程/);
  assert.match(focusEvent, /2026\/8\/29（六）、9\/5（六）、9\/12（六）/);
  assert.match(focusEvent, /14:00–14:50/);
});

test("開智班試上課程不再顯示已過期場次", () => {
  assert.doesNotMatch(focusEvent, /2026\/8\/1/);
  assert.doesNotMatch(focusEvent, /2026\/8\/15/);
});

test("使用網頁版 GPT 重新設計的開智班試上課程海報", () => {
  assert.match(focusEvent, /src="\.\/focus-event-poster-20260829-gpt\.png"/);
  assert.doesNotMatch(focusEvent, /focus-event__poster-update/);
  assert.doesNotMatch(focusEvent, /focus-event__poster-qr-mask/);
});

test("活動文字使用具體內容，不使用禁用的練習包裝", () => {
  assert.doesNotMatch(focusEvent, /專注練習|練習把/);
  assert.match(focusEvent, /目標管理 × 專注投入/);
});
