import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export async function createFFmpegStream({
  audioStream,
  imageStream,
  title,
}: {
  audioStream: NodeJS.ReadableStream;
  imageStream: NodeJS.ReadableStream;
  title: string;
}): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    try {
      // --- 1. Préparer le chemin police ---
      const fontPath = path.join(process.cwd(), "public", "fonts", "SF-Pro-Display-Bold.ttf");
      const fontExists = fs.existsSync(fontPath);

      // --- 2. Créer un fichier temporaire pour le texte ---
      const tempTextFile = path.join(os.tmpdir(), `ffmpeg_text_${Date.now()}.txt`);
      fs.writeFileSync(tempTextFile, title);

      // --- 3. Construire le filtre drawtext ---
      let drawTextFilter = `[bg][sw]overlay=0:830`;
      if (fontExists) {
        drawTextFilter += `,drawtext=fontfile='${fontPath}':textfile='${tempTextFile}':x=(w-text_w)/2:y=80:fontsize=48:fontcolor=white:shadowcolor=black:shadowx=2:shadowy=2`;
      }

      // --- 4. Commande FFmpeg ---
      const ffmpegArgs = [
        "-y",
        "-f", "mp3", "-i", "pipe:3",
        "-f", "image2pipe", "-i", "pipe:4",
        "-filter_complex",
        `[1:v]scale=1920:1080[bg];[0:a]showwaves=s=1920x250:mode=line:rate=25[sw];${drawTextFilter}`,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-shortest",
        "-movflags", "frag_keyframe+empty_moov",
        "-f", "mp4",
        "pipe:1"
      ];

      const ffmpeg = spawn("ffmpeg", ffmpegArgs);

      // --- 5. Gestion erreurs ---
      ffmpeg.on("error", (err) => {
        reject(new Error(`FFmpeg failed to start: ${err.message}`));
      });

      ffmpeg.stderr.on("data", (data) => {
        console.error("[FFmpeg]", data.toString());
      });

      // --- 6. Connecter les flux ---
      audioStream.pipe(ffmpeg.stdio[3]);
      imageStream.pipe(ffmpeg.stdio[4]);

      // --- 7. Nettoyage du fichier texte après fin ---
      ffmpeg.on("close", () => {
        fs.unlink(tempTextFile, () => {});
      });

      resolve(ffmpeg.stdout);
    } catch (err) {
      reject(err);
    }
  });
}
