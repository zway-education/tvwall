# 覺知是什麼 Reel 電視牆 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將既有 9:16 Reel 重新排版為真正的 1920×1080 橫式影片，並加入目前正常版電視牆輪播。

**Architecture:** 以 21 幕 manifest 驅動一個獨立的 16:9 HTML composition，依封面、痛點、步驟、系統、課程／CTA 五種 layout family 重排原始文字與插圖。先將 composition 輸出為 H.264/AAC MP4，再將影片作為一個有獨立停留時間的 scene 接入現有 `index.html`，保留原六頁與智慧電視 viewport 縮放。

**Tech Stack:** HTML/CSS/JavaScript、Node.js test runner、Chromium/Playwright、FFmpeg/ffprobe、GitHub Pages。

## Global Constraints

- 基準必須是 `main` 的 `8f7989b5`；不得帶入 2026-07-28 content-led 預覽改版。
- 輸出必須為 1920×1080、H.264、30fps、`yuv420p`、AAC。
- 使用正式版影片既有音訊軌，影片長度以實際音訊／影片長度為準。
- 畫面不得有黑框、上下黑邊、文字溢位、中文孤字或人物裁切。
- 主要內文目標至少 34px，補充資訊至少 28px，重要內容位於 5% 安全區。
- 現有六頁內容、圖片、順序、靜態頁停留時間與智慧電視縮放規則不得變更。
- 影片輸出目標小於 80 MB，且不得超過 GitHub 單檔限制。

---

### Task 1: 建立 21 幕 16:9 composition

**Files:**
- Create: `video-src/awareness-reel-16x9/index.html`
- Create: `video-src/awareness-reel-16x9/scenes.js`
- Create: `video-src/awareness-reel-16x9/assets/`
- Test: `tests/awareness-reel-16x9.test.mjs`

**Interfaces:**
- Consumes: 原始 Reel 的 21 幕順序、每幕秒數、正式文字、品牌 logo、插圖、字型與 LINE QR。
- Produces: `window.TV_REEL_SCENES` scene manifest，以及支援 `?scene=<0..20>&static=1` 的 1920×1080 composition。

- [ ] **Step 1: 寫出會失敗的 composition 結構測試**

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("video-src/awareness-reel-16x9/index.html", "utf8");
const scenes = fs.readFileSync("video-src/awareness-reel-16x9/scenes.js", "utf8");

test("composition is a true 1920x1080 canvas with 21 scenes", () => {
  assert.match(html, /--canvas-width:\s*1920px/);
  assert.match(html, /--canvas-height:\s*1080px/);
  assert.match(scenes, /window\.TV_REEL_SCENES\s*=/);
  assert.equal((scenes.match(/duration:/g) || []).length, 21);
});

