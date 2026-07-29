import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compositionRoot = path.join(repoRoot, "video-src", "awareness-reel-16x9");
const indexPath = path.join(compositionRoot, "index.html");
const scenesPath = path.join(compositionRoot, "scenes.js");

const expectedIds = [
  "cover",
  "bridge-reminder",
  "pain-focus",
  "pain-delay",
  "pain-restless",
  "pain-homework",
  "pain-conflict",
  "pain-absorb",
  "bridge-awareness",
  "step-observe",
  "step-accept",
  "step-choose",
  "bridge-systems",
  "systems-overview",
  "systems-daily",
  "system-neuroscience",
  "system-management",
  "system-positive-psychology",
  "course-info",
  "cta-close",
  "cta-action",
];

const expectedDurations = [
  4.0, 3.2, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 4.5, 4.8, 4.8, 4.5, 5.8,
  5.8, 7.8, 8.3, 8.3, 8.3, 8.4, 5.3, 7.3,
];

function readComposition() {
  return {
    html: fs.readFileSync(indexPath, "utf8"),
    sceneSource: fs.readFileSync(scenesPath, "utf8"),
  };
}

function loadManifest(sceneSource) {
  const context = vm.createContext({ window: {} });
  new vm.Script(sceneSource, { filename: scenesPath }).runInContext(context);
  return context.window.TV_REEL_SCENES;
}

test("publishes the fixed 1920x1080, 21-scene manifest contract", () => {
  const { html, sceneSource } = readComposition();
  const scenes = loadManifest(sceneSource);

  assert.match(html, /--canvas-width:\s*1920px/);
  assert.match(html, /--canvas-height:\s*1080px/);
  assert.equal((sceneSource.match(/\bduration\s*:/g) ?? []).length, 21);
  assert.equal(scenes.length, 21);
  assert.deepEqual(
    Array.from(scenes, (scene) => scene.id),
    expectedIds,
  );
  assert.deepEqual(
    Array.from(scenes, (scene) => scene.duration),
    expectedDurations,
  );
  assert.equal(
    Number(scenes.reduce((total, scene) => total + scene.duration, 0).toFixed(1)),
    106.1,
  );
});

test("provides five content-specific layout families and static scene routing", () => {
  const { html } = readComposition();

  for (const family of ["cover", "pain", "steps", "systems", "cta"]) {
    assert.match(html, new RegExp(`layout--${family}\\b`));
  }

  assert.match(html, /URLSearchParams/);
  assert.match(html, /params\.get\(["']scene["']\)/);
  assert.match(html, /params\.get\(["']static["']\)\s*===\s*["']1["']/);
  assert.match(html, /setTimeout\(/);
});

test("keeps meaningful type above the 34px body and 28px supporting floors", () => {
  const { html } = readComposition();
  const bodyFloor = Number(html.match(/--text-body:\s*(\d+)px/)?.[1]);
  const supportFloor = Number(html.match(/--text-support:\s*(\d+)px/)?.[1]);
  const explicitSizes = Array.from(
    html.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g),
    (match) => Number(match[1]),
  );

  assert.ok(bodyFloor >= 34, `body floor is ${bodyFloor}px`);
  assert.ok(supportFloor >= 28, `support floor is ${supportFloor}px`);
  assert.ok(explicitSizes.length > 0, "composition should declare explicit video type sizes");
  assert.ok(
    explicitSizes.every((size) => size >= 28),
    `found text below 28px: ${explicitSizes.filter((size) => size < 28).join(", ")}`,
  );
});

test("gives the LINE CTA a 300px+ QR and an explicit white quiet zone", () => {
  const { html, sceneSource } = readComposition();
  const scenes = loadManifest(sceneSource);
  const cta = scenes.find((scene) => scene.id === "cta-action");

  assert.equal(cta.qr, "./assets/line-931irimh.png");
  assert.match(html, /--qr-size:\s*(3\d\d|[4-9]\d\d|\d{4,})px/);
  assert.match(html, /\.qr-quiet-zone\s*\{[^}]*background:\s*#fff(?:fff)?\b/s);
  assert.match(html, /\.qr-quiet-zone\s*\{[^}]*padding:\s*(?:[2-9]\d|1\d{2,})px/s);
});
