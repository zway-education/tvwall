/**
 * ╔════════════════════════════════════════════════════════════════╗
 * ║   直式電視牆 ・ Apps Script API v4(獨立於橫式版)                ║
 * ║   專案:K12覺知素養教育學苑 ・ VERTICAL                            ║
 * ║                                                                ║
 * ║   ⚠ 跟橫式版的 .gs 是不同副本:                                   ║
 * ║   - 要建另一個 Google Sheet「tvwall_v_config」                   ║
 * ║   - API_KEY 不同(末尾 _VERTICAL_secure_key_v1)                  ║
 * ║   - URL 跟橫式不同,寫進 vertical/cloud_config.js                 ║
 * ║                                                                ║
 * ║   v4 (2026-05-17):                                              ║
 * ║   - 修 bug:qrImageFacebook / qrImageInstagram 也要分塊          ║
 * ║     原本被塞進 main JSON,多上傳幾張就超 50K → JSON 截斷 → 全空    ║
 * ║   - 新增 universal safety net:任何 base64 欄位 (data:) 自動分塊  ║
 * ║   - writeConfig 完成後檢查 main JSON 長度,>45K 就丟錯讓 client   ║
 * ║     收到明確錯誤訊息(不再吞掉)                                   ║
 * ║                                                                ║
 * ║   v3 (前一版):單張圖可跨多格儲存(chunking)                       ║
 * ║                                                                ║
 * ║   部署方式:                                                     ║
 * ║   1. 整段刪除舊程式 → 貼上此版本                                  ║
 * ║   2. Ctrl+S 存檔                                                ║
 * ║   3. 部署 → 管理現有部署作業 → 編輯 → 新版本 → 部署                ║
 * ║   4. URL 不變                                                   ║
 * ╚════════════════════════════════════════════════════════════════╝
 */

const API_KEY = "tvw_K12_AwarenessSEL_2026_VERTICAL_secure_key_v1";
const CONFIG_SHEET_NAME = "config";
const LOG_SHEET_NAME = "log";
const CELL_CHUNK_SIZE = 45000;  // Sheet 單格上限 5 萬字元,留餘裕
const MAIN_JSON_BUDGET = 45000;  // main JSON 寫進 B2 的安全上限

// 要拆出主 JSON 單獨存的「圖片欄位」清單
// ⚠ 加新圖片欄位時一定要同步更新這裡,否則會塞在 main JSON 撐爆 50K 限制
const IMAGE_FIELDS = [
  'portrait', 'qrImageLine', 'qrImageMindspectrum',
  'qrImageFacebook', 'qrImageInstagram',
  'logoImage',
  'stage1Image', 'stage2Image', 'stage3Image', 'stage4Image',
  'bgImageS1', 'bgImageS2', 'bgImageS3', 'bgImageS4',
  'bgImageS5', 'bgImageS6', 'bgImageS7'
];

