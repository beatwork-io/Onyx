import type { NextApiRequest, NextApiResponse } from "next";
import { google } from "googleapis";
import { oauthClient, saveTokensForChannel } from "@/lib/youtube";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const code = req.query.code as string;
    const stateRaw = (req.query.state as string) || "{}";
    const state = JSON.parse(stateRaw) as { clientId?: string };
    const clientId = state.clientId || "";

    if (!code || !clientId) {
      return res.status(400).send("Missing code or clientId");
    }

    const o = oauthClient();
    const { tokens } = await o.getToken(code);
    o.setCredentials(tokens);

    // Récupérer le channel de l'utilisateur
    const yt = google.youtube({ version: "v3", auth: o });
    const me = await yt.channels.list({ part: ["id", "snippet"], mine: true });
    const ch = me.data.items?.[0];
    const providerAccountId = ch?.id || null;

    if (!providerAccountId) {
      return res.status(400).send("No YouTube channel found");
    }
    if (!tokens.refresh_token) {
      // Important: sans refresh_token, l’app ne pourra pas uploader plus tard
      return res
        .status(400)
        .send("Missing refresh_token. Revoke the app in Google Account permissions and try again.");
    }

    await saveTokensForChannel({
      clientId,
      providerAccountId,
      accessToken: tokens.access_token || null,
      refreshToken: tokens.refresh_token || null,
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    });

    // Redirige vers l’accueil (ou une page succès)
    return res.redirect("/");
  } catch (e: any) {
    console.error(e);
    return res.status(500).send("OAuth callback failed");
  }
}
