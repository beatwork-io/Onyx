import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/db";
import { defaultDescription } from "@/lib/templates";
import { patchDescription } from "@/lib/youtube";
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { beatId, beatStarsUrl, primaryType, beatName } = req.body as { beatId: string; beatStarsUrl: string; primaryType?: string; beatName?: string };
  const beat = await prisma.beat.update({ where: { id: beatId }, data: { beatStarsUrl } });
  if (beat.youTubeVideoId) {
    const desc = defaultDescription({ PrimaryType: primaryType ?? "Type Beat", BeatName: beatName ?? "Untitled", BPM: beat.bpm ?? undefined, Key: beat.key ?? undefined, BeatStarsURL: beatStarsUrl, Email: "contact@example.com" });
    await patchDescription(beat.channelId, beat.youTubeVideoId, desc);
    await prisma.beat.update({ where: { id: beatId }, data: { description: desc } });
  }
  res.json({ ok: true });
}