// ============ 主入口 ============

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    if (params.key !== API_KEY) return jsonResponse({ ok: false, error: "Invalid API key" });
    const action = params.action || "get";
    if (action === "get") {
      return jsonResponse({
        ok: true,
        config: readConfig(),
        updated_at: getUpdatedAt(),
        updated_by: getUpdatedBy(),
      });
    }
    if (action === "ping") return jsonResponse({ ok: true, message: "API alive (v3)" });
    return jsonResponse({ ok: false, error: "Unknown action: " + action });
  } catch(err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData) return jsonResponse({ ok: false, error: "No post data" });
    const body = JSON.parse(e.postData.contents);
    if (body.key !== API_KEY) return jsonResponse({ ok: false, error: "Invalid API key" });
    const config = body.config;
    if (!config || !config.qr || !Array.isArray(config.testimonies) || !config.durations) {
      return jsonResponse({ ok: false, error: "Config 結構不對(缺 qr / testimonies / durations)" });
    }
    writeConfig(config, body.updated_by || "");
    return jsonResponse({
      ok: true,
      message: "Saved (v3 chunked multi-cell)",
      updated_at: new Date().toISOString(),
    });
  } catch(err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

// ============ Sheet 讀寫(v2 多格)============

function readConfig() {
  const sheet = getOrCreateConfigSheet();
  const mainStr = sheet.getRange("B2").getValue();
  let config;
  try { config = JSON.parse(mainStr || '{}'); } catch(err) { config = {}; }
  if (!config.qr) return getDefaultConfig();

  const lastRow = sheet.getLastRow();
  if (lastRow > 2) {
    const data = sheet.getRange(3, 1, lastRow - 2, 2).getValues();
    // v3:同一個 key 可能跨多列(chunking),依出現順序「串接」而非覆蓋
    for (const row of data) {
      const key = row[0];
      const value = row[1];
      if (!key || typeof key !== 'string' || !key.startsWith('img_')) continue;
      const field = key.substring(4);

      const m = field.match(/^highlight_(\d+)$/);
      if (m) {
        const idx = parseInt(m[1], 10);
        if (Array.isArray(config.highlights) && config.highlights[idx]) {
          config.highlights[idx].image = (config.highlights[idx].image || '') + (value || '');
        }
        continue;
      }

      // v4:任何 img_<field> 都串接回 config[field](不再硬綁 IMAGE_FIELDS 白名單)
      // 因為 writeConfig 的 universal safety net 可能存了 IMAGE_FIELDS 沒列的欄位
      config[field] = (config[field] || '') + (value || '');
    }
  }
  return config;
}

function writeConfig(config, updatedBy) {
  const sheet = getOrCreateConfigSheet();
  const textConfig = JSON.parse(JSON.stringify(config));
  const images = {};

  // 步驟 1:已知圖片欄位 → 強制分塊(白名單)
  for (const field of IMAGE_FIELDS) {
    if (textConfig[field]) {
      images[`img_${field}`] = textConfig[field];
      textConfig[field] = '';
    }
  }

  // 步驟 2:universal safety net ・ 掃描 top-level 任何 base64 大欄位
  // (避免未來新增圖片欄位忘了同步 IMAGE_FIELDS 又把雲端撐爆)
  for (const k of Object.keys(textConfig)) {
    const v = textConfig[k];
    if (typeof v === 'string' && v.length > 5000 && v.indexOf('data:') === 0) {
      images[`img_${k}`] = v;
      textConfig[k] = '';
    }
  }

  if (Array.isArray(textConfig.highlights)) {
    textConfig.highlights = textConfig.highlights.map(function(h, i) {
      const out = Object.assign({}, h);
      if (out.image) {
        images[`img_highlight_${i}`] = out.image;
        out.image = '';
      }
      return out;
    });
  }

  // 步驟 3:剝好圖片後再驗 main JSON 大小,超過 45K 就丟錯
  // 讓 client 收到明確錯誤,不會誤以為「儲存成功但其實截斷了」
  const mainJson = JSON.stringify(textConfig);
  if (mainJson.length > MAIN_JSON_BUDGET) {
    throw new Error('Main JSON too large (' + mainJson.length + ' > ' + MAIN_JSON_BUDGET +
      '),可能有未列入 IMAGE_FIELDS 的圖片欄位塞在裡面。請更新 Apps Script IMAGE_FIELDS 清單。');
  }

  const lastRow = sheet.getLastRow();
  if (lastRow > 2) {
    sheet.getRange(3, 1, lastRow - 2, sheet.getLastColumn()).clearContent();
  }

  sheet.getRange("A2").setValue("main");
  sheet.getRange("B2").setValue(mainJson);
  sheet.getRange("C2").setValue(new Date());
  sheet.getRange("D2").setValue(updatedBy || "(unknown)");

  // v3:每張圖切成 CELL_CHUNK_SIZE 字元的塊,跨多列存(同 key 連續多列)
  let row = 3;
  for (const key of Object.keys(images)) {
    const value = images[key];
    if (!value) continue;
    for (let i = 0; i < value.length; i += CELL_CHUNK_SIZE) {
      sheet.getRange(row, 1).setValue(key);
      sheet.getRange(row, 2).setValue(value.substring(i, i + CELL_CHUNK_SIZE));
      row++;
    }
  }

  appendLog(textConfig, Object.keys(images).length, updatedBy);
}

function getUpdatedAt() {
  const v = getOrCreateConfigSheet().getRange("C2").getValue();
  return v instanceof Date ? v.toISOString() : "";
}

function getUpdatedBy() {
  return getOrCreateConfigSheet().getRange("D2").getValue() || "";
}

function getOrCreateConfigSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG_SHEET_NAME);
    sheet.getRange("A1:D1").setValues([["key", "value", "updated_at", "updated_by"]]);
    sheet.getRange("A1:D1").setFontWeight("bold").setBackground("#1f8a5c").setFontColor("#ffffff");
    sheet.getRange("A2").setValue("main");
    sheet.setColumnWidth(1, 120);
    sheet.setColumnWidth(2, 500);
    sheet.setColumnWidth(3, 180);
    sheet.setColumnWidth(4, 200);
  }
  return sheet;
}

