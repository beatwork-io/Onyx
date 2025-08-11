import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/db"; // Import par défaut
import formidable from "formidable";
import fs from "fs";
import path from "path";
import { uploadToYouTube } from "@/lib/youtube";

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const form = formidable({ multiples: false });
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Form parse error:", err);
        return res.status(500).json({ error: "File upload error" });
      }

      const { title, description, userId } = fields;
      const file = files.file as formidable.File;

      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const tempPath = file.filepath;
      const videoBuffer = fs.createReadStream(tempPath);

      // Sauvegarde dans la base
      const beat = await prisma.beat.create({
        data: {
          title: String(title),
          description: String(description),
          fileUrl: tempPath,
          userId: String(userId),
        },
      });

      // Upload sur YouTube
      const youtubeRes = await uploadToYouTube(
        String(userId),
        videoBuffer as any,
        String(title),
        String(description)
      );

      res.status(200).json({ success: true, beat, youtubeRes });
    });
  } catch (error) {
    console.error("Beat creation error:", error);
    res.status(500).json({ error: "Server error" });
  }
}