test("five content-specific layout families exist", () => {
  for (const family of ["cover", "pain", "steps", "systems", "cta"]) {
    assert.match(html, new RegExp(`layout--${family}`));
  }
});
```

- [ ] **Step 2: 執行測試並確認 RED**

Run: `node --test tests/awareness-reel-16x9.test.mjs`

Expected: FAIL，因為 composition 檔案尚未建立。

- [ ] **Step 3: 建立 scene manifest**

`scenes.js` 的每筆 scene 使用固定介面：

```js
{
  id: "pain-focus",
  family: "pain",
  duration: 2.5,
  eyebrow: "你也常有這些困惑嗎？",
  title: ["孩子為什麼", "總是無法專心？"],
  body: ["不是孩子故意不配合", "而是還沒看見內在發生了什麼"],
  image: "./assets/pain-focus.png",
  accent: "blue"
}
```

21 幕順序與秒數逐筆抄錄原正式 composition；文字必須使用原始 UTF-8 正文，不得從終端亂碼複製。

Manifest 的固定順序與秒數如下，總長 106.1 秒：

| Index | ID | Family | 秒數 |
|---:|---|---|---:|
| 0 | `cover` | cover | 4.0 |
| 1 | `bridge-reminder` | cover | 3.2 |
| 2 | `pain-focus` | pain | 2.5 |
| 3 | `pain-delay` | pain | 2.5 |
| 4 | `pain-restless` | pain | 2.5 |
| 5 | `pain-homework` | pain | 2.5 |
| 6 | `pain-conflict` | pain | 2.5 |
| 7 | `pain-absorb` | pain | 2.5 |
| 8 | `bridge-awareness` | cover | 4.5 |
| 9 | `step-observe` | steps | 4.8 |
| 10 | `step-accept` | steps | 4.8 |
| 11 | `step-choose` | steps | 4.5 |
| 12 | `bridge-systems` | cover | 5.8 |
| 13 | `systems-overview` | systems | 5.8 |
| 14 | `systems-daily` | systems | 7.8 |
| 15 | `system-neuroscience` | systems | 8.3 |
| 16 | `system-management` | systems | 8.3 |
| 17 | `system-positive-psychology` | systems | 8.3 |
| 18 | `course-info` | cta | 8.4 |
| 19 | `cta-close` | cta | 5.3 |
| 20 | `cta-action` | cta | 7.3 |

- [ ] **Step 4: 建立五種橫式 layout family**

`index.html` 必須包含：

```css
:root { --canvas-width: 1920px; --canvas-height: 1080px; }
.canvas { width: var(--canvas-width); height: var(--canvas-height); overflow: hidden; }
.safe { position: absolute; inset: 54px 96px; }
.layout--cover,
.layout--pain,
.layout--steps,
.layout--systems,
.layout--cta { position: absolute; inset: 0; }
```

- 封面／過橋：標題左、插圖右。
- 痛點：問題與關鍵詞左、情境插圖右。
- 三步驟：橫向流程，當頁重點放大。
- 三大系統：主題資訊與代表插圖雙欄。
- 課程／CTA：橫向卡片與至少 300px QR。

每幕透過 `?scene=` 單獨顯示；未提供 `static=1` 時依 manifest 秒數自動前進。

- [ ] **Step 5: 複製實際使用的品牌素材**

只複製 manifest 引用的 logo、21 幕插圖、兩個字型與 LINE QR 到 `video-src/awareness-reel-16x9/assets/`。不得複製未使用的 QA 暫存圖或舊版封面。

- [ ] **Step 6: 執行測試並確認 GREEN**

Run: `node --test tests/awareness-reel-16x9.test.mjs`

Expected: PASS，21 幕、五種 family、1920×1080、字級與 QR 規則全部通過。

- [ ] **Step 7: Commit**

```bash
git add video-src/awareness-reel-16x9 tests/awareness-reel-16x9.test.mjs
git commit -m "feat: add 16x9 awareness reel composition"
```

---

### Task 2: 輸出 1920×1080 MP4 與視覺證據

**Files:**
- Create: `scripts/render-awareness-reel-16x9.mjs`
- Create: `assets/awareness-reel-16x9.mp4`
- Create: `review/awareness-reel-16x9-contact-sheet.png`
- Create: `review/awareness-reel-16x9-ffprobe.json`
- Test: `tests/awareness-reel-output.test.mjs`

**Interfaces:**
- Consumes: Task 1 composition、原正式版 MP4 的音訊軌。
- Produces: 可由 GitHub Pages 與智慧電視直接播放的 `assets/awareness-reel-16x9.mp4`。

- [ ] **Step 1: 寫輸出規格的失敗測試**

```js
test("rendered file is TV-safe H.264/AAC", () => {
  const report = JSON.parse(fs.readFileSync("review/awareness-reel-16x9-ffprobe.json", "utf8"));
  const video = report.streams.find((stream) => stream.codec_type === "video");
  const audio = report.streams.find((stream) => stream.codec_type === "audio");
  assert.deepEqual([video.width, video.height], [1920, 1080]);
  assert.equal(video.codec_name, "h264");
  assert.equal(video.pix_fmt, "yuv420p");
  assert.equal(video.r_frame_rate, "30/1");
  assert.equal(audio.codec_name, "aac");
  assert.ok(Number(report.format.size) < 80 * 1024 * 1024);
});
```

- [ ] **Step 2: 執行測試並確認 RED**

Run: `node --test tests/awareness-reel-output.test.mjs`

Expected: FAIL，因為 MP4 與 ffprobe report 尚未建立。

- [ ] **Step 3: 建立 frame render script**

`render-awareness-reel-16x9.mjs`：

- 啟動本機靜態伺服器。
- 以 Chromium 1920×1080 逐幀開啟 composition。
- 依 manifest duration，以 30fps 輸出 PNG frame。
- 使用 FFmpeg 編碼無聲 H.264 master。
- 從正式版 MP4 取出既有 AAC 音訊，與 master mux。
- 使用 `-c:v libx264 -pix_fmt yuv420p -r 30 -movflags +faststart`。

- [ ] **Step 4: 產生 contact sheet 與 ffprobe report**

從封面、痛點、三步驟、三大系統、課程資訊、CTA 六個代表時間點擷取畫面，組成 3×2 contact sheet。執行：

```powershell
ffprobe -v error -show_streams -show_format -of json assets/awareness-reel-16x9.mp4 > review/awareness-reel-16x9-ffprobe.json
```

- [ ] **Step 5: 執行輸出測試並確認 GREEN**

Run: `node --test tests/awareness-reel-output.test.mjs`

Expected: PASS，且影片小於 80 MB。

- [ ] **Step 6: Commit**

```bash
git add scripts/render-awareness-reel-16x9.mjs assets/awareness-reel-16x9.mp4 review/awareness-reel-16x9-contact-sheet.png review/awareness-reel-16x9-ffprobe.json tests/awareness-reel-output.test.mjs
git commit -m "feat: render awareness reel for TV wall"
```

---

### Task 3: 將影片 scene 加入正常版輪播

**Files:**
- Modify: `index.html`
- Test: `tests/awareness-reel-carousel.test.mjs`

**Interfaces:**
- Consumes: `assets/awareness-reel-16x9.mp4`。
- Produces: 放在課程核心後方、可自動播放與結束切頁的 `.scene--reel`。

- [ ] **Step 1: 寫輪播整合的失敗測試**

```js
test("awareness reel is inserted after the core scene", () => {
  assert.match(html, /scene--core[\s\S]*scene--reel[\s\S]*scene--assessment/);
  assert.match(html, /assets\/awareness-reel-16x9\.mp4/);
});

