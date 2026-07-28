import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("親子成長體驗活動顯示 8/1 與 8/15 兩個新增場次", () => {
  const facts = html.match(
    /<div class="focus-event__facts">([\s\S]*?)<\/div>\s*<a class="focus-event__qr"/,
  );

  assert.ok(facts, "找不到親子成長體驗活動資訊區");
  assert.match(facts[1], /2026\/8\/1（六）15:00–17:00/);
  assert.match(facts[1], /2026\/8\/15（六）14:00、16:00 兩場/);
  assert.match(facts[1], /高雄市鼓山區美術東三路 86 號/);
});
