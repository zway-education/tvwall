# 給未來 Claude 看的 ・ 櫃檯電視牆專案說明

> 本檔幫助下次接手的 Claude 在 30 秒內理解整套系統。

---

## 一句話:這是什麼

K12覺知素養教育學苑櫃檯電視牆,**Chrome kiosk + 雲端同步**。
7 張 slide 自動輪播,招生用。**單一入口 `index.html`** 內含「播放模式」與「工程師編輯模式」,Apps Script + Google Sheet 當後端,30 秒同步到櫃檯電視。

## v1 → v2 → v3 演進

- **v1 (本機版)**:設定存 localStorage,單裝置可改
- **v2 (雲端版)**:Apps Script + Sheet 後端,手機/電腦/電視都同步
- **v3 (統一入口版,本檔描述)**:`index.html` 整合成單一入口 — PLAY + EDIT 兩模式、雙方向自動偵測、工程師長按入口。`vertical.html`/`edit.html` 改為轉址
- 三版相容:若 `cloud_config.js` URL 未填,自動降級為本機模式

## v3 統一入口架構(重點)

- **單一入口**:kiosk、手機 PWA、編輯都開 `index.html`
- **起始畫面**(開啟即見,`#landing`):兩個按鈕「▶ 播放電視牆」「🔧 進入後台」
  - **10 秒無操作 → 自動進播放**(kiosk 友善;起始畫面上有互動會重置 10 秒)
  - `embedded=1` 時起始畫面立即隱藏(EDIT 預覽 iframe 直接播放)
- **PLAY 模式**:7 張 slide 輪播,公眾看到的
- **進入 EDIT 模式**(工程師)兩條路,都要密碼 **`63811`**:
  - 起始畫面點「🔧 進入後台」→ 數字鍵盤
  - PLAY 模式中**長按 LOGO 3 秒**(隱藏手勢,公眾不知道)→ 數字鍵盤
  - 密碼常數 `ENGINEER_PASSCODE` 在 index.html 的 `<script>` 內
- **EDIT 模式**:左預覽嵌 `index.html?embedded=1`、右表單嵌 `admin.html`
  - 10 秒無操作自動退回 PLAY(第 7 秒先跳「還在編輯嗎?」警告)
  - `embedded=1` 時停用起始畫面 + 工程師入口(避免遞迴)
  - EDIT 模式選版型/配色/方向 → 左預覽**即時套用**(postMessage,不用儲存)
- **方向自動偵測**:依螢幕長寬比自動選橫/直式;後台 `orientation` 欄位可強制覆蓋(`auto`/`horizontal`/`vertical`)。index.html 內含完整 `body[data-orient="vertical"]` 直式 CSS
- **設計**:slide 轉場 1.1s cubic-bezier;有背景圖的 slide 跑 Ken Burns 緩慢推近(`::before` scale 動畫)

## 完整檔案結構

```
電視牆/
├── index.html                    🔧 統一入口 ・ PLAY + EDIT 兩模式 ・ 雙方向 ・ 工程師入口
├── admin.html                    後台表單 ・ EDIT 模式右側 iframe 嵌入 ・ 也可單獨開
├── defaults.js                   預設值(含 orientation 欄位)+ 智慧載入
├── cloud_config.js               Apps Script URL + API Key
├── manifest.json                 PWA manifest(start_url 指向 index.html)
├── vertical.html                 ⮕ 轉址到 index.html(直式已整合,保留不破壞舊書籤)
├── edit.html                     ⮕ 轉址到 index.html(EDIT 模式已取代)
├── icon.svg / icon-gen.html       PWA icon 源碼 + 一次性產生工具
├── icon-192.png / 512 / 180       PWA icons
├── 維護說明.html / 雲端設定步驟.html  使用者指南
├── README.md                     Markdown 維護指南
├── CLAUDE.md                     本檔
└── cloud_setup/
    └── tvwall_api.gs             Apps Script 程式碼(v3 ・ 圖片多格 chunking 儲存)
```

## 雲端架構

```
📱 手機 ・ 💻 電腦 ・ 🖥 櫃檯電視
   ↑↓ HTTPS
☁️ Apps Script Web App
   ↑↓
📊 Google Sheet "tvwall_config" (KWJ 私人 Drive)
   ├── config 工作表(B2 = JSON config 字串)
   └── log 工作表(每次儲存追加一行)
```

## 設定流程(由 KWJ 執行,看 `雲端設定步驟.html`)

