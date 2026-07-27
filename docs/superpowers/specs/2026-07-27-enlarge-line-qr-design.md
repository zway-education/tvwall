# LINE QR Code 放大設計

## 目標

只放大電視輪播第 1 頁與第 5 頁的 LINE 加好友 QR Code，提升小型電視上的掃描成功率。

## 尺寸

- 第 1 頁 `.restored-line-panel--old-1`：`--qr-size` 從 `290px` 改為 `340px`。
- 第 5 頁 `.restored-line-panel--old-5`：`--qr-size` 從 `310px` 改為 `360px`。

## 不變範圍

- 兩頁既有白色方框、位置、CTA 文字與 LINE 連結不變。
- 成大活動與親子體驗活動的 QR Code 尺寸不變。
- 15 頁輪播順序、時間、圖片與文案不變。

## 驗證

- 自動測試精確檢查兩個 CSS 變數的新尺寸。
- 自動測試確認活動 QR Code 仍維持 `320px` 與 `226px`。
- 在 16:9 實際頁面確認兩個 QR 置中、沒有溢出或遮住 CTA。
