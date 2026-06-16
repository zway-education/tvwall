# 電視牆後台改版 + 前台引擎升級 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把電視牆改成「資料驅動」:後台變好用(每張一頁 + WYSIWYG 真預覽 + 自動存 + 密碼 + 備份),資料可靠存本機 IndexedDB,前台視覺不變但可無限新增 slide(7 種品牌範本)。

**Architecture:** 單一 `config`(slides[] + globals + assets)存 IndexedDB,是唯一真實來源。前台 `index.html` 改讀 config 用「每 type 一個 render 函式」渲染(現有 15 張像素不變)。後台改新殼,存檔後用 `BroadcastChannel` 即時通知前台重渲染。全程同一台電腦、同一瀏覽器,無雲端。

**Tech Stack:** Vanilla HTML/CSS/JS、IndexedDB(原生)、BroadcastChannel、Canvas(沿用既有 `compressImage`)。無打包工具、無 test runner → 用 in-browser test 頁 + 截圖比對驗證。部署 Vercel(靜態)。

**參考檔:** 設計規格 `docs/superpowers/specs/2026-06-16-tvwall-admin-redesign-design.md`、設計預覽 `admin_redesign_mockup.html`、調查報告(本對話)、舊資料結構 `defaults.js`。

---

## File Structure

| 檔案 | 責任 | 動作 |
|---|---|---|
| `js/store.js` | IndexedDB 儲存層:loadConfig/saveConfig/assets/export/import/migrate | Create |
| `js/schema.js` | v2 資料模型 + 預設值 + 從舊 v1 轉 v2 的純函式 | Create |
| `js/render.js` | 每個 slide type 的 render 函式(共用於前台 + 後台預覽) | Create |
| `tests/store.test.html` | 開瀏覽器跑的儲存層斷言測試,印 PASS/FAIL | Create |
| `tests/migrate.test.html` | v1→v2 轉換斷言測試 | Create |
| `index.html` | 前台:改成讀 config + render.js 渲染 + BroadcastChannel | Modify |
| `vertical.html` | 直式前台:同上 | Modify |
| `admin.html` | 後台:全新三欄殼 + 密碼 + 自動存 + 新增 slide | Rewrite(舊版備份成 `_封存/admin_v1.html`) |
| `defaults.js` | 標記為 legacy(僅供遷移讀取),不再被前台直接使用 | Modify(註解) |
| `cloud_config.js` | 預設停用 Apps Script 路徑 | Modify |

---

## Stage S1 — 資料模型 + 儲存層 + 遷移

### Task 1: v2 schema 與預設值

**Files:**
- Create: `js/schema.js`
- Test: `tests/migrate.test.html`(本 task 先建斷言骨架)

- [ ] **Step 1: 定義 v2 schema 與工廠函式**

`js/schema.js`:
```js
// v2 資料模型 —— 單一真實來源
window.TVWALL_SCHEMA_VERSION = 2;

// 內建 slide 類型(對應現有 15 張的特殊版型) + 7 種通用範本
window.TVWALL_SLIDE_TYPES = [
  'hero','imitext','testimony','qr','highlights','announcement','fullimage',
  // 既有特殊版型(渲染沿用舊設計):
  'stages','founder'
];

window.TVWALL_newSlide = function(type, partial){
  return Object.assign({
    id: 's_' + Math.random().toString(36).slice(2,9),
    type, show: true, sec: 8, content: {}
  }, partial || {});
};

window.TVWALL_emptyConfigV2 = function(){
  return { version: 2, slides: [], globals: {
    qr:{line:'',mindspectrum:'',facebook:'',instagram:''},
    theme:'emerald', layout:'A', orientation:'landscape', testimonyInterval:6000
  }, assets:{} };
};
```

- [ ] **Step 2: 加入斷言驗證**

`tests/migrate.test.html`(最小骨架,後面 Task 3 補遷移測試):
```html
<!doctype html><meta charset=utf-8><body><pre id=o></pre>
<script src="../js/schema.js"></script><script>
const log=(m)=>o.textContent+=m+"\n"; let pass=0,fail=0;
function eq(a,b,n){ if(JSON.stringify(a)===JSON.stringify(b)){pass++;log('PASS '+n)} else {fail++;log('FAIL '+n+' got '+JSON.stringify(a))} }
const c = TVWALL_emptyConfigV2();
eq(c.version,2,'emptyConfig version=2');
eq(typeof TVWALL_newSlide('hero').id,'string','newSlide has id');
eq(TVWALL_newSlide('hero').show,true,'newSlide show default true');
log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
</script></body>
```