1. Google Drive 建 Sheet「tvwall_config」(用 oscar19960613@gmail.com ・ KWJ 個人帳號)
2. Sheet → 擴充功能 → Apps Script → 貼 `cloud_setup/tvwall_api.gs` → 跑 initialize → 部署 Web App
3. 把得到的 URL 貼進 `cloud_config.js` 的 `url` 欄位
4. 跑 `icon-gen.html` 產 PNG icons(放回 電視牆/)
5. 本機測試:admin.html 改內容 → index.html 看到自動更新
6. 推到 GitHub(repo: `zway-education/tvwall`)
7. GitHub Pages 啟用 → URL: `https://zway-education.github.io/tvwall/`
8. 手機 Safari/Chrome 開 admin URL → 加到主畫面(PWA 安裝)
9. 櫃檯 Mini PC 設 Chrome kiosk 啟動指向 GitHub Pages

## API 規格(tvwall_api.gs)

- **API_KEY** (在 .gs 內常數):`tvw_K12_AwarenessSEL_2026_secure_key_v1`
  - 要換的話 cloud_config.js 也要同步換
- **doGet** ・ `?action=get&key=<API_KEY>` → 回傳 `{ok, config, updated_at, updated_by}`
- **doPost** ・ body `{key, config, updated_by}` → 寫入 Sheet,回傳 `{ok, updated_at}`
- **無 preflight 問題**:用 `Content-Type: text/plain` 避開 CORS preflight
- **手動測試函式**:`initialize()`、`testGet()`、`testPost()` 可在編輯器內按 ▶ 跑

## CONFIG 結構(localStorage key + Sheet B2 JSON)

```js
{
  qr: {
    line:         "https://lin.ee/nnDYAZE",
    mindspectrum: "https://zway-education.github.io/mindspectrum-advanced/",
  },
  testimonies: [
    { text: '...<b>...</b>...', who: '— 班別 ・ 化名(城市)' },
    ...
  ],
  durations: { s1: 15000, s2: 12000, s3: 12000, s4: 12000, s5: 15000, s6: 12000 },
  testimonyInterval: 4000,
}
```

## defaults.js 提供的 API

- `window.TVWALL_DEFAULTS` — 預設配置
- `window.TVWALL_loadCached()` — **同步** ・ 從 localStorage cache(給 index.html 啟動用)
- `window.TVWALL_loadCloud()` — async ・ 從 Apps Script 拉
- `window.TVWALL_saveCloud(cfg, by)` — async ・ 寫到 Apps Script
- `window.TVWALL_saveLocal(cfg)` — 同步 ・ 寫 localStorage
- `window.TVWALL_loadSmart()` — async ・ 雲端優先,失敗回本機
- `window.TVWALL_saveSmart(cfg, by)` — async ・ 雲端優先,失敗回本機
- `window.TVWALL_isCloudEnabled()` — 檢查 cloud_config.js URL 是否填了

## index.html 雲端輪詢邏輯

- 載入時用 `loadCached()` 立刻渲染
- 1 秒後 async 從雲端拉一次更新
- 每次 `scheduleNext()`(切下一張 slide 前)呼叫 `maybePullCloud()`
- `maybePullCloud()` 限頻每 30 秒一次(透過 `lastPullTime` 比對)
- 雲端有更新時 → 呼叫 `applyConfig()`:更新 CONFIG、SLIDES、QR_URLS,重新 render testimonies + QRs
- **不會打斷當前 slide**,只在切換時套用

## admin.html 雲端讀寫

- 頂部「雲端狀態」綠燈/橘燈/紅燈(cloud / local / offline)
- 載入時:cached 立刻渲染,然後 async 從雲端拉一次蓋掉
- 儲存時:用 `saveSmart` → 雲端優先,顯示「☁️ 已儲存到雲端」或「💾 已儲存到本機」
- `updated_by` 用瀏覽器指紋產生(navigator.platform + random),存在 localStorage
- 「最後更新」會從 localStorage 讀,顯示時間 + 誰改的

## 設計約束(品牌鐵則,改任何東西前都要遵守)

- ❌ 不販售焦慮、不教養專家口氣、不立即報名 CTA
- ❌ 「李守蕾」「先懂心,再懂教」「@zwayedu」是品牌核心,不要任意改
- ✅ 主色翠玉綠 `#1f8a5c` + 米白 `#faf7f2` + 金杏 `#c9a96e`
- ✅ 標題 Noto Serif TC,內文 Noto Sans TC
- ✅ 色彩節奏:S1 綠 / S2 米白 / S3 焦黑 / S4 米白 / S5 焦黑 / S6 金

