import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("開智班試上課程顯示三個最新場次", () => {
  const facts = html.match(
    /<div class="focus-event__facts">([\s\S]*?)<\/div>\s*<a class="focus-event__qr"/,
  );

  assert.ok(facts, "找不到開智班試上課程資訊區");
  assert.match(facts[1], /2026\/8\/29（六）、9\/5（六）、9\/12（六）/);
  assert.match(facts[1], /14:00–14:50/);
  assert.match(facts[1], /高雄市鼓山區美術東三路 86 號/);
});
