# Install development dependencies once for the build and database initializer
FROM node:22-alpine AS development-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Database initialization stage
FROM development-deps AS database-init
COPY . .
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed"]

# Build stage
FROM development-deps AS builder
# Copy source code
COPY . .

# Build Nuxt app
RUN npm run build

# Production dependencies stage (to keep final image small)
FROM node:22-alpine AS production-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Production stage
FROM node:22-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Copy built app and production dependencies
COPY --from=builder /app/.output ./
COPY --from=production-deps /app/node_modules ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start app with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/index.mjs"]
