import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const output = "assets/awareness-reel-16x9.mp4";
const maxBytes = 80 * 1024 * 1024;

function ffprobe(file) {
  return JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,duration",
        "-show_entries",
        "format=duration,size,bit_rate",
        "-of",
        "json",
        file,
      ],
      { encoding: "utf8" },
    ),
  );
}

function extractFrame(file, timestamp, output, videoFilter) {
  const filterArgs = videoFilter ? ["-vf", videoFilter] : [];
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-v",
      "error",
      "-ss",
      String(timestamp),
      "-i",
      file,
      ...filterArgs,
      "-frames:v",
      "1",
      output,
    ],
    { stdio: "pipe" },
  );
}

function averagePsnr(first, second) {
  const result = spawnSync(
    "ffmpeg",
    ["-v", "info", "-i", first, "-i", second, "-lavfi", "psnr", "-f", "null", "NUL"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const value = Number(result.stderr.match(/average:([0-9.]+)/)?.[1]);
  assert.ok(Number.isFinite(value), `missing PSNR result:\n${result.stderr}`);
  return value;
}

test("renders the awareness Reel as a TV-wall-ready 16:9 MP4", () => {
  assert.equal(existsSync(output), true);
  assert.ok(statSync(output).size > 1_000_000);
  assert.ok(statSync(output).size < maxBytes);

  const info = ffprobe(output);
  const video = info.streams.find((stream) => stream.codec_type === "video");
  const audio = info.streams.find((stream) => stream.codec_type === "audio");

  assert.equal(video.codec_name, "h264");
  assert.equal(video.width, 1920);
  assert.equal(video.height, 1080);
  assert.equal(video.r_frame_rate, "30/1");
  assert.equal(video.pix_fmt, "yuv420p");
  assert.equal(audio.codec_name, "aac");
  assert.equal(Number(info.format.duration).toFixed(1), "106.1");
  assert.equal(Number(video.duration).toFixed(1), "106.1");
  assert.equal(Number(audio.duration).toFixed(1), "106.1");
  assert.ok(
    Number(info.format.bit_rate) >= 1_800_000,
    `video quality bitrate is too low: ${info.format.bit_rate}`,
  );
});

test("the rendered MP4 preserves HTML entrance motion and content-aware transitions", () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "awareness-reel-motion-"));
  try {
    const entranceA = path.join(tempDir, "entrance-a.png");
    const entranceB = path.join(tempDir, "entrance-b.png");
    const transitionA = path.join(tempDir, "transition-a.png");
    const transitionB = path.join(tempDir, "transition-b.png");

    extractFrame(output, 0.2, entranceA);
    extractFrame(output, 0.8, entranceB);
    extractFrame(output, 9.1, transitionA);
    extractFrame(output, 9.5, transitionB);

    assert.ok(
      averagePsnr(entranceA, entranceB) < 50,
      "intro frames are effectively static instead of preserving HTML entrances",
    );
    assert.ok(
      averagePsnr(transitionA, transitionB) < 50,
      "pain-scene frames are effectively static instead of preserving the transition",
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("the lower-left safe area has no endlessly moving progress decoration", () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "awareness-reel-lower-safe-area-"));
  try {
    const first = path.join(tempDir, "lower-a.png");
    const second = path.join(tempDir, "lower-b.png");
    const lowerLeftCrop = "crop=420:80:40:980";

    extractFrame(output, 1.4, first, lowerLeftCrop);
    extractFrame(output, 2.4, second, lowerLeftCrop);

    assert.ok(
      averagePsnr(first, second) >= 42,
      "the lower-left area still contains a moving progress-like decoration",
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
