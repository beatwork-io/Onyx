import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';

/**
 * Rend un MP4 simple (image fixe + audio). Pas de texte pour éviter les polices.
 * Retourne un ReadableStream prêt à être uploadé.
 */
export function renderVideoToStream({
  audioBuffer,
  coverBuffer,
}: {
  audioBuffer: Buffer;
  coverBuffer?: Buffer | null;
}): NodeJS.ReadableStream {
  const hasCover = !!coverBuffer;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onyx-'));
  const audioPath = path.join(tmpDir, 'audio.mp3');
  const imagePath = path.join(tmpDir, 'cover.png');

  fs.writeFileSync(audioPath, audioBuffer);
  if (hasCover) fs.writeFileSync(imagePath, coverBuffer as Buffer);

  const args = hasCover
    ? [
        '-y',
        '-loop', '1',
        '-i', imagePath,
        '-i', audioPath,
        '-c:v', 'libx264',
        '-tune', 'stillimage',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-pix_fmt', 'yuv420p',
        '-shortest',
        '-movflags', '+faststart',
        '-f', 'mp4',
        'pipe:1',
      ]
    : [
        '-y',
        '-f', 'lavfi',
        '-i', 'color=size=1280x720:rate=25:color=black',
        '-i', audioPath,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-pix_fmt', 'yuv420p',
        '-shortest',
        '-movflags', '+faststart',
        '-f', 'mp4',
        'pipe:1',
      ];

  const ff = spawn(ffmpegPath || 'ffmpeg', args);
  ff.on('close', () => {
    try { fs.unlinkSync(audioPath); } catch {}
    try { fs.unlinkSync(imagePath); } catch {}
    try { fs.rmdirSync(tmpDir); } catch {}
  });
  return ff.stdout;
}
