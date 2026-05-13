// ╔════════════════════════════════════════════════════════════════╗
// ║   電視牆預設內容 + 雲端/本機雙模式載入器                            ║
// ║   index.html 跟 admin.html 都會讀這個檔                          ║
// ║                                                                ║
// ║   雙模式:                                                       ║
// ║   - 雲端模式:cloud_config.js 有填 URL → 從 Apps Script API 讀寫   ║
// ║   - 本機模式:URL 未填或連不上 → 從 localStorage 讀寫(單裝置)     ║
// ╚════════════════════════════════════════════════════════════════╝

window.TVWALL_DEFAULTS = {

  qr: {
    line:         "https://lin.ee/nnDYAZE",
    mindspectrum: "https://zway-education.github.io/mindspectrum-advanced/",
  },

  testimonies: [
    {
      text: '我兒子以前回家就摔門。<br>現在他會說<b>「媽媽,我今天心情有點亂。」</b>',
      who:  '— 國中智優 ・ 陳媽媽(高雄)'
    },
    {
      text: '教完數學再教 SEL,<br>孩子<b>主動讀書的比例多了一倍</b>。',
      who:  '— 國小開智 ・ 楊老師'
    },
    {
      text: '孩子知道自己是什麼樣的人,<br>選大學科系<b>就不再焦慮了</b>。',
      who:  '— 高中恆毅力 ・ 林爸爸'
    },
  ],

  durations: {
    s1: 15000,
    s2: 12000,
    s3: 12000,
    s4: 12000,
    s5: 15000,
    s6: 12000,
    s7: 14000,  // 課程花絮(內部每 4.5 秒換一張,所以這張要長一點)
  },

  testimonyInterval: 4000,

  // 圖片(base64 data URL),預設為空字串 → fallback 行為:
  // - portrait 空 → Slide 3 顯示金色佔位卡
  // - qrImageLine 空 → Slide 6 大 QR 由 qrcode.js 動態生成
  // - qrImageMindspectrum 空 → Slide 5 大 QR 由 qrcode.js 動態生成
  portrait: "",
  qrImageLine: "",
  qrImageMindspectrum: "",

  // 版型(A 標題置左 / B 極簡留白 / C 雜誌封面 / E 對話氣泡)
  layout: "A",

  // 配色(green / amber / mint / gold / leather / navy)
  theme: "green",

  // Slide 7 課程花絮(陣列,每張一個 object)
  // 結構:[{ image: "data:image/jpeg;base64,...", title: "活動名稱", date: "2026/04/15", desc: "簡述" }]
  highlights: [],
};

// ============ 工具 ============

function _clone(obj) { return JSON.parse(JSON.stringify(obj)); }

function _merge(parsed) {
  const D = window.TVWALL_DEFAULTS;
  if (!parsed || typeof parsed !== 'object') return _clone(D);
  return {
    qr: { ...D.qr, ...(parsed.qr || {}) },
    testimonies: (Array.isArray(parsed.testimonies) && parsed.testimonies.length > 0)
      ? parsed.testimonies
      : D.testimonies,
    durations: { ...D.durations, ...(parsed.durations || {}) },
    testimonyInterval: parsed.testimonyInterval || D.testimonyInterval,
    portrait: parsed.portrait || '',
    qrImageLine: parsed.qrImageLine || '',
    qrImageMindspectrum: parsed.qrImageMindspectrum || '',
    layout: parsed.layout || 'A',
    theme: parsed.theme || 'green',
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
  };
}

// ============ 立即可用(同步)・ 給 index.html 啟動用 ============

window.TVWALL_loadCached = function() {
  try {
    const saved = localStorage.getItem('tvwall_config');
    if (!saved) return _clone(window.TVWALL_DEFAULTS);
    return _merge(JSON.parse(saved));
  } catch(e) {
    console.warn('[tvwall] localStorage 讀取失敗', e);
    return _clone(window.TVWALL_DEFAULTS);
  }
};

// ============ 從雲端拉(非同步)============

window.TVWALL_loadCloud = async function() {
  if (!window.TVWALL_isCloudEnabled || !window.TVWALL_isCloudEnabled()) {
    throw new Error('Cloud not configured');
  }
  const api = window.TVWALL_API;
  const url = api.url + "?action=get&key=" + encodeURIComponent(api.key) + "&t=" + Date.now();
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'API error');
  const merged = _merge(data.config);
  // 寫入本機 cache(離線可用)
  localStorage.setItem('tvwall_config', JSON.stringify(merged));
  localStorage.setItem('tvwall_updated_at', data.updated_at || '');
  localStorage.setItem('tvwall_updated_by', data.updated_by || '');
  return {
    config: merged,
    updated_at: data.updated_at || '',
    updated_by: data.updated_by || '',
  };
};

// ============ 寫入雲端(非同步)============

window.TVWALL_saveCloud = async function(config, updatedBy) {
  if (!window.TVWALL_isCloudEnabled || !window.TVWALL_isCloudEnabled()) {
    throw new Error('Cloud not configured');
  }
  const api = window.TVWALL_API;
  const res = await fetch(api.url, {
    method: 'POST',
    // 不設 Content-Type: application/json 避開 Apps Script 不支援的 preflight
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      key: api.key,
      config: config,
      updated_by: updatedBy || '',
    }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'API error');
  // 也寫入本機 cache(後續離線可用)
  localStorage.setItem('tvwall_config', JSON.stringify(config));
  localStorage.setItem('tvwall_updated_at', data.updated_at || new Date().toISOString());
  return data;
};

// ============ 本機儲存(雲端 fallback)============

window.TVWALL_saveLocal = function(config) {
  try {
    localStorage.setItem('tvwall_config', JSON.stringify(config));
    localStorage.setItem('tvwall_updated_at', new Date().toISOString());
    return true;
  } catch(e) {
    console.error('[tvwall] localStorage 寫入失敗', e);
    return false;
  }
};

// ============ 智慧載入(雲端優先 ・ 失敗回本機)============

window.TVWALL_loadSmart = async function() {
  if (window.TVWALL_isCloudEnabled && window.TVWALL_isCloudEnabled()) {
    try {
      const r = await window.TVWALL_loadCloud();
      return { source: 'cloud', ...r };
    } catch(e) {
      console.warn('[tvwall] 雲端讀取失敗,回退本機', e);
    }
  }
  return {
    source: 'local',
    config: window.TVWALL_loadCached(),
    updated_at: localStorage.getItem('tvwall_updated_at') || '',
    updated_by: localStorage.getItem('tvwall_updated_by') || '',
  };
};

// ============ 智慧儲存(雲端優先 ・ 失敗回本機)============

window.TVWALL_saveSmart = async function(config, updatedBy) {
  if (window.TVWALL_isCloudEnabled && window.TVWALL_isCloudEnabled()) {
    try {
      await window.TVWALL_saveCloud(config, updatedBy);
      return { ok: true, source: 'cloud' };
    } catch(e) {
      console.warn('[tvwall] 雲端寫入失敗,僅存本機', e);
      window.TVWALL_saveLocal(config);
      return { ok: true, source: 'local', warning: e.message };
    }
  }
  const ok = window.TVWALL_saveLocal(config);
  return { ok, source: 'local' };
};

// 舊版相容(避免 admin.html 內舊 code 壞掉)
window.TVWALL_loadConfig = window.TVWALL_loadCached;
window.TVWALL_saveConfig = window.TVWALL_saveLocal;
