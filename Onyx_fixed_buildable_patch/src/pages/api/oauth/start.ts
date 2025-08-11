import type { NextApiRequest, NextApiResponse } from "next";
import { oauthClient, SCOPES } from "@/lib/youtube";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const clientId = (req.query.clientId as string) || "";
    if (!clientId) return res.status(400).send("Missing clientId");

    const o = oauthClient();
    const url = o.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
      state: JSON.stringify({ clientId }),
    });
    return res.redirect(url);
  } catch (e: any) {
    console.error(e);
    return res.status(500).send("OAuth start failed");
  }
}
