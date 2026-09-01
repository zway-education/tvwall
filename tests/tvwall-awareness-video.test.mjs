import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { test } from "node:test";

const html = readFileSync("index.html", "utf8");

test("adds both current course videos after the SEL pages", () => {
  const awarenessAsset = "assets/awareness-sel-course-intro-quality.mp4";
  const pdcaAsset = "assets/pdca-goal-management-intro-poster.mp4";

  assert.equal(existsSync(awarenessAsset), true, "missing current awareness SEL course video");
  assert.equal(existsSync(pdcaAsset), true, "missing current PDCA course video");
  assert.ok(statSync(awarenessAsset).size > 1_000_000, "awareness SEL course video is unexpectedly small");
  assert.ok(statSync(pdcaAsset).size > 1_000_000, "PDCA course video is unexpectedly small");

  assert.match(html, /src:\s*"\.\/assets\/awareness-sel-course-intro-quality\.mp4\?v=[^"]+"/);
  assert.match(html, /label:\s*"覺知 SEL 課程介紹 1\/2"/);
  assert.match(html, /duration:\s*144000/);
  assert.match(html, /src:\s*"\.\/assets\/pdca-goal-management-intro-poster\.mp4\?v=[^"]+"/);
  assert.match(html, /label:\s*"PDCA 目標管理課程介紹 2\/2"/);
  assert.match(html, /duration:\s*81000/);

  const selPosition = html.indexOf('id: "selCoreTemplate"');
  const awarenessPosition = html.indexOf("awareness-sel-course-intro-quality.mp4");
  const pdcaPosition = html.indexOf("pdca-goal-management-intro-poster.mp4");
  const activityPosition = html.indexOf('id: "activityIntro"');
  assert.ok(selPosition > -1);
  assert.ok(awarenessPosition > selPosition);
  assert.ok(pdcaPosition > awarenessPosition);
  assert.ok(pdcaPosition < activityPosition);
  assert.match(html, /URLSearchParams\(window\.location\.search\)\.get\("start"\)/);
  assert.match(html, /\?\s*startParam\s*:\s*13/);
});

test("resets and plays the awareness video muted only when its slide is active", () => {
  assert.match(html, /video\.currentTime\s*=\s*0/);
  assert.match(html, /video\.muted\s*=\s*true/);
  assert.doesNotMatch(html, /video\.muted\s*=\s*false/);
  assert.match(html, /video\.pause\(\)/);
});

test("loops one shared soundtrack across the entire TV wall", () => {
  assert.match(
    html,
    /<audio[^>]+id="tvSoundtrack"[^>]+src="\.\/assets\/awareness-reel-soundtrack\.m4a\?v=[^"]+"[^>]+autoplay[^>]+loop[^>]+preload="auto"/,
  );
  assert.match(html, /const soundtrack = document\.getElementById\("tvSoundtrack"\)/);
  assert.match(html, /function startSoundtrack\(\)/);
  assert.match(html, /soundtrack\.play\(\)/);
  assert.match(html, /window\.addEventListener\("pointerdown", startSoundtrack\)/);
  assert.match(html, /window\.addEventListener\("keydown", startSoundtrack\)/);
  assert.match(html, /window\.addEventListener\("touchstart", startSoundtrack\)/);
  assert.match(html, /playback\.then\(stopSoundtrackFallbacks\)/);
  assert.doesNotMatch(html, /soundtrack\.(?:pause\(|currentTime\s*=)/);
});
