FROM node:18-alpine

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm install --production

# Copy application code
COPY . .

# Expose port
EXPOSE 5000

# Install curl for healthcheck
RUN apk add --no-cache curl

# Health check
# HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
#   CMD curl -f http://localhost:5000/api/health || exit 1

# Start the application
CMD ["node", "server.js"]
