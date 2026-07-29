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

function runPlayerUntil(html, scenes, targetTimeMs, search = "") {
  const inlineScript = Array.from(
    html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g),
    (match) => match[1],
  ).findLast((source) => source.trim());
  assert.ok(inlineScript, "player inline script should exist");

  let now = 0;
  let nextTimerId = 1;
  const cancelledTimers = new Set();
  const timers = [];
  const renders = [];
  const stageClasses = new Set();
  const stageDataset = {};
  const stageStyles = new Map();
  let stageMarkup = "";
  const stage = {
    classList: {
      add: (...names) => names.forEach((name) => stageClasses.add(name)),
      remove: (...names) => names.forEach((name) => stageClasses.delete(name)),
    },
    dataset: stageDataset,
    style: {
      setProperty: (name, value) => stageStyles.set(name, value),
    },
  };
  Object.defineProperty(stage, "innerHTML", {
    get: () => stageMarkup,
    set: (markup) => {
      stageMarkup = markup;
      const id = markup.match(/\bdata-scene="([^"]+)"/)?.[1];
      if (id) renders.push({ id, at: now, markup });
    },
  });

  const fakeWindow = {
    TV_REEL_SCENES: scenes,
    location: { search },
    innerWidth: 1920,
    innerHeight: 1080,
    addEventListener() {},
    clearTimeout(id) {
      cancelledTimers.add(id);
    },
    setTimeout(callback, delay = 0) {
      const id = nextTimerId++;
      timers.push({ id, at: now + Number(delay), callback });
      return id;
    },
  };
  const fakeDocument = {
    body: { classList: { toggle() {} } },
    getElementById: (id) => (id === "stage" ? stage : null),
    title: "",
  };
  const context = vm.createContext({
    document: fakeDocument,
    URLSearchParams,
    window: fakeWindow,
  });
  new vm.Script(inlineScript, { filename: indexPath }).runInContext(context);

  while (true) {
    const nextTimer = timers
      .filter((timer) => !cancelledTimers.has(timer.id) && timer.at <= targetTimeMs)
      .sort((a, b) => a.at - b.at || a.id - b.id)[0];
    if (!nextTimer) break;
    cancelledTimers.add(nextTimer.id);
    now = nextTimer.at;
    nextTimer.callback();
  }
  now = targetTimeMs;

  return {
    renders,
    stageMarkup,
    player: fakeWindow.TV_REEL_PLAYER,
    stageClasses,
    stageDataset,
    stageStyles,
  };
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

test("advances at manifest boundaries and loops at exactly 106.1 seconds", () => {
  const { html, sceneSource } = readComposition();
  const scenes = loadManifest(sceneSource);
  const { renders, player } = runPlayerUntil(html, scenes, 106_100);
  const expectedRenders = [
    ["cover", 0],
    ["bridge-reminder", 4_000],
    ["pain-focus", 7_200],
    ["pain-delay", 9_700],
    ["pain-restless", 12_200],
    ["pain-homework", 14_700],
    ["pain-conflict", 17_200],
    ["pain-absorb", 19_700],
    ["bridge-awareness", 22_200],
    ["step-observe", 26_700],
    ["step-accept", 31_500],
    ["step-choose", 36_300],
    ["bridge-systems", 40_800],
    ["systems-overview", 46_600],
    ["systems-daily", 52_400],
    ["system-neuroscience", 60_200],
    ["system-management", 68_500],
    ["system-positive-psychology", 76_800],
    ["course-info", 85_100],
    ["cta-close", 93_500],
    ["cta-action", 98_800],
    ["cover", 106_100],
  ];

  assert.equal(player.totalDuration, 106.1);
  assert.deepEqual(
    renders.map(({ id, at }) => [id, at]),
    expectedRenders,
  );
});

test("uses the original content-aware delay transition before the next pain scene", () => {
  const { html, sceneSource } = readComposition();
  const scenes = loadManifest(sceneSource);
  const { stageClasses, stageDataset, stageStyles } = runPlayerUntil(
    html,
    scenes,
    1_900,
    "?scene=2",
  );

  assert.equal(stageDataset.transition, "delay-lag");
  assert.equal(stageStyles.get("--wipe-duration"), "1300ms");
  assert.equal(stageClasses.has("is-transitioning"), true);
});

test("keeps scene count and duration review metadata off the formal canvas", () => {
  const { html, sceneSource } = readComposition();
  const scenes = loadManifest(sceneSource);
  const { stageMarkup } = runPlayerUntil(html, scenes, 0, "?scene=0&static=1");

  assert.doesNotMatch(stageMarkup, /\bscene-meta\b/);
  assert.doesNotMatch(stageMarkup, /\b0?1\s*\/\s*21\b/);
  assert.doesNotMatch(stageMarkup, /\b4\.0\s*秒\b/);
  assert.doesNotMatch(stageMarkup, /播放資訊/);
});

test("uses no invented eyebrow copy on scenes without a formal source eyebrow", () => {
  const { sceneSource } = readComposition();
  const scenes = loadManifest(sceneSource);
  const scenesWithoutFormalEyebrows = [
    "bridge-reminder",
    "bridge-awareness",
    "step-observe",
    "step-accept",
    "step-choose",
    "bridge-systems",
    "cta-close",
  ];
  const inventedCopy = [
    "從日常裡的卡住開始",
    "看見行為背後的提醒",
    "覺知的三個步驟",
    "把覺知帶進真實生活",
    "從理解開始，陪孩子練習",
  ];

  for (const id of scenesWithoutFormalEyebrows) {
    assert.equal(scenes.find((scene) => scene.id === id)?.eyebrow, undefined, id);
  }
  for (const copy of inventedCopy) {
    assert.doesNotMatch(sceneSource, new RegExp(copy));
  }
});
