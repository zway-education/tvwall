import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const html = readFileSync("index.html", "utf8");

function template(id) {
  const match = html.match(new RegExp(`<template id="${id}">([\\s\\S]*?)<\\/template>`));
  assert.ok(match, `找不到 ${id}`);
  return match[1];
}

test("開智班與啟蒙班顯示各自最新時段", () => {
  const openmind = template("selOpenmindTemplate");
  const early = template("selEarlyTemplate");
  for (const content of [openmind, early]) {
    assert.match(content, /10\/15\s*<small>（四）起<\/small>/);
    assert.doesNotMatch(content, /8\/28|8\/29|每週五|每週六|18:30–19:20|14:00–14:50/);
  }
  assert.match(openmind, /每週四　19:00–19:50/);
  assert.match(early, /每週四　18:00–18:50/);
});
