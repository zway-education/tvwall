// ╔════════════════════════════════════════════════════════════════╗
// ║   直式電視牆 ・ 雲端設定                                          ║
// ║   獨立於橫式版 ・ 要建另一個 Google Sheet + Apps Script           ║
// ║                                                                ║
// ║   設定步驟:                                                     ║
// ║   1. 建新 Google Sheet「tvwall_v_config」(用 KWJ 個人帳號)       ║
// ║   2. Sheet → 擴充功能 → Apps Script → 貼                          ║
// ║      vertical/cloud_setup/tvwall_api.gs(API_KEY 末尾 _VERTICAL) ║
// ║   3. 跑 initialize → 部署為 Web App                              ║
// ║   4. 把得到的 URL 貼進下方 url 欄位                                ║
// ║   5. push 到 GitHub Pages → 重整 vertical.html 即生效              ║
// ║                                                                ║
// ║   未填或填錯:自動降級為「本機模式」(只在當前裝置儲存)              ║
// ║                                                                ║
// ║   ⚠ 跟橫式同 namespace (TVWALL_*) 但用不同 URL + 不同              ║
// ║   localStorage key (tvwall_v_config),所以兩套互不干擾。           ║
// ╚════════════════════════════════════════════════════════════════╝

window.TVWALL_API = {

  // 🌐 Apps Script Web App URL(直式專屬,別跟橫式共用)
  //   未填 = 本機模式
  url: "PASTE_VERTICAL_APPS_SCRIPT_URL_HERE",

  // 🔐 API 密鑰(直式專屬,別跟橫式共用)
  //   跟 vertical/cloud_setup/tvwall_api.gs 內 API_KEY 對齊
  key: "tvw_K12_AwarenessSEL_2026_VERTICAL_secure_key_v1",

  // ⏱ 雲端同步頻率(毫秒)
  pollInterval: 30000,

};

// 工具:檢查雲端是否啟用
window.TVWALL_isCloudEnabled = function() {
  const api = window.TVWALL_API || {};
  return api.url && api.url !== "PASTE_VERTICAL_APPS_SCRIPT_URL_HERE" && api.url.startsWith("http");
};
