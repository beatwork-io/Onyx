# ONYX — Streaming Upload (no local files)

- `/api/beat/create` rend la vidéo via FFmpeg **en streaming** et l'envoie **directement** à YouTube (pas d'écriture sur disque).
- Prisma sur PostgreSQL (JSON OK).

## Variables nécessaires
- `DATABASE_URL` (PostgreSQL)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI=https://onyx.beatwork.io/api/oauth/callback`
- `NEXT_PUBLIC_BASE_URL=https://onyx.beatwork.io`

## Déploiement (Railway)
1. Push ce repo.
2. Deploy.
3. `/api/oauth/start?clientId=TEST` → lier chaîne YouTube.
4. Page `/` → upload MP3 → planifier.
