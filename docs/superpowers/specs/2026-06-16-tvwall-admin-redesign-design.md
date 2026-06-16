# 電視牆 後台改版 + 前台引擎升級 — 設計規格

**日期:** 2026-06-16
**專案:** 櫃檯招生電視牆(tvwall)
**狀態:** 設計已與 KWJ 確認,待寫實作計畫

---

## 1. 背景與問題

現行後台(`admin.html`,~2232 行)是一張超長單頁表單,9 個編號區塊(❶QR…❾slide管理),靠「快轉導航」硬撐。KWJ 痛點(她本人確認,全中):

1. 整頁太長、找不到東西。
2. 改一張 slide 要跨好幾區(QR 在 ❶、圖在 ❺、秒數在 ❾)。
3. 改完看不到效果,要另開預覽。
4. 存檔 / 雲端同步搞不清楚,怕沒生效、怕被蓋掉。

**同步不可靠的真因(已查證,見調查報告):** 圖片以 base64 內嵌進設定 JSON(整包 2–5MB),經 Google Apps Script + Sheet 同步並存 localStorage。payload 太大時:
- localStorage 爆 quota(~5MB)→ 靜默失敗。
- Apps Script POST 逾時 / CORS → 被 try/catch 吞掉,`saveSmart` 仍回 `ok:true`,**假裝成功但電視沒收到**。
- 無衝突偵測,last-write-wins(「怕被蓋掉」屬實)。

## 2. 範圍決策(與 KWJ 確認)

| 決策 | 結論 |
|---|---|
| 同步範圍 | **只在櫃檯這一台電腦編輯**,前台用同一台、同一個瀏覽器開 → **不需要跨裝置雲端同步** |
| 資料儲存 | **本機 IndexedDB**(大容量、可靠),取代 localStorage+AppsScript |
| 後台安全 | **上鎖**(進後台要密碼) |
| 備份 | **匯出 / 匯入**(JSON 檔),防電腦壞 / 清瀏覽器 |
| 前台視覺 | **100% 維持原樣**(顏色/版型/每張設計不變) |
| 前台引擎 | 升級成**資料驅動**(現為寫死 15 張),讓未來可無限新增 |
| 新增 slide | **品牌版型範本**(選範本→填內容→加進輪播),非自由排版 |
| 預覽 | **WYSIWYG**:後台預覽框嵌入真正的前台渲染,所見即所得 |
| 部署 | 維持 Vercel(app 殼);資料在本機瀏覽器 |

**前台「不變」的精確定義:** 視覺輸出不變;底層渲染碼會從「15 段寫死 HTML」改成「讀資料 + 範本渲染」。現有 15 張轉成資料後,畫面像素級一致。

## 3. 架構

### 3.1 資料模型(單一真實來源)
設定物件 `config`:
```
{
  version: 2,
  slides: [ SlideObj, ... ],        // 取代寫死的 15 張 + slidesOrder + hiddenSlides + durations
  globals: { qr:{...}, theme, layout, orientation, testimonyInterval },
  assets: { <assetId>: Blob/dataURL }  // 圖片獨立存,不混在 slide 文字裡
}

SlideObj = {
  id: string,            // 穩定 id(新增也有)
  type: 'hero'|'imitext'|'testimony'|'qr'|'highlights'|'announcement'|'fullimage'|...內建特殊類型,
  show: boolean,
  sec: number,           // 停留秒數
  order: number,         // 排序(或用陣列順序)
  content: { ...依 type 不同的欄位, 圖片以 assetId 參照 }
}
```
- **圖片與文字分離**:`content` 只放文字 + `assetId`;圖片 Blob 存 `assets`(IndexedDB),不再讓設定 JSON 變肥。
- 現有 15 張對應到內建 type(部分是「特殊版型」如班級卡、創辦人),保留其專屬渲染;新增 slide 用 7 種通用範本。

