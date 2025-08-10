import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { defaultDescription, defaultTitle } from "@/lib/templates";
import { renderVideo } from "@/lib/ffmpeg";
import { uploadAndSchedule } from "@/lib/youtube";
import { nextAutoSlot } from "@/lib/autoslot";
export const config = { api: { bodyParser: false } };
async function runPythonAnalyze(audioPath: string) {
  const { spawn } = await import("child_process");
  return await new Promise<{ bpm: number|null; key: string|null; confidence_bpm: number; confidence_key: number; strategy: string }>((resolve, reject) => {
    const p = spawn("python3", [path.join(process.cwd(), "workers", "analyze.py"), audioPath]);
    let out = ""; let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("exit", (code) => {
      if (code === 0) {
        try { resolve(JSON.parse(out)); } catch (e) { reject(e); }
      } else reject(new Error(err || `analyze exit ${code}`));
    });
  });
}
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const form = formidable({ multiples: false, uploadDir: process.env.UPLOAD_DIR || "./uploads", keepExtensions: true });
  const [fields, files] = await form.parse(req).then(([f, fl]) => [f, fl]) as any;
  const clientId = String(fields.clientId);
  const channelId = String(fields.channelId);
  const beatName = String(fields.beatName || "Untitled");
  const primaryType = String(fields.primaryType || "Type Beat");
  const publishAtRaw = fields.publishAt ? new Date(String(fields.publishAt)) : null;
  const autoSlot = String(fields.autoSlot || "true") === "true";
  const audioPath = files.audio?.filepath as string;
  const coverPath = files.cover?.filepath as string || path.join(process.cwd(), "public", "placeholder.png");
  let beat = await prisma.beat.create({ data: { clientId, channelId, title: "", description: "", tags: [], fileAudio: audioPath, fileCover: coverPath, status: "ANALYZING" }});
  try {
    const an = await runPythonAnalyze(audioPath);
    const bpm = an.bpm ? Math.round(an.bpm) : null;
    const Key = an.key;
    const title = defaultTitle({ PrimaryType: primaryType, BeatName: beatName, BPM: bpm ?? undefined, Key });
    const description = defaultDescription({ PrimaryType: primaryType, BeatName: beatName, BPM: bpm ?? undefined, Key, BeatStarsURL: null, Email: "contact@example.com", Hashtags: ["typebeat", primaryType.split(" ")[0].toLowerCase()] });
    beat = await prisma.beat.update({ where: { id: beat.id }, data: { bpm: bpm ?? undefined, key: Key ?? undefined, confidenceBpm: an.confidence_bpm, confidenceKey: an.confidence_key, keyStrategy: an.strategy, title, description, status: "RENDERING" }});
    const outVideo = path.join(process.env.RENDER_DIR || "./renders", `${beat.id}.mp4`);
    fs.mkdirSync(path.dirname(outVideo), { recursive: true });
    await renderVideo({ audioPath, coverPath, outPath: outVideo, titleOverlay: `${primaryType} — ${beatName}` });
    await prisma.beat.update({ where: { id: beat.id }, data: { fileVideo: outVideo, status: "UPLOADING" }});
    let publishAt = publishAtRaw ?? null;
    if (!publishAt && autoSlot) {
      const scheduled = await prisma.beat.findMany({ where: { channelId, publishAt: { not: null } }, select: { publishAt: true } });
      publishAt = nextAutoSlot(scheduled.map(s => s.publishAt!) );
    }
    if (!publishAt) publishAt = new Date(Date.now() + 48 * 3600 * 1000);
    const videoId = await uploadAndSchedule({ channelId, filePath: outVideo, title: beat.title, description: beat.description, tags: beat.tags || [], publishAt, playlistId: undefined });
    beat = await prisma.beat.update({ where: { id: beat.id }, data: { youTubeVideoId: videoId, publishAt, status: "SCHEDULED" }});
    res.json({ ok: true, beat });
  } catch (e: any) {
    await prisma.beat.update({ where: { id: beat.id }, data: { status: "FAILED", error: String(e) } });
    res.status(500).json({ ok: false, error: String(e) });
  }
}
