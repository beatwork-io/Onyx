import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { prisma } from "./db";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube",
];

export function oauthClient() {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  );
  return oAuth2Client;
}

export function authUrl(state: string) {
  const o = oauthClient();
  return o.generateAuthUrl({ access_type: "offline", scope: SCOPES, prompt: "consent", state });
}

export async function saveTokensForChannel(channelId: string, refreshToken: string, title: string, scope: string, clientId: string) {
  // Ensure a Client exists
  let client = await prisma.client.findFirst({ where: { id: clientId } });
  if (!client) client = await prisma.client.create({ data: { id: clientId, name: `Client ${clientId}` } });

  await prisma.channel.upsert({
    where: { id: channelId },
    create: { id: channelId, clientId: client.id, title, refreshToken, tokenScope: scope },
    update: { refreshToken, title, tokenScope: scope },
  });
}

export async function youtubeClientForChannel(channelId: string): Promise<{ yt: any; oauth: OAuth2Client }>
{
  const ch = await prisma.channel.findUniqueOrThrow({ where: { id: channelId } });
  const o = oauthClient();
  o.setCredentials({ refresh_token: ch.refreshToken });
  const yt = google.youtube({ version: "v3", auth: o });
  return { yt, oauth: o };
}

export async function uploadAndSchedule({
  channelId,
  filePath,
  title,
  description,
  tags,
  playlistId,
  publishAt,
}: {
  channelId: string;
  filePath: string;
  title: string;
  description: string;
  tags: string[];
  playlistId?: string;
  publishAt: Date;
}) {
  const { yt } = await youtubeClientForChannel(channelId);

  // Upload (private)
  const res = await yt.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title,
        description,
        tags,
        categoryId: "10", // Music
      },
      status: {
        privacyStatus: "private",
        publishAt: publishAt.toISOString(),
        selfDeclaredMadeForKids: false,
      },
    },
    media: { body: require("fs").createReadStream(filePath) },
  });

  const videoId = res.data.id as string;

  // Add to playlist if given
  if (playlistId) {
    await yt.playlistItems.insert({
      part: ["snippet"],
      requestBody: {
        snippet: { playlistId, resourceId: { kind: "youtube#video", videoId } },
      },
    });
  }

  return videoId;
}

export async function patchDescription(channelId: string, videoId: string, description: string) {
  const { yt } = await youtubeClientForChannel(channelId);
  await yt.videos.update({
    part: ["snippet"],
    requestBody: { id: videoId, snippet: { description, title: undefined } },
  });
}