## 6 張 slide 結構

| # | 內容 | 背景 | 主 CTA |
|---|---|---|---|
| 1 | 主畫面 ・ 先懂心,再懂教 | 翠玉綠漸層 | 小 QR (LINE) |
| 2 | 3 班級 + 全人測評(啟蒙班3-6 / 開智班7-12 / 智優班13-15 / 全人測評全齡)・ 卡片文案用官方標語 ・ 對齊 zway-education.github.io/Introduction | 米白 + 白卡 | 小 QR (LINE) |
| 3 | 創辦人故事 ・ 守蕾老師 | 焦黑 | 小 QR (LINE) |
| 4 | 真實見證(輪換多條) | 米白 | 小 QR (LINE) |
| 5 | 心智光譜邀請 | 焦黑+綠調 | **大 QR (心智光譜)** |
| 6 | 加 LINE 慢慢認識 | 金杏漸層 | **大 QR (LINE)** |

完整時長:78 秒。

## 使用者常見請求 ・ 對應處理

### 「想改某個 slide 的標題 / 副標」
目前**主視覺文字寫死在 HTML**(只見證、QR、秒數、消息可在後台改)。要擴充:把該文字加入 CONFIG / defaults.js → 更新 index.html 改成從 CONFIG 讀 → 更新 admin.html 加表單欄位。

### 「想加新 slide(影片 / 學員作品 / 公告)」
已有提案 mockup:`mockup_announcement.html`(最新消息/公告 slide)。要新增 slide:
1. `<div class="tvwall">` 內新增 `<section class="slide sX" data-id="X">`
2. 寫對應 CSS(注意色彩節奏)
3. 更新 SLIDES 陣列、CONFIG.durations、defaults.js
4. 動態內容要加 render function + admin 表單區塊 + Apps Script 不用改(整個 config 是一個 JSON)

### 「Apps Script URL 變了 / API 壞了」
1. 進 Sheet → 擴充功能 → Apps Script
2. 部署 → 管理現有部署作業 → 編輯(不是新增)→ 新版本
3. 拿到新 URL → 更新 cloud_config.js → push 到 GitHub

### 「想加密碼鎖 / 多人權限」
- 簡單密碼:admin.html 加一個 prompt + localStorage 存 unlock state
- 多人權限:Apps Script doPost 內檢查 `Session.getActiveUser().getEmail()` 在白名單
  - 但要把部署改成「執行身分:caller」+「存取:任何 Google 帳號」
  - 比較複雜,需要 OAuth 流程

### 「電視牆壞了 / 顯示空白」
1. 99% 是 cloud_config.js URL 拼錯 → F12 Console 看錯誤
2. 也可能是 localStorage 損壞 → 開 admin.html 按「↻ 重置為預設」
3. 雲端真的壞了 → 跑 testGet() 在 Apps Script 編輯器看回什麼

## 已知技術細節

- **字型**:Google Fonts(Noto Serif TC + Noto Sans TC)
- **QR 生成**:qrcode.js CDN(https://cdn.jsdelivr.net/npm/qrcode@1.5.3),client-side
- **動畫**:純 CSS keyframes
- **CORS**:Apps Script doPost 用 `Content-Type: text/plain` 避免 preflight
- **離線降級**:雲端失敗時,index.html 用最後一次成功 cache,admin.html 顯示「⚠ 雲端離線」
- **PWA**:manifest.json + apple-touch-icon links,可加到 iOS / Android 主畫面

## 相關專案 / 素材

- `心智光譜細節維護/` — 心智光譜測驗,Slide 5 QR 連到那裡
- `覺知SEL櫃檯介紹本及傳單/skill/SKILL.md` — 品牌風格指南
- `覺知新知與發文建議/_brand_voice.md` — 品牌語氣與禁忌
- `覺知電話行銷人員/04_守蕾老師對外文宣樣本庫.md` — 創辦人故事原始版本

## 設計文件

`覺知SEL櫃檯介紹本及傳單/docs/superpowers/specs/2026-05-13-counter-tvwall-design.md` — brainstorming 階段的完整 spec。

---

**未來接手的 Claude:讀完這份後直接動手。** 不要重新問使用者基本架構問題。改之前看看雲端模式有沒有啟用(`cloud_config.js` 的 URL 是否還是 PASTE_HERE)。若是雲端模式,改 HTML 要記得不會即時影響線上版,使用者要 push GitHub 才會。
