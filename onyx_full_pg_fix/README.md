# ONYX — MVP (PostgreSQL + JSON ready)

## Variables à configurer en prod (Railway)
- `DATABASE_URL` (PostgreSQL)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `UPLOAD_DIR=/data/uploads`, `RENDER_DIR=/data/renders`

## Déploiement Railway
1) New Project → Deploy from GitHub (ce repo).
2) Add → PostgreSQL → copie `DATABASE_URL` dans les Variables.
3) Add Volume `/data` (≥10GB).
4) Redeploy.

## Lier une chaîne YouTube
`/api/oauth/start?clientId=CLIENT123`
