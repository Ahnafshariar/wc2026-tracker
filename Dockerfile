# ---- build/runtime image ----
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install only production deps first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# App source
COPY . .

EXPOSE 3000

# Run as the built-in non-root user for safety
USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
