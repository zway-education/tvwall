// ╔════════════════════════════════════════════════════════════════╗
// ║                                                                ║
// ║   雲端設定 ・ 部署 Apps Script 後填入這裡                          ║
// ║                                                                ║
// ║   填好之後:                                                     ║
// ║   1. 存檔(Ctrl+S)                                              ║
// ║   2. push 到 GitHub                                            ║
// ║   3. 等 GitHub Pages 1-2 分鐘 rebuild                          ║
// ║   4. 重新整理 admin.html / index.html → 自動切換成雲端模式         ║
// ║                                                                ║
// ║   沒填或填錯:                                                    ║
// ║   系統會自動降級為「本機模式」(資料只存單一裝置 localStorage)      ║
// ║                                                                ║
// ╚════════════════════════════════════════════════════════════════╝

window.TVWALL_API = {

  // 🌐 Apps Script Web App URL
  //   從 Apps Script 編輯器「部署 → 管理現有部署作業」複製
  //   格式:https://script.google.com/macros/s/AKfycb.....長串/exec
  //   未填 = 本機模式
  url: "https://script.google.com/macros/s/AKfycbzKH0FkfTGPWY7Bh0EDuVB05aw-4yZwEQEWh-KoyPSU7PQshK4j4tNyJYI9i4Kt8ZwgPQ/exec",

  // 🔐 API 密鑰
  //   必須跟 Apps Script 內 API_KEY 完全一樣
  //   預設值已配對,通常不用改
  //   要換的話兩邊都要同步換
  key: "tvw_K12_AwarenessSEL_2026_secure_key_v1",

  // ⏱ 雲端同步頻率(毫秒)
  //   電視牆每隔這個時間檢查一次雲端有沒有新內容
  //   建議 30000(30 秒)・ 太短浪費 Apps Script quota、太長更新太慢
  pollInterval: 30000,

};

// 工具:檢查雲端是否啟用
window.TVWALL_isCloudEnabled = function() {
  const api = window.TVWALL_API || {};
  return api.url && api.url !== "PASTE_APPS_SCRIPT_WEB_APP_URL_HERE" && api.url.startsWith("http");
};
