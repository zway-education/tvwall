# LINE QR Code Enlargement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 放大第 1、5 頁的 LINE QR Code，同時保證其他活動 QR Code 不變。

**Architecture:** 保留既有 vanilla HTML/CSS 與 1920×1080 固定舞台，只改兩個頁面 modifier 中的 `--qr-size`。使用 Node 文字結構測試精確鎖定尺寸與不變範圍，再以瀏覽器做 16:9 視覺驗證。

**Tech Stack:** HTML、CSS、JavaScript、Node.js 內建測試器

## Global Constraints

- 第 1 頁 LINE QR 必須是 `340px`。
- 第 5 頁 LINE QR 必須是 `360px`。
- `.signup-panel img` 必須維持 `320px`。
- `.focus-event__qr img` 必須維持 `226px`。
- 不修改其他頁面、文案、連結、輪播順序或時間。

---

### Task 1: 放大兩個 LINE QR Code

**Files:**
- Modify: `index.html`
- Create: `tests/line-qr-size.test.mjs`

**Interfaces:**
- Consumes: `.restored-line-panel--old-1`、`.restored-line-panel--old-5` 的 CSS 變數。
- Produces: 第 1 頁 340px 與第 5 頁 360px 的 QR 顯示尺寸。

- [ ] **Step 1: Write the failing test**

建立 Node 測試，讀取 `index.html` 並精確檢查四個 selector 的尺寸。

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/line-qr-size.test.mjs`

Expected: 第 1 頁或第 5 頁尺寸斷言失敗。

- [ ] **Step 3: Write minimal implementation**

只修改：

```css
.restored-line-panel--old-1 { --qr-size: 340px; }
.restored-line-panel--old-5 { --qr-size: 360px; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/line-qr-size.test.mjs`

Expected: 全部通過。

- [ ] **Step 5: Verify rendered layout**

在 1920×1080 舞台確認兩個 QR 沒有溢出白框、沒有遮住 CTA，且活動 QR 尺寸未變。

- [ ] **Step 6: Commit**

```bash
git add index.html tests/line-qr-size.test.mjs docs/superpowers
git commit -m "fix: enlarge LINE QR codes for TV scanning"
```
