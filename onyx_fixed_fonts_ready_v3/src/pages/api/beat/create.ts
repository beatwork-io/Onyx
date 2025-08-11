// src/pages/api/beat/create.ts
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import os from "os";
import path from "path";
import formidable from "formidable";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";

import prisma from "@/lib/db";
import { defaultDescription, defaultTitle } from "@/lib/templates";
import { nextAutoSlot } from "@/lib/autoslot";
import { uploadAndSchedule } from "@/lib/youtube";

export const config = { api: { bodyParser: false } };

// --- utils ---
async function parseForm(req: NextApiRequest): Promise<{
  fields: Record<string, any>;
  audioBuf: Buffer;
  coverBuf: Buffer | null;
  beatName: string;
  primaryType: string;
  clientId: string;
  channelId: string;
  publishAtRaw: Date | null;
  autoSlot: boolean;
}> {
  const form = formidable({
    multiples: false,
    keepExtensions: true,
    uploadDir: os.tmpdir(),
    maxFileSize: 1024 * 1024 * 500, // 500MB
  });

  const { fields, files }: any = await new Promise((resolve, reject) => {
    form.parse(req, (err, f, fl) => (err ? reject(err) : resolve({ fields: f, files: fl })));
  });

  const af = files?.audio?.[0] ?? files?.audio;
  if (!af?.filepath) throw new Error("No audio buffer received");
  const cf = files?.cover?.[0] ?? files?.cover;

  const audioBuf = fs.readFileSync(af.filepath);
  const coverBuf = cf?.filepath ? fs.readFileSync(cf.filepath) : null;

  try { fs.unlinkSync(af.filepath); } catch {}
  try { if (cf?.filepath) fs.unlinkSync(cf.filepath); } catch {}

  const beatName = String(fields.beatName || "Untitled");
  const primaryType = String(fields.primaryType || "Type Beat");
  const clientId = String(fields.clientId);
  const channelId = String(fields.channelId);
  const publishAtRaw = fields.publishAt ? new Date(String(fields.publishAt)) : null;
  const autoSlot = String(fields.autoSlot || "true") === "true";

  return { fields, audioBuf, coverBuf, beatName, primaryType, clientId, channelId, publishAtRaw, autoSlot };
}

function buildFFmpegProcess(opts: {
  audioBuf: Buffer;
  coverBuf: Buffer | null;
  titleOverlay: string;
}) {
  const { audioBuf, coverBuf, titleOverlay } = opts;

  // 1) Police optionnelle : si absente, on saute drawtext (aucune erreur Fontconfig).
  const fontPath = "/app/public/fonts/SF-Pro-Display-Bold.ttf";
  const hasFont = fs.existsSync(fontPath);

  // 2) Fichier temporaire pour le titre (évite l’échappement et “Both text and text file provided”)
  const titleFile = path.join(os.tmpdir(), `onyx_title_${Date.now()}.txt`);
  fs.writeFileSync(titleFile, titleOverlay, { encoding: "utf8" });

  // 3) Inputs : toujours 2 entrées pour simplifier le graphe
  //    - Input 0 = audio (pipe:3)
  //    - Input 1 = image (pipe:4) OU générée via lavfi (color)
  const useLavfi = !coverBuf;
  const inputs = useLavfi
    ? ["-f", "mp3", "-i", "pipe:3", "-f", "lavfi", "-i", "color=size=1920x1080:rate=25:color=black"]
    : ["-f", "mp3", "-i", "pipe:3", "-f", "image2pipe", "-i", "pipe:4"];

  // 4) Filtre vidéo
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
    // IMPORTANT pour YouTube: +faststart (pas "empty_moov")
    "-movflags", "+faststart",
    "-f", "mp4",
    "pipe:1",
  ];

  // stdio : 0 stdin, 1 stdout, 2 stderr, 3 pipe audio in, 4 pipe image in
  const stdio: any = ["ignore", "pipe", "inherit", "pipe", "pipe"];
  const bin = (ffmpegPath as string) || "ffmpeg";
  const ff = spawn(bin, args as any, { stdio });

  // push audio
  (ff.stdio[3] as any).write(audioBuf);
  (ff.stdio[3] as any).end();

  // push image si dispo
  if (!useLavfi && coverBuf) {
    (ff.stdio[4] as any).write(coverBuf);
    (ff.stdio[4] as any).end();
  } else {
    try { (ff.stdio[4] as any).end(); } catch {}
  }

  // cleanup
  ff.on("close", () => { try { fs.unlinkSync(titleFile); } catch {} });

  return ff.stdout as NodeJS.ReadableStream;
}

// --- handler ---
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { audioBuf, coverBuf, beatName, primaryType, clientId, channelId, publishAtRaw, autoSlot } = await parseForm(req);

    // 1) Create row
    let beat = await prisma.beat.create({
      data: {
        clientId,
        channelId,
        title: "",
        description: "",
        tags: [],
        fileAudio: "",
        fileCover: "",
        status: "ANALYZING",
      },
    });

    // 2) Build title/description
    const title = defaultTitle({ PrimaryType: primaryType, BeatName: beatName });
    const description = defaultDescription({
      PrimaryType: primaryType,
      BeatName: beatName,
      BPM: null,
      Key: null,
      BeatStarsURL: null,
      Email: "contact@example.com",
      Hashtags: ["typebeat"],
    });
    beat = await prisma.beat.update({ where: { id: beat.id }, data: { title, description, status: "RENDERING" } });

    // 3) Render (ffmpeg → stdout stream)
    const titleOverlay = `${primaryType} — ${beatName}`;
    const mp4Stream = buildFFmpegProcess({ audioBuf, coverBuf, titleOverlay });

    // 4) publishAt robuste
    let publishAt: Date;
    if (publishAtRaw && !isNaN(publishAtRaw.getTime())) {
      publishAt = publishAtRaw;
    } else if (autoSlot) {
      const scheduled = await prisma.beat.findMany({
        where: { channelId, publishAt: { not: null } },
        select: { publishAt: true },
      });
      publishAt = nextAutoSlot(scheduled.map((s) => s.publishAt!));
    } else {
      publishAt = new Date(Date.now() + 48 * 3600 * 1000);
    }

    // 5) Upload & schedule (stream direct → YouTube)
    const videoId = await uploadAndSchedule({
      channelId,
      file: mp4Stream,
      title,
      description,
      tags: [],
      publishAt,
      playlistId: undefined,
    });

    beat = await prisma.beat.update({
      where: { id: beat.id },
      data: { youTubeVideoId: videoId, publishAt, status: "SCHEDULED" },
    });

    res.json({ ok: true, beat });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
