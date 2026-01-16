# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
# This allows Docker to cache the dependency installation layer
COPY package.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install dependencies (this layer will be cached if package.json doesn't change)
RUN npm install
WORKDIR /app/frontend
RUN npm install

# Copy all source files (this layer will be rebuilt when source changes)
WORKDIR /app
COPY . .

# Build Next.js application
WORKDIR /app/frontend
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json ./
COPY frontend/package.json ./frontend/

# Install production dependencies only
# Note: We use npm install (not npm ci) so package-lock.json is optional
WORKDIR /app/frontend
RUN npm install --production --no-audit --no-fund && \
    npm install express socket.io cors --no-audit --no-fund

# Copy built Next.js application
COPY --from=builder /app/frontend/.next ./.next

# Copy frontend source files needed at runtime
COPY --from=builder /app/frontend/server.js ./server.js
COPY --from=builder /app/frontend/next.config.js ./next.config.js
COPY --from=builder /app/frontend/pages ./pages
COPY --from=builder /app/frontend/components ./components
COPY --from=builder /app/frontend/styles ./styles
COPY --from=builder /app/frontend/config.ts ./config.ts
COPY --from=builder /app/frontend/tsconfig.json ./tsconfig.json

# Create public directory (Next.js may not have one, which is fine)
RUN mkdir -p ./public

# Create backend directory (speech.json will be provided via volume mount in docker-compose.yml)
# Note: speech.json is in .gitignore, so we don't copy it during build
WORKDIR /app
RUN mkdir -p ./backend

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    chown -R nextjs:nodejs /app

USER nextjs

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/speech', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
WORKDIR /app/frontend
CMD ["node", "server.js"]
