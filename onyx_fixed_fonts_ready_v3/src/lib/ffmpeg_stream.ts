import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import ffmpegPath from "ffmpeg-static";

/**
 * Rend une vidéo MP4 (cover + waveform + texte optionnel) en STREAM (stdout).
 * - Police optionnelle à /app/public/fonts/SF-Pro-Display-Bold.ttf
 * - Si la police manque, on désactive le texte pour éviter Fontconfig errors.
 * - mp4 H.264/AAC yuv420p +faststart (YouTube friendly)
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

  // Police (optionnelle)
  const fontPath = "/app/public/fonts/SF-Pro-Display-Bold.ttf";
  const hasFont = fs.existsSync(fontPath);

  // Titre dans fichier temporaire (évite échappements et "Both text and text file provided")
  const titleFile = path.join(os.tmpdir(), `onyx_title_${Date.now()}.txt`);
  fs.writeFileSync(titleFile, titleOverlay, { encoding: "utf8" });

  // Inputs
  const inputs = hasCover
    ? ["-f", "mp3", "-i", "pipe:3", "-f", "image2pipe", "-i", "pipe:4"]
    : ["-f", "mp3", "-i", "pipe:3", "-f", "lavfi", "-i", "color=size=1920x1080:rate=25:color=black"];

  // Filter
  const drawText = hasFont
    ? `,drawtext=fontfile=${fontPath}:textfile=${titleFile}:x=(w-text_w)/2:y=80:fontsize=48:fontcolor=white:shadowcolor=black:shadowx=2:shadowy=2`
    : "";

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

  // push buffers
  (ff.stdio[3] as any).write(audioBuffer);
  (ff.stdio[3] as any).end();
  if (hasCover && ff.stdio[4]) {
    (ff.stdio[4] as any).write(coverBuffer as Buffer);
    (ff.stdio[4] as any).end();
  }

  // cleanup
  ff.on("close", () => {
    try { fs.unlinkSync(titleFile); } catch {}
  });

  return ff.stdout as NodeJS.ReadableStream;
}
