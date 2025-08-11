import { spawn } from "child_process";
import { Readable } from "stream";

export function renderVideoToStream({ audioBuffer, coverBuffer, titleOverlay }:{ audioBuffer: Buffer; coverBuffer?: Buffer|null; titleOverlay: string; }): Readable {
  const hasCover = !!coverBuffer;
  const inputs = hasCover
    ? ["-f","mp3","-i","pipe:3","-f","image2pipe","-i","pipe:4"]
    : ["-f","mp3","-i","pipe:3","-f","lavfi","-i","color=size=1920x1080:rate=25:color=black"];

  const vf = [
    `scale=1920:1080`,
    `format=yuv420p`,
    `[0:a]showwaves=s=1920x250:mode=line:rate=25[sw]`,
    `[1:v]scale=1920:1080[bg]`,
    `[bg][sw]overlay=0:830,drawtext=text:'${titleOverlay.replace(/:/g, "\\:").replace(/'/g, "\\'")}':x=(w-text_w)/2:y=80:fontsize=48:fontcolor=white:shadowcolor=black:shadowx=2:shadowy=2`
  ].join(",");

  const args = ["-y", ...inputs, "-filter_complex", vf, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", "-movflags", "frag_keyframe+empty_moov", "-f", "mp4", "pipe:1"];
  const stdio: any = hasCover ? ["ignore","pipe","inherit","pipe","pipe"] : ["ignore","pipe","inherit","pipe","ignore"];
  const ff = spawn("ffmpeg", args as any, { stdio });

  (ff.stdio[3] as any).write(audioBuffer); (ff.stdio[3] as any).end();
  if (hasCover && ff.stdio[4]) { (ff.stdio[4] as any).write(coverBuffer as Buffer); (ff.stdio[4] as any).end(); }

  return ff.stdout as Readable;
}
