import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import prisma from "./db"; // Import par défaut, plus { prisma }

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube",
];

export function getOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function uploadToYouTube(userId: string, videoPath: string, title: string, description: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });

  if (!account || !account.refresh_token) {
    throw new Error("No linked YouTube account found for this user.");
  }

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: account.refresh_token });

  const youtube = google.youtube({ version: "v3", auth: oauth2Client });

  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: { title, description },
      status: { privacyStatus: "private" },
    },
    media: { body: videoPath },
  });

  return res.data;
}
