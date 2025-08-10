import type { NextApiRequest, NextApiResponse } from "next";
import { google } from "googleapis";
import { oauthClient, saveTokensForChannel } from "@/lib/youtube";
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state } = req.query as { code: string; state: string };
  const o = oauthClient();
  const { tokens } = await o.getToken(code);
  o.setCredentials(tokens);
  const yt = google.youtube({ version: "v3", auth: o });
  const me = await yt.channels.list({ part: ["id","snippet"], mine: true });
  const ch = me.data.items?.[0];
  if (!ch?.id) return res.status(400).send("No channel");
  await saveTokensForChannel(ch.id, tokens.refresh_token!, ch.snippet?.title ?? "Unknown", (tokens.scope ?? ""), state);
  res.send("Channel linked. You can close this tab.");
}
