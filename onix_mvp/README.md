# ONIX — MVP (auto BPM/Key → render → upload YouTube)

## Prérequis
- Google Cloud OAuth (YouTube Data API v3)
- Node 18+, Python 3.9+, FFmpeg
- (Prod) Docker

## Dev local
```bash
yarn
cp .env.example .env # remplis GOOGLE_* et APP_JWT_SECRET
yarn db:push
yarn dev
# Lier la chaîne: http://localhost:3000/api/oauth/start?clientId=CLIENT123
```

## Déploiement Railway (URL publique)
1. Crée un repo GitHub avec ces fichiers.
2. Railway → New Project → Deploy from GitHub.
3. Add → PostgreSQL. Récupère la `DATABASE_URL`.
4. Variables du service web :
   - `DATABASE_URL` (Postgres Railway)
   - `NEXT_PUBLIC_BASE_URL` = `https://<sub>.up.railway.app`
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` = `https://<sub>.up.railway.app/api/oauth/callback`
   - `APP_JWT_SECRET` (aléatoire)
   - `UPLOAD_DIR` = `/data/uploads`
   - `RENDER_DIR` = `/data/renders`
5. Add Volume → mount `/data` (≥10GB).
6. Deploy (Dockerfile fourni).
7. Lier la chaîne: `https://<sub>.up.railway.app/api/oauth/start?clientId=CLIENT123`
8. Formulaire: `https://<sub>.up.railway.app/`
