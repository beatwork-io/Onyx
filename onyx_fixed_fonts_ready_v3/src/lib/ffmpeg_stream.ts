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

  // Police optionnelle : si absente => pas de texte (aucune erreur fontconfig)
  const fontPath = "/app/public/fonts/SF-Pro-Display-Bold.ttf";
  const hasFont = fs.existsSync(fontPath);

  // Pour éviter toute ambiguïté sur drawtext, on écrit le titre dans un fichier temporaire
  const titleFile = path.join(os.tmpdir(), `onyx_title_${Date.now()}.txt`);
  // ffmpeg lit tel quel: pas besoin d’échapper ici
  fs.writeFileSync(titleFile, titleOverlay, { encoding: "utf8" });

  const inputs = hasCover
    ? ["-f","mp3","-i","pipe:3","-f","image2pipe","-i","pipe:4"]
    : ["-f","mp3","-i","pipe:3","f","lavfi","-i","color=size=1920x1080:rate=25:color=black"];

  const drawText = hasFont
    ? `drawtext=fontfile=${fontPath}:textfile=${titleFile}:x=(w-text_w)/2:y=80:fontsize=48:fontcolor=white:shadowcolor=black:shadowx=2:shadowy=2`
    : null; // pas de police => pas de texte

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
    // IMPORTANT pour YouTube: pas de "empty_moov" (cause stuck processing). Utilise faststart.
    "-movflags","+faststart",
    "-f","mp4",
    "pipe:1",
  ];

  const stdio: any = hasCover ? ["ignore","pipe","inherit","pipe","pipe"] : ["ignore","pipe","inherit","pipe","ignore"];
  const bin = (ffmpegPath as string) || "ffmpeg";
  const ff = spawn(bin, args as any, { stdio });

  // push buffers dans les pipes
  (ff.stdio[3] as any).write(audioBuffer);
  (ff.stdio[3] as any).end();
  if (hasCover && ff.stdio[4]) {
    (ff.stdio[4] as any).write(coverBuffer as Buffer);
    (ff.stdio[4] as any).end();
  }

  // Nettoyage du fichier titre quand le process finit
  ff.on("close", () => { try { fs.unlinkSync(titleFile); } catch {} });

  return ff.stdout as Readable;
}
