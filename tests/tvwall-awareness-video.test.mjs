import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const html = readFileSync("index.html", "utf8");

test("adds the awareness Reel as a timed video slide after the SEL pages", () => {
  assert.match(html, /kind:\s*"video"/);
  assert.match(html, /src:\s*"\.\/assets\/awareness-reel-16x9\.mp4\?v=[^"]+"/);
  assert.match(html, /label:\s*"覺知 SEL 影片 1\/1"/);
  assert.match(html, /duration:\s*106100/);

  const selPosition = html.indexOf("...Array.from({ length: 6 }");
  const videoPosition = html.indexOf('kind: "video"');
  const activityPosition = html.indexOf('id: "activityIntro"');
  assert.ok(selPosition > -1);
  assert.ok(videoPosition > selPosition);
  assert.ok(videoPosition < activityPosition);
  assert.match(html, /URLSearchParams\(window\.location\.search\)\.get\("start"\)/);
  assert.match(html, /\?\s*startParam\s*:\s*12/);
});

test("resets and plays the awareness video only when its slide is active", () => {
  assert.match(html, /video\.currentTime\s*=\s*0/);
  assert.match(html, /video\.muted\s*=\s*false/);
  assert.match(html, /playback\.catch/);
  assert.match(html, /video\.muted\s*=\s*true/);
  assert.match(html, /video\.pause\(\)/);
});
