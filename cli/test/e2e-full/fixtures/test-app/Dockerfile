# Lightweight Node.js test application for Phala Cloud E2E testing
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy application files
COPY package.json .
COPY index.js .

# Install dependencies (if any)
RUN npm install --production

# Expose port
EXPOSE 3000

# Set default environment variables
ENV PORT=3000
ENV BUILD_VERSION=1.0.0
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run the application
CMD ["npm", "start"]
