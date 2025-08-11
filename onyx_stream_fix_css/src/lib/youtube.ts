import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { prisma } from "./db";

const SCOPES = ["https://www.googleapis.com/auth/youtube.upload","https://www.googleapis.com/auth/youtube.readonly","https://www.googleapis.com/auth/youtube"];

export function oauthClient(){ return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!, process.env.GOOGLE_REDIRECT_URI!); }
export function authUrl(state:string){ const o=oauthClient(); return o.generateAuthUrl({ access_type:"offline", scope:SCOPES, prompt:"consent", state }); }
export async function saveTokensForChannel(channelId:string, refreshToken:string, title:string, scope:string, clientId:string){
  let client = await prisma.client.findFirst({ where: { id: clientId } }); if(!client) client=await prisma.client.create({ data:{ id: clientId, name:`Client ${clientId}` } });
  await prisma.channel.upsert({ where:{ id: channelId }, create:{ id: channelId, clientId: client.id, title, refreshToken, tokenScope: scope }, update:{ refreshToken, title, tokenScope: scope } });
}
export async function youtubeClientForChannel(channelId:string): Promise<{ yt:any; oauth:OAuth2Client }>{ const ch=await prisma.channel.findUniqueOrThrow({ where:{ id: channelId } }); const o=oauthClient(); o.setCredentials({ refresh_token: ch.refreshToken }); const yt=google.youtube({version:"v3", auth:o}); return { yt, oauth:o }; }
export async function uploadAndSchedule({channelId, file, title, description, tags, playlistId, publishAt}:{channelId:string; file:any; title:string; description:string; tags:string[]; playlistId?:string; publishAt:Date;}){
  const { yt } = await youtubeClientForChannel(channelId);
  const res = await yt.videos.insert({ part:["snippet","status"], requestBody:{ snippet:{ title, description, tags, categoryId:"10" }, status:{ privacyStatus:"private", publishAt: publishAt.toISOString(), selfDeclaredMadeForKids:false } }, media:{ body: file as any } });
  const videoId = res.data.id as string;
  if (playlistId) await yt.playlistItems.insert({ part:["snippet"], requestBody:{ snippet:{ playlistId, resourceId:{ kind:"youtube#video", videoId } } } });
  return videoId;
}
export async function patchDescription(channelId:string, videoId:string, description:string){ const { yt } = await youtubeClientForChannel(channelId); await yt.videos.update({ part:["snippet"], requestBody:{ id: videoId, snippet:{ description, title: undefined } } }); }
