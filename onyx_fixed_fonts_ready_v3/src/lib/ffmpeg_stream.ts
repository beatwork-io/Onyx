import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import ffmpegPath from "ffmpeg-static";

/**
 * Rend un MP4 (cover + waveform). Texte désactivé TEMPORAIREMENT pour éviter tout blocage.
 * YouTube-friendly: H.264/AAC yuv420p +faststart.
 */
export function renderVideoToStream({
  audioBuffer,
  coverBuffer,
  titleOverlay,
}: {
  audioBuffer: Buffer;
  coverBuffer?: Buffer | null;
  titleOverlay: string;
}): NodeJS.ReadableStream {
  const hasCover = !!coverBuffer;

  // (désactivé) Police / drawtext
  const titleFile = path.join(os.tmpdir(), `onyx_title_${Date.now()}.txt`);
  fs.writeFileSync(titleFile, titleOverlay, { encoding: "utf8" });
  const drawText = ""; // <— pas de texte pour stabiliser

  const inputs = hasCover
    ? ["-f", "mp3", "-i", "pipe:3", "-f", "image2pipe", "-i", "pipe:4"]
    : ["-f", "mp3", "-i", "pipe:3", "-f", "lavfi", "-i", "color=size=1920x1080:rate=25:color=black"];

  const vf = [
    `[1:v]scale=1920:1080[bg]`,
    `[0:a]showwaves=s=1920x250:mode=line:rate=25[sw]`,
    `[bg][sw]overlay=0:830${drawText}`,
  ].join(";");

  const args = [
    "-y",
    ...inputs,
    "-filter_complex", vf,
    "-r", "25",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-shortest",
    "-movflags", "+faststart",
    "-f", "mp4",
    "pipe:1",
  ];

  const stdio: any = hasCover
    ? ["ignore", "pipe", "inherit", "pipe", "pipe"]
    : ["ignore", "pipe", "inherit", "pipe", "ignore"];

  const bin = (ffmpegPath as string) || "ffmpeg";
  const ff = spawn(bin, args as any, { stdio });

  (ff.stdio[3] as any).write(audioBuffer);
  (ff.stdio[3] as any).end();
  if (hasCover && ff.stdio[4]) {
    (ff.stdio[4] as any).write(coverBuffer as Buffer);
    (ff.stdio[4] as any).end();
  } else {
    try { (ff.stdio[4] as any).end(); } catch {}
  }

  ff.on("close", () => { try { fs.unlinkSync(titleFile); } catch {} });

  return ff.stdout as NodeJS.ReadableStream;
}