function appendLog(textConfig, imageCount, updatedBy) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let log = ss.getSheetByName(LOG_SHEET_NAME);
    if (!log) {
      log = ss.insertSheet(LOG_SHEET_NAME);
      log.getRange("A1:D1").setValues([["timestamp", "updated_by", "image_count", "text_size"]]);
      log.getRange("A1:D1").setFontWeight("bold").setBackground("#1f8a5c").setFontColor("#ffffff");
    }
    const textSize = JSON.stringify(textConfig).length;
    log.appendRow([new Date(), updatedBy || "(unknown)", imageCount, textSize]);
  } catch(err) { console.warn("Log append failed", err); }
}

function getDefaultConfig() {
  return {
    qr: {
      line:         "https://lin.ee/nnDYAZE",
      mindspectrum: "https://zway-education.github.io/mindspectrum-advanced/",
    },
    testimonies: [
      { text: '我兒子以前回家就摔門。<br>現在他會說<b>「媽媽,我今天心情有點亂。」</b>', who: '— 國中智優 ・ 陳媽媽(高雄)' },
      { text: '教完數學再教 SEL,<br>孩子<b>主動讀書的比例多了一倍</b>。', who: '— 國小開智 ・ 楊老師' },
      { text: '孩子知道自己是什麼樣的人,<br>選大學科系<b>就不再焦慮了</b>。', who: '— 高中恆毅力 ・ 林爸爸' },
    ],
    durations: { s1: 15000, s2: 12000, s3: 12000, s4: 12000, s5: 15000, s6: 12000, s7: 14000 },
    testimonyInterval: 4000,
    portrait: "", qrImageLine: "", qrImageMindspectrum: "",
    logoImage: "",
    stage1Image: "", stage2Image: "", stage3Image: "", stage4Image: "",
    bgImageS1: "", bgImageS2: "", bgImageS3: "", bgImageS4: "", bgImageS5: "", bgImageS6: "", bgImageS7: "",
    layout: "A", theme: "green",
    highlights: [],
  };
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============ 手動測試 ============

function initialize() {
  const sheet = getOrCreateConfigSheet();
  if (!sheet.getRange("B2").getValue()) {
    writeConfig(getDefaultConfig(), "(initial v2)");
    console.log("✅ 初始化完成 ・ v2 多格儲存");
  } else {
    console.log("ℹ️ Sheet 已有資料,沒覆寫(可手動執行 forceReset 重置)");
  }
  appendLog({ initialized: true }, 0, "(system)");
}

function forceReset() {
  writeConfig(getDefaultConfig(), "(forceReset v2)");
  console.log("✅ 強制重置為預設(v2)");
}

function testGet() {
  const fake = { parameter: { key: API_KEY, action: "get" } };
  console.log(doGet(fake).getContent());
}
