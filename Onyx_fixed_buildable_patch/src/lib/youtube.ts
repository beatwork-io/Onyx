import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import fs from "fs";
import prisma from "./db";

/** Scopes YouTube nécessaires */
export const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube",
];

/** Client OAuth2 Google (env requis) */
export function oauthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing Google OAuth environment variables");
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/** Sauvegarde/maj des tokens sur le Channel du client */
export async function saveTokensForChannel(params: {
  clientId: string;
  providerAccountId: string; // YouTube channel id
  accessTok
