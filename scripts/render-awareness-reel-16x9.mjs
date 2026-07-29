import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const sharp = require("sharp");

const root = process.cwd();
const composition = path.join(root, "video-src", "awareness-reel-16x9", "index.html");
const outputDir = path.join(root, "assets");
const reviewDir = path.join(root, "review", "awareness-reel-16x9");
const frameDir = path.join(reviewDir, "frames");
const videoOut = path.join(outputDir, "awareness-reel-16x9.mp4");
const ffprobeOut = path.join(reviewDir, "awareness-reel-16x9-ffprobe.json");
const contactSheetOut = path.join(reviewDir, "awareness-reel-16x9-contact-sheet.png");
const motionCaptureOut = path.join(reviewDir, "awareness-reel-16x9-motion.webm");
const sourceVideo =
  "C:\\Users\\KHUser\\Desktop\\Claude\\K12\\行銷\\社群REEL\\reels\\GPT影片版_20260726\\01_覺知是什麼？為什麼這麼重要\\01_影片成品\\01_覺知是什麼？為什麼這麼重要_正式版.mp4";

const sceneDurations = [
  4.0, 3.2, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 4.5, 4.8, 4.8, 4.5, 5.8, 5.8, 7.8, 8.3, 8.3, 8.3, 8.4, 5.3, 7.3,
];
const totalDuration = Number(sceneDurations.reduce((total, duration) => total + duration, 0).toFixed(1));

function fileUrl(filePath) {
  return `file:///${filePath.replace(/\\/g, "/")}`;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} exited ${code}\n${stderr}`));
      }
    });
  });
}

await mkdir(outputDir, { recursive: true });
await mkdir(frameDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const framePaths = [];

for (let scene = 0; scene < sceneDurations.length; scene += 1) {
  const framePath = path.join(frameDir, `scene-${String(scene + 1).padStart(2, "0")}.png`);
  await page.goto(`${fileUrl(composition)}?static=1&scene=${scene}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: framePath, fullPage: false });
  framePaths.push(framePath);
}

const thumbW = 480;
const thumbH = 270;
const composites = [];
for (let i = 0; i < framePaths.length; i += 1) {
  const buffer = await sharp(framePaths[i]).resize(thumbW, thumbH).png().toBuffer();
  composites.push({ input: buffer, left: (i % 3) * thumbW, top: Math.floor(i / 3) * thumbH });
}

await sharp({ create: { width: thumbW * 3, height: thumbH * 7, channels: 4, background: "#f7fbf5" } })
  .composite(composites)
  .png()
  .toFile(contactSheetOut);

await unlink(motionCaptureOut).catch(() => {});
const captureContext = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: {
    dir: reviewDir,
    size: { width: 1920, height: 1080 },
  },
});
const capturePage = await captureContext.newPage();
await capturePage.goto(`${fileUrl(composition)}?record=1`, { waitUntil: "networkidle" });
await capturePage.waitForFunction(() => Boolean(window.TV_REEL_PLAYER));
const recordedVideo = capturePage.video();
await capturePage.evaluate(() => window.TV_REEL_PLAYER.startCapture());
await capturePage.waitForTimeout(totalDuration * 1000);
await capturePage.close();
await recordedVideo.saveAs(motionCaptureOut);
await captureContext.close();
await recordedVideo.delete();
await browser.close();

const ffmpegArgs = [
  "-sseof",
  `-${totalDuration.toFixed(1)}`,
  "-i",
  motionCaptureOut,
  "-i",
  sourceVideo,
  "-y",
  "-filter_complex",
  `[0:v]scale=1920:1080:flags=lanczos,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=1,trim=duration=${totalDuration.toFixed(
    1,
  )},setpts=PTS-STARTPTS[v]`,
  "-map",
  "[v]",
  "-map",
  "1:a:0",
  "-t",
  totalDuration.toFixed(1),
  "-r",
  "30",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-profile:v",
  "high",
  "-level:v",
  "4.1",
  "-preset",
  "slow",
  "-crf",
  "17",
  "-colorspace",
  "bt709",
  "-color_primaries",
  "bt709",
  "-color_trc",
  "bt709",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  "-movflags",
  "+faststart",
  videoOut,
];

await run("ffmpeg", ffmpegArgs);
await unlink(motionCaptureOut).catch(() => {});

const probe = await run("ffprobe", [
  "-v",
  "error",
  "-show_entries",
  "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,duration",
  "-show_entries",
  "format=duration,size,bit_rate",
  "-of",
  "json",
  videoOut,
]);

await writeFile(ffprobeOut, probe.stdout, "utf8");

console.log(JSON.stringify({ videoOut, contactSheetOut, ffprobeOut, totalDuration }, null, 2));
