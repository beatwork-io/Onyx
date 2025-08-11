import { spawn } from "child_process";
import { Readable } from "stream";
import fs from "fs";
import os from "os";
import path from "path";
import ffmpegPath from "ffmpeg-static";

export function renderVideoToStream({
  audioBuffer,
  coverBuffer,
  titleOverlay,
}: {
  audioBuffer: Buffer;
  coverBuffer?: Buffer | null;
  titleOverlay: string;
}): Readable {
  const hasCover = !!coverBuffer;

  // Chemin de ta police. Mets le fichier ici côté repo:
  // public/fonts/SF-Pro-Display-Bold.ttf
  const fontPath = "/app/public/fonts/SF-Pro-Display-Bold.ttf";
  const hasFont = fs.existsSync(fontPath);

  // Écrit le titre dans un fichier temporaire pour éviter les soucis d’échappement
  const titleFile = path.join(os.tmpdir(), `onyx_title_${Date.now()}.txt`);
  fs.writeFileSync(titleFile, titleOverlay, { encoding: "utf8" });

  const inputs = hasCover
    ? ["-f","mp3","-i","pipe:3","-f","image2pipe","-i","pipe:4"]
    : ["-f","mp3","-i","pipe:3","-f","lavfi","-i","color=size=1920x1080:rate=25:color=black"];

  // IMPORTANT:
  // - si la police n’est pas là, on désactive le texte => pas d’erreur Fontconfig
  // - si elle est là, on FORCE l’utilisation via fontfile= + textfile=
  const drawText = hasFont
    ? `drawtext=fontfile=${fontPath}:textfile=${titleFile}:x=(w-text_w)/2:y=80:fontsize=48:fontcolor=white:shadowcolor=black:shadowx=2:shadowy=2`
    : null;

  const vf = [
    `scale=1920:1080`,
    `format=yuv420p`,
    `[0:a]showwaves=s=1920x250:mode=line:rate=25[sw]`,
    `[1:v]scale=1920:1080[bg]`,
    `[bg][sw]overlay=0:830${drawText ? `,${drawText}` : ""}`,
  ].join(",");

  const args = [
    "-y",
    ...inputs,
    "-filter_complex", vf,
    "-r","25",
    "-c:v","libx264",
    "-pix_fmt","yuv420p",
    "-c:a","aac",
    "-shortest",
    // IMPORTANT YouTube: NO "empty_moov". Utilise faststart sinon YT reste bloqué.
    "-movflags","+faststart",
    "-f","mp4",
    "pipe:1",
  ];

  const stdio: any = hasCover
    ? ["ignore","pipe","inherit","pipe","pipe"]
    : ["ignore","pipe","inherit","pipe","ignore"];

  const bin = (ffmpegPath as string) || "ffmpeg";
  const ff = spawn(bin, args as any, { stdio });

  (ff.stdio[3] as any).write(audioBuffer);
  (ff.stdio[3] as any).end();
  if (hasCover && ff.stdio[4]) {
    (ff.stdio[4] as any).write(coverBuffer as Buffer);
    (ff.stdio[4] as any).end();
  }

  ff.on("close", () => { try { fs.unlinkSync(titleFile); } catch {} });

  return ff.stdout as Readable;
}
