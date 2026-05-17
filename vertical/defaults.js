// ╔════════════════════════════════════════════════════════════════╗
// ║   直式電視牆 ・ 預設內容 + 雲端載入器                              ║
// ║                                                                ║
// ║   獨立於橫式版:                                                  ║
// ║   - namespace: window.TVV_*(避免跟橫式 TVWALL_* 衝突)            ║
// ║   - localStorage key: 'tvwall_v_config'(跟橫式分開存)            ║
// ║   - cloud API: TVV_API.url(獨立的 Apps Script + Sheet)          ║
// ╚════════════════════════════════════════════════════════════════╝

window.TVV_DEFAULTS = {

  qr: {
    line:         "https://lin.ee/nnDYAZE",
    mindspectrum: "https://zway-education.github.io/mindspectrum-advanced/",
    facebook:     "",
    instagram:    "",
  },

  // 直式 slide 預設內容(可在 vertical/admin.html 改)
  slides: [
    {
      type: 'stages',
      eyebrow: '從 3 歲開始 ・ 看懂孩子',
      headline: '陪孩子走過,\n每一個成長關鍵期。',
      stages: [
        {
          age: '3 - 6 歲',
          name: '啟蒙班',
          tag: '孩子能不再只是被情緒帶著走,而是開始看見自己內心的情緒。',
        },
        {
          age: '7 - 10 歲',
          name: '開智班',
          tag: '從他律到自律,把「被提醒」,慢慢變成「我可以自己做到」。',
        },
        {
          age: '10 歲以上',
          name: '智優班',
          tag: '陪青春期孩子看懂自己,把沉默、防衛與迷惘,轉化成正確的目標。',
        },
      ],
      foot: 'K12覺知素養教育學苑 ・ 蒙以養正 ・ 老而有尊',
    },
    {
      type: 'hero',
      eyebrow: 'K12覺知素養教育學苑 ・ 覺察己心 ・ 知行合一',
      headline: '先懂心,\n再懂教。',
      subhead: '從現在開始,看懂孩子。',
      foot: '覺知素養教育 ・ 20 年系統 ・ 非認知能力 ・ SEL',
    },
    {
      type: 'qr',
      eyebrow: '5 分鐘,你會認識新的孩子',
      headline: '想知道你的教養風格與\n孩子的天生心智底色嗎?',
      qrKey: 'mindspectrum',
      qrLabel: '→ 手機掃描 ・ 立即測驗',
      foot: '覺知心智光譜 ・ 5 分鐘自測 ・ 立即看見教養結果',
    },
    {
      type: 'qr',
      eyebrow: '在教養的路上,我們伴您',
      headline: '從日常裡的片刻開始,\n一步一步靠近孩子的內心。',
      qrKey: 'line-big',
      qrLabel: '→ 加為好友',
      foot: 'K12覺知素養教育學苑 ・ 加入 LINE @931irimh',
    },
  ],

  durations: {
    s1: 15000,   // stages 3 班級(內容多,給長一點)
    s2: 12000,
    s3: 14000,
    s4: 13000,
  },

  // 圖片(base64 data URL)
  logoImage: "",
  qrImageLine: "",
  qrImageMindspectrum: "",
  qrImageFacebook: "",
  qrImageInstagram: "",

  // 配色(green / amber / mint / gold / leather / navy)
  theme: "green",
};

// ============ 工具 ============

function _vclone(obj) { return JSON.parse(JSON.stringify(obj)); }

function _vmerge(parsed) {
  const D = window.TVV_DEFAULTS;
  if (!parsed || typeof parsed !== 'object') return _vclone(D);
  return {
    qr: { ...D.qr, ...(parsed.qr || {}) },
    slides: (Array.isArray(parsed.slides) && parsed.slides.length > 0)
      ? parsed.slides
      : D.slides,
    durations: { ...D.durations, ...(parsed.durations || {}) },
    logoImage: parsed.logoImage || '',
    qrImageLine: parsed.qrImageLine || '',
    qrImageMindspectrum: parsed.qrImageMindspectrum || '',
    qrImageFacebook: parsed.qrImageFacebook || '',
    qrImageInstagram: parsed.qrImageInstagram || '',
    theme: parsed.theme || 'green',
  };
}

window.TVV_merge = _vmerge;

// ============ 同步:本機 cache ============

const VKEY = 'tvwall_v_config';
const VUPDATED_KEY = 'tvwall_v_updated_at';
const VUPDATED_BY_KEY = 'tvwall_v_updated_by';

window.TVV_loadCached = function() {
  try {
    const saved = localStorage.getItem(VKEY);
    if (!saved) return _vclone(window.TVV_DEFAULTS);
    return _vmerge(JSON.parse(saved));
  } catch(e) {
    console.warn('[tvv] localStorage 讀取失敗', e);
    return _vclone(window.TVV_DEFAULTS);
  }
};

// ============ 雲端讀寫(非同步)============

window.TVV_loadCloud = async function() {
  if (!window.TVV_isCloudEnabled || !window.TVV_isCloudEnabled()) {
    throw new Error('Cloud not configured');
  }
  const api = window.TVV_API;
  const url = api.url + "?action=get&key=" + encodeURIComponent(api.key) + "&t=" + Date.now();
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'API error');
  const merged = _vmerge(data.config);
  localStorage.setItem(VKEY, JSON.stringify(merged));
  localStorage.setItem(VUPDATED_KEY, data.updated_at || '');
  localStorage.setItem(VUPDATED_BY_KEY, data.updated_by || '');
  return {
    config: merged,
    updated_at: data.updated_at || '',
    updated_by: data.updated_by || '',
  };
};

window.TVV_saveCloud = async function(config, updatedBy) {
  if (!window.TVV_isCloudEnabled || !window.TVV_isCloudEnabled()) {
    throw new Error('Cloud not configured');
  }
  const api = window.TVV_API;
  const res = await fetch(api.url, {
    method: 'POST',
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
  localStorage.setItem(VKEY, JSON.stringify(config));
  localStorage.setItem(VUPDATED_KEY, data.updated_at || new Date().toISOString());
  return data;
};

window.TVV_saveLocal = function(config) {
  try {
    localStorage.setItem(VKEY, JSON.stringify(config));
    localStorage.setItem(VUPDATED_KEY, new Date().toISOString());
    return true;
  } catch(e) {
    console.error('[tvv] localStorage 寫入失敗', e);
    return false;
  }
};

window.TVV_loadSmart = async function() {
  if (window.TVV_isCloudEnabled && window.TVV_isCloudEnabled()) {
    try {
      const r = await window.TVV_loadCloud();
      return { source: 'cloud', ...r };
    } catch(e) {
      console.warn('[tvv] 雲端讀取失敗,回退本機', e);
    }
  }
  return {
    source: 'local',
    config: window.TVV_loadCached(),
    updated_at: localStorage.getItem(VUPDATED_KEY) || '',
    updated_by: localStorage.getItem(VUPDATED_BY_KEY) || '',
  };
};

window.TVV_saveSmart = async function(config, updatedBy) {
  if (window.TVV_isCloudEnabled && window.TVV_isCloudEnabled()) {
    try {
      await window.TVV_saveCloud(config, updatedBy);
      return { ok: true, source: 'cloud' };
    } catch(e) {
      console.warn('[tvv] 雲端寫入失敗,僅存本機', e);
      window.TVV_saveLocal(config);
      return { ok: true, source: 'local', warning: e.message };
    }
  }
  const ok = window.TVV_saveLocal(config);
  return { ok, source: 'local' };
};
