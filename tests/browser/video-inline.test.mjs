// Run with PLAYWRIGHT_MODULE_PATH set when Playwright is not locally installed.
// TVWALL_BASE_URL can point at the deployed site for the same checks.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.TVWALL_BASE_URL || pathToFileURL(resolve('index.html')).href;
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function openVideo(t, index = 11) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(8000);
  t.after(() => page.close());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  const url = new URL(base);
  url.searchParams.set('start', String(index));
  await page.goto(url.href);
  assert.equal(await page.locator('.slide.is-active video').count(), 1, `slide ${index} must contain its inline video`);
  await page.waitForFunction(() => {
    const video = document.querySelector('.slide.is-active video');
    return video && video.currentTime > 0.15 && !video.paused;
  });
  return page;
}

test('the video surface cannot receive pointer or menu input that launches a player', async t => {
  const page = await openVideo(t);
  const state = await page.evaluate(() => {
    const video = document.querySelector('.slide.is-active video');
    const rect = video.getBoundingClientRect();
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    video.dispatchEvent(menu);
    return {
      hitVideo: document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === video,
      menuPrevented: menu.defaultPrevented,
      controls: video.controls,
      tabIndex: video.tabIndex,
      inline: video.playsInline,
      pip: video.disablePictureInPicture,
      remote: video.disableRemotePlayback,
      fullscreenControl: video.controlsList.contains('nofullscreen'),
    };
  });
  assert.deepEqual(state, {
    hitVideo: false, menuPrevented: true, controls: false, tabIndex: -1,
    inline: true, pip: true, remote: true, fullscreenControl: true,
  });
  await page.mouse.dblclick(640, 360);
  assert.equal(await page.evaluate(() => document.fullscreenElement === null), true);
  assert.equal(await page.locator('.slide.is-active video').evaluate(v => v.paused), false);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.tagName === 'VIDEO'), false);
});

test('video-only fullscreen returns to the page without blocking whole-page fullscreen', async t => {
  const page = await openVideo(t);
  await page.evaluate(() => {
    const button = document.createElement('button');
    button.id = 'fullscreen-test';
    button.style.cssText = 'position:fixed;top:0;left:0;z-index:99999';
    button.textContent = 'Fullscreen test';
    button.onclick = () => document.querySelector('.slide.is-active video').requestFullscreen();
    document.body.appendChild(button);
  });
  await page.locator('#fullscreen-test').click();
  await page.waitForTimeout(150);
  await page.waitForFunction(() => !document.fullscreenElement, null, { timeout: 3000 });
  const inlineTime = await page.locator('.slide.is-active video').evaluate(v => v.currentTime);
  await page.waitForFunction(previous => {
    const video = document.querySelector('.slide.is-active video');
    return !video.paused && video.currentTime > previous + 0.1;
  }, inlineTime);
  await page.evaluate(() => {
    document.getElementById('fullscreen-test').onclick = () => document.documentElement.requestFullscreen();
  });
  await page.locator('#fullscreen-test').click();
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => document.fullscreenElement === document.documentElement), true);
  await page.evaluate(() => {
    document.getElementById('fullscreen-test').onclick = () => document.querySelector('.slide.is-active video').requestFullscreen();
  });
  await page.locator('#fullscreen-test').click();
  await page.waitForTimeout(150);
  await page.waitForFunction(() => document.fullscreenElement === document.documentElement);
  assert.equal(await page.locator('.slide.is-active video').evaluate(v => v.paused), false);
  await page.evaluate(() => document.exitFullscreen());
});

for (const [index, next] of [[11, 12], [12, 13], [17, 0]]) {
  test(`video ${index} ends in the webpage and advances once to slide ${next}`, async t => {
    const page = await openVideo(t, index);
    if (index === 17) {
      assert.equal(await page.locator('.slide').count(), 18);
      const media = await page.locator('.slide.is-active video').evaluate(v => ({ src: v.currentSrc, duration: v.duration, inline: v.playsInline, muted: v.muted, controls: v.controls }));
      assert.ok(media.src.includes('/assets/park-inquiry-original-20260915.mp4'));
      assert.ok(Math.abs(media.duration - 79.05) < 0.1);
      assert.equal(media.inline, true);
      assert.equal(media.muted, true);
      assert.equal(media.controls, false);
    }
    await page.mouse.click(1, 1); // The real gesture required to unlock background audio.
    await page.waitForFunction(() => document.getElementById('tvSoundtrack').currentTime > 0);
    assert.deepEqual(await page.locator('.slide.is-active video').evaluate(v => [v.videoWidth, v.videoHeight]), [1920, 1080]);
    const soundtrackStart = await page.locator('#tvSoundtrack').evaluate(a => a.currentTime);
    await page.locator('.slide.is-active video').evaluate(v => { v.currentTime = v.duration - 0.5; });
    await page.waitForFunction(i => document.querySelector('.slide.is-active').dataset.index === String(i), next);
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.slide.is-active').getAttribute('data-index'), String(next));
    assert.equal(await page.locator(`.slide[data-index="${index}"] video`).evaluate(v => v.paused), true);
    assert.ok(await page.locator('#tvSoundtrack').evaluate(a => a.currentTime) > soundtrackStart);
    assert.equal(await page.evaluate(() => document.fullscreenElement), null);
    assert.equal(new URL(page.url()).pathname, new URL(base).pathname);
  });
}