- [ ] **Step 3: 在瀏覽器開 `tests/migrate.test.html`,確認全 PASS**(截圖)
- [ ] **Step 4: Commit** — `git add js/schema.js tests/migrate.test.html && git commit -m "feat(tvwall): v2 schema + factories"`

### Task 2: 儲存層 store.js(IndexedDB)

**Files:**
- Create: `js/store.js`
- Test: `tests/store.test.html`

- [ ] **Step 1: 寫儲存層**

`js/store.js`(關鍵介面):
```js
(function(){
  const DB='tvwall', VER=1; let _db;
  function open(){ return _db ? Promise.resolve(_db) : new Promise((res,rej)=>{
    const r=indexedDB.open(DB,VER);
    r.onupgradeneeded=()=>{ const d=r.result;
      if(!d.objectStoreNames.contains('config')) d.createObjectStore('config');
      if(!d.objectStoreNames.contains('assets')) d.createObjectStore('assets'); };
    r.onsuccess=()=>{_db=r.result;res(_db)}; r.onerror=()=>rej(r.error); }); }
  function tx(store,mode,fn){ return open().then(d=>new Promise((res,rej)=>{
    const t=d.transaction(store,mode), s=t.objectStore(store); let out;
    out=fn(s); t.oncomplete=()=>res(out&&out.result!==undefined?out.result:out); t.onerror=()=>rej(t.error); })); }

  window.TVWALL_store = {
    loadConfig: ()=> tx('config','readonly', s=> s.get('main')),
    saveConfig: (cfg)=> tx('config','readwrite', s=> s.put(cfg,'main')),  // reject on error (no silent ok)
    putAsset: (blob)=>{ const id='a_'+Math.random().toString(36).slice(2,10);
      return tx('assets','readwrite', s=> s.put(blob,id)).then(()=>id); },
    getAsset: (id)=> tx('assets','readonly', s=> s.get(id)),
    getAssetURL: (id)=> window.TVWALL_store.getAsset(id).then(b=> b? URL.createObjectURL(b): ''),
    exportAll: async ()=>{ const cfg=await window.TVWALL_store.loadConfig(); return new Blob([JSON.stringify(cfg)],{type:'application/json'}); },
    importAll: async (jsonText)=>{ const cfg=JSON.parse(jsonText); await window.TVWALL_store.saveConfig(cfg); return cfg; }
  };
})();
```
備註:圖片以 dataURL 字串存在 `config.assets[id]`(沿用既有壓縮輸出),v1 可先不用 Blob store;`putAsset`/`getAsset` 保留給未來 Blob 化。先求可靠、不爆容量(IndexedDB 容量遠大於 localStorage)。

- [ ] **Step 2: 寫測試 `tests/store.test.html`** — 寫入一個 config、讀回、export 再 import,斷言相等:
```html
<!doctype html><meta charset=utf-8><body><pre id=o></pre>
<script src="../js/schema.js"></script><script src="../js/store.js"></script><script>
const log=m=>o.textContent+=m+"\n"; let pass=0,fail=0;
const ok=(c,n)=>{ c?pass++:fail++; log((c?'PASS ':'FAIL ')+n) };
(async()=>{
  const cfg=TVWALL_emptyConfigV2(); cfg.slides.push(TVWALL_newSlide('hero',{content:{big:'測試'}}));
  await TVWALL_store.saveConfig(cfg);
  const back=await TVWALL_store.loadConfig();
  ok(back.slides[0].content.big==='測試','saveConfig/loadConfig roundtrip');
  const blob=await TVWALL_store.exportAll(); const txt=await blob.text();
  const imp=await TVWALL_store.importAll(txt);
  ok(imp.slides.length===1,'export/import roundtrip');
  log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
})();
</script></body>
```

- [ ] **Step 3: 開瀏覽器跑,確認全 PASS**(截圖)
- [ ] **Step 4: Commit** — `git commit -m "feat(tvwall): IndexedDB store layer + roundtrip tests"`

### Task 3: v1 → v2 遷移(無損)

**Files:**
- Modify: `js/schema.js`(加 `TVWALL_migrateV1toV2`)
- Modify: `tests/migrate.test.html`(加真實遷移斷言)

