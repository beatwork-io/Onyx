# Build Next.js
FROM node:18-bullseye AS builder
WORKDIR /app

COPY package.json ./
RUN yarn install --network-timeout 600000

COPY . .
RUN npx prisma generate
RUN yarn build

# Runtime with FFmpeg
FROM node:18-bullseye AS runtime
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
RUN yarn install --production --network-timeout 600000

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src

EXPOSE 3000
CMD sh -c "npx prisma migrate deploy || npx prisma db push; node node_modules/next/dist/bin/next start -p $PORT"
