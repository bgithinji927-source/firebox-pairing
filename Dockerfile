FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg imagemagick webp \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN npm install -g corepack@latest \
  && corepack pnpm install \
  && corepack pnpm run build \
  && npm install --prefix bot-runtime --ignore-scripts --no-audit --no-fund

ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
