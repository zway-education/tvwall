import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
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
        "format=duration,size",
        "-of",
        "json",
        file,
      ],
      { encoding: "utf8" },
    ),
  );
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
});
