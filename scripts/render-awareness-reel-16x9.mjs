import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
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
const sourceVideo =
  "C:\\Users\\KHUser\\Desktop\\Claude\\K12\\行銷\\社群REEL\\reels\\GPT影片版_20260726\\01_覺知是什麼？為什麼這麼重要\\01_影片成品\\01_覺知是什麼？為什麼這麼重要_正式版.mp4";

const sceneDurations = [
  4.0, 3.2, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 4.5, 4.8, 4.8, 4.5, 5.8, 5.8, 7.8, 8.3, 8.3, 8.3, 8.4, 5.3, 7.3,
];

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

await browser.close();

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

const ffmpegArgs = [];
for (const framePath of framePaths) {
  ffmpegArgs.push("-loop", "1", "-framerate", "30", "-i", framePath);
}
ffmpegArgs.push("-i", sourceVideo);

const filters = sceneDurations
  .map((duration, index) => {
    const fadeOutStart = Math.max(0, duration - 0.25).toFixed(3);
    return `[${index}:v]scale=1920:1080,setsar=1,trim=duration=${duration.toFixed(
      3,
    )},setpts=PTS-STARTPTS,fade=t=in:st=0:d=0.18,fade=t=out:st=${fadeOutStart}:d=0.18[v${index}]`;
  })
  .join(";");
const concatInputs = sceneDurations.map((_, index) => `[v${index}]`).join("");
const filterComplex = `${filters};${concatInputs}concat=n=${sceneDurations.length}:v=1:a=0[v]`;

ffmpegArgs.push(
  "-y",
  "-filter_complex",
  filterComplex,
  "-map",
  "[v]",
  "-map",
  `${sceneDurations.length}:a:0`,
  "-t",
  "106.1",
  "-r",
  "30",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-preset",
  "medium",
  "-crf",
  "20",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  "-movflags",
  "+faststart",
  videoOut,
);

await run("ffmpeg", ffmpegArgs);

const probe = await run("ffprobe", [
  "-v",
  "error",
  "-show_entries",
  "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,duration",
  "-show_entries",
  "format=duration,size",
  "-of",
  "json",
  videoOut,
]);

await writeFile(ffprobeOut, probe.stdout, "utf8");

console.log(JSON.stringify({ videoOut, contactSheetOut, ffprobeOut }, null, 2));
