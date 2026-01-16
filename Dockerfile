# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install root dependencies
RUN npm install

# Install frontend dependencies
WORKDIR /app/frontend
RUN npm install

# Copy application files
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

# Copy package-lock.json from builder stage (where it was generated and validated)
# This ensures we use the exact same dependency versions
COPY --from=builder /app/frontend/package-lock.json ./frontend/package-lock.json 2>/dev/null || true

# Install production dependencies only
# Use npm install (not npm ci) to be more forgiving with lock file issues
WORKDIR /app/frontend
RUN npm install --production --no-audit --no-fund && \
    npm install express socket.io cors --no-audit --no-fund

# Copy built application and server files
COPY --from=builder /app/frontend/.next ./.next
COPY --from=builder /app/frontend/server.js ./server.js
COPY --from=builder /app/frontend/next.config.js ./next.config.js
# Create public directory (Next.js may not have one, which is fine)
RUN mkdir -p ./public

# Copy necessary frontend files
COPY --from=builder /app/frontend/pages ./pages
COPY --from=builder /app/frontend/components ./components
COPY --from=builder /app/frontend/styles ./styles
COPY --from=builder /app/frontend/config.ts ./config.ts
COPY --from=builder /app/frontend/tsconfig.json ./tsconfig.json

# Copy backend speech.json (create directory if needed)
WORKDIR /app
RUN mkdir -p ./backend
COPY --from=builder /app/backend/speech.json ./backend/speech.json

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
