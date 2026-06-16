// ╔══════════════════════════════════════════════════════════════╗
// ║  電視牆 v2 資料模型(單一真實來源)                                ║
// ║  - slides[] 取代寫死的 15 張 + slidesOrder + hiddenSlides       ║
// ║  - 每張 slide 自帶 type / show / sec / content                  ║
// ║  - 圖片以 dataURL 字串存在 content 內(v1),未來可改 Blob asset  ║
// ╚══════════════════════════════════════════════════════════════╝
(function(){
  window.TVWALL_SCHEMA_VERSION = 2;

  // 內建特殊版型(沿用現有 15 張的設計) + 7 種通用新增範本
  window.TVWALL_SLIDE_TYPES = [
    // 7 種通用範本(新增 slide 用):
    'hero', 'imitext', 'testimony', 'qr', 'highlights', 'announcement', 'fullimage',
    // 既有特殊版型(渲染沿用舊設計,遷移時對應):
    'stages', 'founder'
  ];

  // 產生一張新的 slide(含穩定 id)
  window.TVWALL_newSlide = function(type, partial){
    return Object.assign({
      id: 's_' + Math.random().toString(36).slice(2, 9),
      type: type,
      show: true,
      sec: 8,
      content: {}
    }, partial || {});
  };

  // 空白 v2 設定
  window.TVWALL_emptyConfigV2 = function(){
    return {
      version: 2,
      slides: [],
      globals: {
        qr: { line: '', mindspectrum: '', facebook: '', instagram: '' },
        theme: 'emerald',
        layout: 'A',
        orientation: 'landscape',
        testimonyInterval: 6000
      }
    };
  };
})();
