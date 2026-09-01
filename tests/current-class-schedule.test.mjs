import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const html = readFileSync("index.html", "utf8");

function template(id) {
  const match = html.match(new RegExp(`<template id="${id}">([\\s\\S]*?)<\\/template>`));
  assert.ok(match, `找不到 ${id}`);
  return match[1];
}

test("啟蒙班與開智班都顯示最新開課日期與時段", () => {
  for (const id of ["selOpenmindTemplate", "selEarlyTemplate"]) {
    const content = template(id);
    assert.match(content, /10\/15\s*<small>（四）起<\/small>/);
    assert.match(content, /每週四　18:30–19:20/);
    assert.doesNotMatch(content, /8\/28|8\/29|每週五|每週六|18:00–18:50|14:00–14:50/);
  }
});