- [ ] **Step 1: 寫遷移純函式** `TVWALL_migrateV1toV2(v1)`:把舊 `tvwall_config`(defaults.js 結構:qr/testimonies/stages/durations/各圖片欄位/highlights/slidesOrder/hiddenSlides)轉成 v2 slides[](每張帶 type、show=由 hiddenSlides 推、sec=由 durations 推、圖片進 content)。完整對應表寫在函式註解。
- [ ] **Step 2: 在 `tests/migrate.test.html` 貼一份真實 v1 樣本(從目前 localStorage 匯出或 defaults.js 構造),斷言:slide 數=15、第13張 sec=8、hiddenSlides 對應的 show=false、圖片欄位有搬到 content。**
- [ ] **Step 3: 開瀏覽器跑,全 PASS**(截圖)
- [ ] **Step 4: Commit** — `git commit -m "feat(tvwall): lossless v1→v2 migration + tests"`

### Task 4: 一次性遷移啟動 + 匯出備份按鈕(過渡)

- [ ] **Step 1:** 寫 `js/boot-migrate.js`:啟動時若 IndexedDB 無 config 但 localStorage 有 `tvwall_config` → 先 `localStorage` 原值備份成 `tvwall_config_backup_v1`、再 migrate 寫入 IndexedDB。
- [ ] **Step 2:** 手動驗證:在目前有資料的瀏覽器載入 → IndexedDB 出現 v2 config(DevTools 檢查)。
- [ ] **Step 3: Commit** — `git commit -m "feat(tvwall): one-time v1→v2 boot migration with backup"`

**🔎 S1 驗收(給 KWJ 看):** 開測試頁全 PASS 截圖 + DevTools 顯示 IndexedDB 已有完整 v2 資料。前台/後台此時仍照舊跑。

---

## Stage S2 — 前台引擎資料驅動(視覺像素不變)

### Task 5: 抽出 render.js(現有 15 張的 render 函式)

**Files:** Create `js/render.js`;Modify `index.html`

- [ ] **Step 1:** 先對「現有前台」逐張截圖建立 baseline(15 張,landscape;`vertical.html` 另存),存 `tests/baseline/`。
- [ ] **Step 2:** 把 index.html 現有每張 slide 的產生邏輯,改寫成 `TVWALL_render[type](slide, globals)` 回傳該張 DOM/HTML;CSS 保留原樣。
- [ ] **Step 3:** index.html 改成:`loadConfig()` →(無則 migrate)→ 依 slides 過濾 show、排序 → 對每張呼叫對應 render。
- [ ] **Step 4: 截圖比對** 新前台 15 張 vs baseline,逐張確認像素一致(差異=0 或僅反鋸齒微差)。不一致就修 render。
- [ ] **Step 5: Commit** — `git commit -m "refactor(tvwall): data-driven front-end render (pixel-identical)"`

### Task 6: BroadcastChannel 即時更新 + 移除舊輪播 poll

- [ ] **Step 1:** index.html 訂閱 `new BroadcastChannel('tvwall')`,收到 `{type:'config-updated'}` → 重讀 config → 重渲染(保持當前播放位置或回第一張,擇一,預設回第一張並提示)。
- [ ] **Step 2:** 移除舊 `maybePullCloud`/Apps Script 輪播相依;`cloud_config.js` 停用。
- [ ] **Step 3:** 手動驗證:用 DevTools 在 console 對 IndexedDB 改一筆 + postMessage → 前台即時變。
- [ ] **Step 4: Commit** — `git commit -m "feat(tvwall): instant front-end refresh via BroadcastChannel"`

- [ ] **Step 7: 同步處理 `vertical.html`** 套用 render.js + BroadcastChannel,截圖比對直式 baseline。Commit。

**🔎 S2 驗收(給 KWJ 看):** 前後對比截圖證明前台沒變;示範「改資料 → 電視牆即時更新」。

---

## Stage S3 — 新後台殼(好用 + WYSIWYG + 自動存 + 密碼)

### Task 8: 備份舊後台 + 新後台骨架

- [ ] **Step 1:** `git mv admin.html _封存/admin_v1.html`(保留舊版,符合 KWJ 封存偏好)。
- [ ] **Step 2:** 用 `admin_redesign_mockup.html` 的版型為基礎建新 `admin.html`:三欄(左清單/中編輯/右預覽),接上 `store.js`/`schema.js`/`render.js`。
- [ ] **Step 3: Commit** — `git commit -m "feat(tvwall): new admin shell (3-pane)"`

