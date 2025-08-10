import { spawn } from "child_process";
export function renderVideo({ audioPath, coverPath, outPath, titleOverlay }:{audioPath:string;coverPath:string;outPath:string;titleOverlay:string;}): Promise<void> {
  return new Promise((resolve, reject) => {
    const vf = [
      `scale=1920:1080`,
      `format=yuv420p`,
      `[0:a]showwaves=s=1920x250:mode=line:rate=25[sw]`,
      `[1:v]scale=1920:1080[bg]`,
      `[bg][sw]overlay=0:830,drawtext=fontfile=/Library/Fonts/Arial.ttf:text='${titleOverlay.replace(/:/g, "\\:") }':x=(w-text_w)/2:y=80:fontsize=48:fontcolor=white:shadowcolor=black:shadowx=2:shadowy=2`,
    ].join(",");
    const args = ["-y","-i", audioPath,"-loop","1","-i",coverPath,"-filter_complex",vf,"-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-shortest",outPath];
    const ff = spawn("ffmpeg", args);
    ff.stderr.on("data", d => process.stderr.write(d));
    ff.on("exit", code => code===0?resolve():reject(new Error(`ffmpeg exit ${code}`)));
  });
}
