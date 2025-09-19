FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with fresh cache
RUN npm cache clean --force && \
    rm -rf node_modules package-lock.json && \
    npm install --omit=dev --no-audit --no-fund

# Copy source code
COPY . .

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start the application - explicitly run server.js instead of npm start
CMD ["node", "server.js"]