### Task 9: 左欄清單(常用/每張畫面 拖拉排序+顯示切換/整體設定/備份)

- [ ] 由 `config.slides` 動態產生清單;拖拉改 order 即存;眼睛切換 show 即存。每動作呼叫 `saveConfig` + BroadcastChannel。Commit。

### Task 10: 中欄「每張一頁」編輯器(文字+圖+顯示+秒數同頁)

- [ ] 點一張 slide → 依 type 顯示其欄位(文字、圖片上傳[沿用 compressImage→存 assets/content]、顯示開關、停留秒數)。改動即存。Commit。

### Task 11: 右欄 WYSIWYG 真預覽

- [ ] 用 `render.js` 把「當前編輯中的 slide」即時渲染在右欄(縮放 fit),與前台同一套 render → 所見即所得。編輯時即時更新。Commit。

### Task 12: 狀態列 + 自動存 + 失敗明確報錯

- [ ] 頂部狀態列「儲存中…/已儲存・電視牆已更新」;`saveConfig` 失敗時紅字明確報錯(不再靜默成功)。Commit。

### Task 13: 密碼閘

- [ ] 進後台前 password gate(密碼存 config.globals 或固定常數;誠實告知為非高安全)。Commit。

### Task 14: 整體設定頁(QR/配色/版型/方向)+ 備份頁(匯出/匯入)

- [ ] globals 編輯;匯出下載 .json、匯入還原(呼叫 store.exportAll/importAll)。Commit。

**🔎 S3 驗收(給 KWJ 看):** 在這台電腦實測:後台改 → 右欄即時看到 → 另開前台視窗即時更新 → 關掉重開資料還在。

---

## Stage S4 — 新增 slide(7 種品牌範本)

### Task 15: 範本定義 + render 支援

- [ ] `render.js` 補 7 種通用範本(hero/imitext/testimony/qr/highlights/announcement/fullimage)的渲染,風格對齊前台(色/字/間距)。Commit。

### Task 16: 「＋ 新增畫面」流程

- [ ] 後台「＋ 新增畫面」→ 範本選擇器(縮圖)→ 選一個 → `TVWALL_newSlide(type)` 加進 slides → 進編輯器填內容 → 即存 + 前台出現。Commit。

### Task 17: 範本逐一驗收

- [ ] 每種範本各新增一張、填樣本內容、截圖確認在前台正確顯示且品牌一致。Commit。

**🔎 S4 驗收:** 示範新增一張「公告」slide 從無到有出現在電視牆。

---

## Stage S5 — 整機驗收 + 部署

### Task 18: 端到端走查(在櫃檯這台)
- [ ] 走完:登入→改花絮圖→改某張秒數→新增公告→匯出備份→關瀏覽器重開→資料還在→前台正確。記錄任何卡點。

### Task 19: 清理 + 部署
- [ ] 移除/封存 `admin_redesign_mockup.html`、停用 `cloud_config.js`、更新 `CLAUDE.md`。
- [ ] `git push`(→ zwayadmin/tvwall)→ Vercel 自動部署 → 線上驗證 `tvwall.vercel.app`(前台)+ `/admin.html`(後台)。

---

## Self-Review 結果
- **Spec 覆蓋:** 後台好用(T8–12)、IndexedDB 可靠存(T2)、WYSIWYG(T11)、密碼(T13)、備份(T2/T14)、前台不變(T5 截圖比對)、資料驅動引擎(T5–7)、7 範本新增(T15–17)、Vercel(T19)。同步「真因」由 S1+S2 解(去 base64-in-sync、去 Apps Script、IndexedDB + BroadcastChannel)。
- **Placeholder:** 無 TBD;各 task 有具體檔案/介面/驗證法。S3/S4 部分 task 以介面+驗證描述(非逐行 code),因屬 UI 組裝且依賴 S1/S2 的已定介面。
- **型別一致:** store API(loadConfig/saveConfig/putAsset/getAssetURL/exportAll/importAll)、schema(TVWALL_newSlide/emptyConfigV2/migrateV1toV2)、render(TVWALL_render[type])命名跨 task 一致。
- **風險:** 前台像素一致(T5 截圖比對把關);單機資料遺失(強制匯出備份 + 遷移前備份);電視若為獨立裝置(需 KWJ 最終確認接法,否則 S2 BroadcastChannel 前提不成立 → 改加傳輸層)。