test("video scene owns its duration and lifecycle", () => {
  assert.match(html, /data-duration-ms="106100"/);
  assert.match(html, /reelVideo\.currentTime\s*=\s*0/);
  assert.match(html, /reelVideo\.pause\(\)/);
  assert.match(html, /reelVideo\.addEventListener\("ended"/);
});
```

- [ ] **Step 2: 執行測試並確認 RED**

Run: `node --test tests/awareness-reel-carousel.test.mjs`

Expected: FAIL，因為影片 scene 尚未加入。

- [ ] **Step 3: 加入滿版影片 scene**

在 `.scene--core` 後加入：

```html
<article class="scene scene--reel" data-scene="1" data-duration-ms="106100" aria-hidden="true">
  <video id="awarenessReel" preload="metadata" playsinline>
    <source src="assets/awareness-reel-16x9.mp4" type="video/mp4">
  </video>
</article>
```

影片使用 `width:100%; height:100%; object-fit:cover;`；由於影片本身已是 16:9，不會裁切或產生黑框。

- [ ] **Step 4: 改為 per-scene duration 與 video lifecycle**

- 靜態 scene 沿用現有 duration。
- 影片 scene 使用 `data-duration-ms`。
- 進入影片時設 `currentTime = 0` 並呼叫 `play()`。
- 有聲播放被拒絕時，設定 `muted = true` 後重試。
- 離開時呼叫 `pause()` 並歸零。
- `ended` 事件立即進入下一頁，不再額外等待。
- 重新編號後更新六個 pager 的 `data-go`，影片 scene 不新增可見控制器。

- [ ] **Step 5: 執行輪播測試並確認 GREEN**

Run: `node --test tests/awareness-reel-carousel.test.mjs`

Expected: PASS。

- [ ] **Step 6: 執行全部測試**

Run: `node --test tests/*.test.mjs`

Expected: 全部 PASS，原有智慧電視、QR、8/15 場次與無控制器測試仍通過。

- [ ] **Step 7: Commit**

```bash
git add index.html tests/awareness-reel-carousel.test.mjs
git commit -m "feat: add awareness reel to TV carousel"
```

---

### Task 4: 智慧電視整合驗收

**Files:**
- Create: `review/awareness-reel-tvwall-qa.md`
- Create: `review/awareness-reel-tvwall-1920x1080.png`
- Create: `review/awareness-reel-tvwall-1280x720.png`
- Create: `review/awareness-reel-tvwall-1280x800.png`

**Interfaces:**
- Consumes: 完整 `index.html` 與影片資產。
- Produces: 可直接審查的尺寸、播放、切頁、可讀性與 QR 證據。

- [ ] **Step 1: 啟動本機預覽並驗證三種 viewport**

依序使用 1920×1080、1280×720、1280×800 開啟新增影片頁，確認 stage 等比、沒有黑框、沒有 overflow，擷取三張截圖。

- [ ] **Step 2: 驗證播放與切頁**

以瀏覽器讀取：

```js
{
  readyState: video.readyState,
  duration: video.duration,
  videoWidth: video.videoWidth,
  videoHeight: video.videoHeight,
  currentScene: document.querySelector(".scene.is-active")?.dataset.scene
}
```

確認：

- 影片 intrinsic size 為 1920×1080。
- 進入 scene 從 0 秒開始。
- 暫停／離開後歸零。
- `ended` 後切到下一個 scene。
- Console 無 error。

- [ ] **Step 3: 視覺檢查代表幀**

檢查 Task 2 contact sheet：

- 21 幕沒有直式畫面直接縮小置中。
- 五種 family 依內容有不同構圖。
- 標題、內文、補充文字有明確尺寸層級。
- 人物、插圖、日期、QR 不裁切。
- 中文沒有孤字或不合理換行。

- [ ] **Step 4: 確認 production scope**

Run:

```powershell
git diff 8f7989b5 --stat
git diff 8f7989b5 -- index.html
git diff --check
node --test tests/*.test.mjs
```

確認差異只包含新 composition、輸出影片、測試／QA 證據，以及 `index.html` 必要的影片 scene／lifecycle。

- [ ] **Step 5: 寫 QA 報告並 Commit**

```bash
git add review/awareness-reel-tvwall-qa.md review/awareness-reel-tvwall-1920x1080.png review/awareness-reel-tvwall-1280x720.png review/awareness-reel-tvwall-1280x800.png
git commit -m "test: verify awareness reel on TV wall"
```
