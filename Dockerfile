# AbridgeAI app container — builds the frontend, serves dist + API on 3001.
# API keys are NOT baked in: they are passed at runtime via env_file in docker-compose.yml.
# node:24-slim (glibc) rather than alpine: @temporalio/worker's native core-bridge
# ships glibc prebuilds; they are not guaranteed for musl.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY backend/package.json backend/package-lock.json* ./backend/
RUN npm install --prefix backend --no-audit --no-fund
COPY vite.config.js index.html ./
COPY public ./public
COPY src ./src
COPY backend ./backend
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend ./backend
COPY --from=build /app/dist ./dist
COPY package.json ./
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "backend/server.js"]
