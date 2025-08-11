import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import { prisma } from "@/lib/db";
import { defaultDescription, defaultTitle } from "@/lib/templates";
import { nextAutoSlot } from "@/lib/autoslot";
import { renderVideoToStream } from "@/lib/ffmpeg_stream";
import { uploadAndSchedule } from "@/lib/youtube";

export const config = { api: { bodyParser: false } };

async function parseFormToBuffers(req: NextApiRequest): Promise<{ fields: any; audio: Buffer; cover?: Buffer|null; filename?: string }>
{
  const form = formidable({
    multiples: false,
    keepExtensions: true,
    fileWriteStreamHandler: () => {
      const { Writable } = require("stream");
      const chunks: Buffer[] = [];
      const stream = new Writable({
        write(chunk: any, _enc: any, cb: any) { chunks.push(Buffer.from(chunk)); cb(); },
        final(cb: any) { (stream as any)._buffer = Buffer.concat(chunks); cb(); }
      });
      return stream;
    }
  });

  const { fields, files }: any = await new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => (err ? reject(err) : resolve({ fields, files })));
  });

  const audioFile = files.audio;
  const coverFile = files.cover;
  const audio = audioFile?._writeStream?._buffer as Buffer;
  const cover = coverFile ? (coverFile._writeStream?._buffer as Buffer) : null;
  const filename = audioFile?.originalFilename || "audio.mp3";
  if (!audio || !Buffer.isBuffer(audio)) throw new Error("No audio buffer received");
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

    let beat = await prisma.beat.create({ data: { clientId, channelId, title: "", description: "", tags: [], fileAudio: "", fileCover: "", status: "ANALYZING" }});

    const title = defaultTitle({ PrimaryType: primaryType, BeatName: beatName });
    const description = defaultDescription({ PrimaryType: primaryType, BeatName: beatName, BPM: null, Key: null, BeatStarsURL: null, Email: "contact@example.com", Hashtags: ["typebeat"] });
    beat = await prisma.beat.update({ where: { id: beat.id }, data: { title, description, status: "RENDERING" }});

    const videoStream = renderVideoToStream({ audioBuffer: audio, coverBuffer: cover ?? null, titleOverlay: `${primaryType} — ${beatName}` });

    let publishAt = publishAtRaw ?? null;
    if (!publishAt && autoSlot) {
      const scheduled = await prisma.beat.findMany({ where: { channelId, publishAt: { not: null } }, select: { publishAt: true } });
      publishAt = nextAutoSlot(scheduled.map(s => s.publishAt!) );
    }
    if (!publishAt) publishAt = new Date(Date.now() + 48 * 3600 * 1000);

    const videoId = await uploadAndSchedule({ channelId, file: videoStream, title, description, tags: [], publishAt, playlistId: undefined });
    beat = await prisma.beat.update({ where: { id: beat.id }, data: { youTubeVideoId: videoId, publishAt, status: "SCHEDULED" }});
    res.json({ ok: true, beat });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
