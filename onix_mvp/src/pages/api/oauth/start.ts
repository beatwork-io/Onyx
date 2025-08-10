import type { NextApiRequest, NextApiResponse } from "next";
import { authUrl } from "@/lib/youtube";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { clientId } = req.query; // your internal client id
  const url = authUrl(String(clientId ?? "default"));
  res.redirect(url);
}
