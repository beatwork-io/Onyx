// src/pages/api/beat/create.ts
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import os from "os";
import formidable from "formidable";
import { prisma } from "@/lib/db";
import { defaultDescription, defaultTitle } from "@/lib/templates";
import { nextAutoSlot } from "@/lib/autoslot";
import { renderVideoToStream } from "@/lib/ffmpeg_stream";
import { uploadAndSchedule } from "@/lib/youtube";

export const config = { api: { bodyParser: false } };

// Parse form: écrit en /tmp, lit en Buffer, supprime les fichiers temp
async function parseFormToBuffers(
  req: NextApiRequest
): Promise<{ fields: any; audio: Buffer; cover?: Buffer | null; filename?: string }> {
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

  const audio = fs.readFileSync(af.filepath);
  const cover = cf?.filepath ? fs.readFileSync(cf.filepath) : null;
  const filename = af.originalFilename || "audio.mp3";

  // cleanup tmp
  try { fs.unlinkSync(af.filepath); } catch {}
  try { if (cf?.filepath) fs.unlinkSync(cf.filepath); } catch {}

  return { fields, audio, cover, filename };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { fields, audio, cover } = await parseFormToBuffers(req);

    const clientId = String(fields.clientId);
    const channelId = String(fields.channelId);
    const beatName = String(fields.beatName || "Untitled");
    const primaryType = String(fields.primaryType || "Type Beat");
    const publishAtRaw = fields.publishAt ? new Date(String(fields.publishAt)) : null;
    const autoSlot = String(fields.autoSlot || "true") === "true";

    // DB: ligne initiale
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

    // Titre/description (sans BPM/Key pour simplifier le test)
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

    beat = await prisma.beat.update({
      where: { id: beat.id },
      data: { title, description, status: "RENDERING" },
    });

    // Rendu vidéo en streaming (pas d’écriture disque)
    const videoStream = renderVideoToStream({
      audioBuffer: audio,
      coverBuffer: cover ?? null,
      titleOverlay: `${primaryType} — ${beatName}`,
    });

    // Slot de publication
    let publishAt = publishAtRaw ?? null;
    if (!publishAt && autoSlot) {
      const scheduled = await prisma.beat.findMany({
        where: { channelId, publishAt: { not: null } },
        select: { publishAt: true },
      });
      publishAt = nextAutoSlot(scheduled.map((s) => s.publishAt!));
    }
    if (!publishAt) publishAt = new Date(Date.now() + 48 * 3600 * 1000);

    // Upload + planification
    const videoId = await uploadAndSchedule({
      channelId,
      file: videoStream,
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
