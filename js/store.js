// ╔══════════════════════════════════════════════════════════════╗
// ║  電視牆 儲存層 ・ IndexedDB                                      ║
// ║  取代會「靜默失敗」的 localStorage + Apps Script。               ║
// ║  - 容量遠大於 localStorage(圖片不會再塞爆)                      ║
// ║  - 寫入失敗 → Promise reject(明確報錯,絕不假裝成功)            ║
// ╚══════════════════════════════════════════════════════════════╝
(function(){
  const DB_NAME = 'tvwall_db';
  const DB_VER  = 1;
  let _dbp = null;

  function db(){
    if (_dbp) return _dbp;
    _dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('config')) d.createObjectStore('config');
        if (!d.objectStoreNames.contains('assets')) d.createObjectStore('assets');
      };
      r.onsuccess = () => res(r.result);
      r.onerror  = () => rej(r.error);
    });
    return _dbp;
  }

  // 包一層:單一 request,成功回 result、失敗 reject
  function run(store, mode, op){
    return db().then(d => new Promise((res, rej) => {
      const t = d.transaction(store, mode);
      const s = t.objectStore(store);
      const rq = op(s);
      rq.onsuccess = () => res(rq.result);
      rq.onerror  = () => rej(rq.error);
      t.onerror   = () => rej(t.error);
    }));
  }

  window.TVWALL_store = {
    // ── 設定(單筆,key='main')──
    loadConfig: () => run('config', 'readonly',  s => s.get('main')),
    saveConfig: (cfg) => run('config', 'readwrite', s => s.put(cfg, 'main')),

    // ── 圖片資產(保留給未來 Blob 化;v1 圖片暫存在 config 內)──
    putAsset: (data) => {
      const id = 'a_' + Math.random().toString(36).slice(2, 10);
      return run('assets', 'readwrite', s => s.put(data, id)).then(() => id);
    },
    getAsset: (id) => run('assets', 'readonly', s => s.get(id)),
    getAssetURL: (id) => window.TVWALL_store.getAsset(id).then(v => {
      if (!v) return '';
      if (typeof v === 'string') return v;        // 直接是 dataURL
      return URL.createObjectURL(v);              // 是 Blob
    }),

    // ── 匯出 / 匯入備份 ──
    exportAll: async () => {
      const cfg = await window.TVWALL_store.loadConfig();
      const out = cfg || (window.TVWALL_merge ? window.TVWALL_merge({}) : {});
      return new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    },
    importAll: async (jsonText) => {
      const parsed = JSON.parse(jsonText);
      // 擋掉明顯不對的檔案(v2 殼或缺核心欄位),避免覆蓋掉好資料
      if (!parsed || typeof parsed !== 'object' || parsed.version === 2 ||
          (parsed.qr === undefined && parsed.testimonies === undefined && parsed.durations === undefined)) {
        throw new Error('這不是電視牆的備份檔');
      }
      const cfg = window.TVWALL_merge ? window.TVWALL_merge(parsed) : parsed;
      await window.TVWALL_store.saveConfig(cfg);
      return cfg;
    },

    // ── 載入(首次自動從舊 localStorage v1 搬遷),回傳經 defaults 合併的完整設定 ──
    loadOrMigrate: async () => {
      let raw = await window.TVWALL_store.loadConfig();
      let ls = null;
      try { const s = localStorage.getItem('tvwall_config'); if (s) ls = JSON.parse(s); } catch (e) {}
      if (!raw) {
        // 首次:從舊 localStorage 搬遷(備份 + 種進 IndexedDB)
        if (ls) {
          try { localStorage.setItem('tvwall_config_backup_v1', JSON.stringify(ls)); } catch (e) {}
          raw = ls;
          try { await window.TVWALL_store.saveConfig(raw); } catch (e) {}
        }
      } else if (ls && (ls._savedAt || 0) > (raw._savedAt || 0)) {
        // localStorage 比 IndexedDB 新(後台在 IDB 寫完前就關了)→ 採用並補寫
        raw = ls;
        try { await window.TVWALL_store.saveConfig(raw); } catch (e) {}
      }
      return window.TVWALL_merge ? window.TVWALL_merge(raw || {}) : (raw || null);
    },

    // ── 通知同瀏覽器其他分頁(電視牆)設定已更新 ──
    notifyUpdated: () => {
      try { const bc = new BroadcastChannel('tvwall'); bc.postMessage({ type: 'config-updated' }); bc.close(); }
      catch (e) { /* 不支援時略過 */ }
    },

    // ── 測試用:清空設定 ──
    _wipeConfig: () => run('config', 'readwrite', s => s.clear())
  };
})();
