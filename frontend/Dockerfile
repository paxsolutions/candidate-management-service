# Stage 1: Build the application
FROM node:18-alpine as build

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Accept API URL as build argument
ARG REACT_APP_API_URL=http://localhost:5001
ENV REACT_APP_API_URL=$REACT_APP_API_URL

# Set environment to production
ENV NODE_ENV=production

# Build the application with production settings
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Remove default nginx static assets and config
RUN rm -rf /usr/share/nginx/html/* && \
    rm /etc/nginx/conf.d/default.conf

# Copy built assets from build stage
COPY --from=build /app/build /usr/share/nginx/html

# Copy Nginx configuration
COPY nginx-clean.conf /etc/nginx/conf.d/default.conf

# Set permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    chmod -R 755 /var/cache/nginx && \
    chmod -R 755 /var/log/nginx && \
    chmod -R 755 /etc/nginx/conf.d

# Create .well-known directory for Let's Encrypt
RUN mkdir -p /usr/share/nginx/html/.well-known/acme-challenge && \
    chown -R nginx:nginx /usr/share/nginx/html/.well-known && \
    chmod -R 755 /usr/share/nginx/html/.well-known

# Run as root to avoid permission issues with Nginx
# USER nginx

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