### 3.2 儲存層(`store.js`,新)
- IndexedDB:一個 DB,object stores = `config`(單筆)+ `assets`(blob,key=assetId)。
- API:`loadConfig()` / `saveConfig(config)` / `putAsset(blob)→id` / `getAssetURL(id)` / `exportAll()→Blob(.json/.zip)` / `importAll(file)`。
- **可靠存檔**:寫入成功才回成功;失敗明確報錯(不再靜默 `ok:true`)。
- **遷移**:首次載入若偵測到舊 localStorage `tvwall_config`,自動轉成 v2 寫進 IndexedDB(圖片 base64 → 拆進 assets)。
- 移除 / 停用 Apps Script 路徑(`cloud_config.js` 改為預設關閉)。

### 3.3 前台引擎(`index.html` / `vertical.html` 升級)
- 啟動:`loadConfig()` → 依 `slides`(只取 show=true、按 order)渲染。
- 渲染器:每個 type 一個 render 函式(現有 15 張的設計搬進對應 render,輸出相同 HTML/CSS)。
- 圖片:`getAssetURL(assetId)` 取 objectURL。
- **同瀏覽器即時更新**:`BroadcastChannel('tvwall')`,後台存檔後 postMessage,前台收到→重讀 config→重渲染(幾秒內,實際是即時)。取代現在「靠輪播切換才 poll」的脆弱機制。

### 3.4 後台(全新 `admin.html`)
- **登入閘**:密碼(client-side gate;誠實告知非高安全,僅擋路人;因 app 公開在 Vercel)。
- **三欄版面**:左=分類清單(⭐常用內容 / 🖼每張畫面[可拖拉排序+顯示切換] / ⚙整體設定 / 💾備份);中=選中項目的編輯區(**一張 slide 的文字/圖/顯示/秒數全在一起**);右=**即時 WYSIWYG 預覽**(嵌入真前台渲染)。
- **狀態列**:永遠顯示「已儲存 ・ 電視牆已更新 / 儲存中…」,改動自動存。
- **新增 slide**:「＋ 新增畫面」→ 選 7 種範本之一 → 填內容 → 加進清單。
- 沿用既有可用邏輯(圖片壓縮 `compressImage`、各欄位渲染),只換殼 + 換儲存層。
- 設計風格參考已做的 `admin_redesign_mockup.html`。

### 3.5 版型範本(7 種,品牌同風格)
🅰 大標題 Hero ・ 🅱 圖+文 ・ 🅲 見證卡 ・ 🅳 QR 行動呼籲 ・ 🅴 課程花絮 ・ 🅵 公告/最新消息(參考 `mockup_announcement.html`)・ 🅶 純圖滿版。

## 4. 非目標(YAGNI)
- 不做跨裝置雲端同步、不做多人協作。
- 不做自由拖拉排版設計器。
- 不改前台視覺設計。
- 不做帳號系統(單一密碼即可)。

## 5. 分階段交付(做一段給 KWJ 看一段)
1. **S1 資料模型 + 儲存層 + 遷移**:把現有設定無損轉成 v2 進 IndexedDB,含匯出/匯入。(內部,前台後台先照舊跑)
2. **S2 前台引擎資料驅動**:index/vertical 改讀資料渲染;**驗證現有 15 張像素級不變**;BroadcastChannel 即時更新。
3. **S3 新後台殼 + WYSIWYG 預覽 + 狀態列 + 密碼**:每張一頁、即時預覽、自動存。
4. **S4 新增 slide 範本(7 種)**。
5. **S5 整機驗收**:在櫃檯這台實際操作 + 部署 Vercel。

## 6. 風險與對策
- **前台像素級一致**:S2 用截圖前後對比逐張驗證(現有 15 張)。
- **資料遺失**:單機本機儲存→強制提供匯出備份 + 首次遷移前先備份舊 localStorage。
- **密碼非真安全**:誠實告知;app 公開於 Vercel,client-side gate 僅擋非技術人員。若日後要真安全→改 Vercel 存取保護或後端(非本期)。
- **IndexedDB 被清**:匯出備份為唯一保險,UI 提醒定期匯出。
- **同瀏覽器前提**:若電視其實是另一台裝置開網址,本設計需改加一個傳輸管道(待 KWJ 最終確認電視接法)。
