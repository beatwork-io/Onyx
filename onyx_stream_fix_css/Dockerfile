FROM node:18-bullseye AS builder
WORKDIR /app
COPY package.json ./
RUN yarn install --network-timeout 600000
COPY . .
RUN npx prisma generate
RUN yarn build

FROM node:18-bullseye AS runtime
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg libsndfile1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN yarn install --production --network-timeout 600000
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
EXPOSE 3000
CMD sh -c "mkdir -p /data/uploads /data/renders && (npx prisma migrate deploy || npx prisma db push); node node_modules/next/dist/bin/next start -p $PORT"
