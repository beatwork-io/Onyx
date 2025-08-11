# ONYX — Fixed (FFmpeg + Fonts Ready)

- FFmpeg installé via apt + Fontconfig
- `public/fonts/` prêt. Mettez-y **SF-Pro-Display-Bold.ttf**
- `src/lib/ffmpeg_stream.ts` utilise `/app/public/fonts/SF-Pro-Display-Bold.ttf` si présent. Sinon, pas de texte (pas d'erreur).

## Variables
- `DATABASE_URL=postgresql://...`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI=https://onyx.beatwork.io/api/oauth/callback`
- `NEXT_PUBLIC_BASE_URL=https://onyx.beatwork.io`

## Déploiement
- Push sur GitHub → Railway Deploy
- Lier la chaîne: `/api/oauth/start?clientId=TEST`
- Page `/` → upload MP3 + cover
