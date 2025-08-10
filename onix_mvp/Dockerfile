# Build Next.js
FROM node:18-bullseye AS builder
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn --frozen-lockfile || yarn
COPY . .
RUN yarn build

# Runtime with Python + FFmpeg for analysis/render
FROM node:18-bullseye AS runtime
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg libsndfile1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY package.json yarn.lock ./
RUN yarn --frozen-lockfile || yarn
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/workers ./workers
RUN pip3 install librosa==0.10.1
EXPOSE 3000
CMD sh -c "npx prisma migrate deploy || npx prisma db push; node node_modules/next/dist/bin/next start -p 3000"
