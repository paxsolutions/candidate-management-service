# Hot Reload Development Setup

This project now supports hot reload for both frontend and backend during development using Docker Compose.

## Quick Start

### Development Mode (with Hot Reload)

```bash
# Start all services with hot reload enabled
docker-compose -f docker-compose.dev.yml up --build

# Or run in detached mode
docker-compose -f docker-compose.dev.yml up -d --build

# Stop services
docker-compose -f docker-compose.dev.yml down
```

### Production Mode (without Hot Reload)

```bash
# Use the standard docker-compose file
docker-compose up --build
```

## What's Different in Development Mode?

### Backend Hot Reload

- **Tool**: Nodemon
- **Watches**: `server.js`, `routes/**/*.js`, `config/**/*.js`
- **Behavior**: Automatically restarts the Node.js server when files change
- **Volume Mounting**: Source code is mounted from `./backend` to `/app` in the container

### Frontend Hot Reload

- **Tool**: React Dev Server (built-in)
- **Watches**: All files in `src/` directory
- **Behavior**: Automatically reloads the browser when files change
- **Volume Mounting**: Source code is mounted from `./frontend` to `/app` in the container
- **Polling**: Enabled with `CHOKIDAR_USEPOLLING=true` for Docker compatibility

## File Structure

```
.
├── docker-compose.yml           # Production configuration
├── docker-compose.dev.yml       # Development configuration (HOT RELOAD)
├── backend/
│   ├── Dockerfile              # Production Dockerfile
│   ├── Dockerfile.dev          # Development Dockerfile (HOT RELOAD)
│   ├── nodemon.json            # Nodemon configuration
│   └── package.json            # Added "dev" script
└── frontend/
    ├── Dockerfile              # Production Dockerfile (multi-stage with Nginx)
    └── Dockerfile.dev          # Development Dockerfile (HOT RELOAD)
```

## How It Works

### Backend

1. `Dockerfile.dev` installs ALL dependencies (including nodemon)
2. Source code is mounted as a volume
3. `nodemon` watches for file changes and restarts the server
4. Changes to `.js` files trigger automatic restart

### Frontend

1. `Dockerfile.dev` runs the React development server
2. Source code is mounted as a volume
3. React's built-in hot module replacement (HMR) detects changes
4. Browser automatically refreshes when files change

## Volume Mounting Strategy

Both services use a two-volume approach:

```yaml
volumes:
  - ./backend:/app # Mount source code
  - /app/node_modules # Preserve container's node_modules
```

This ensures:

- ✅ Code changes are immediately visible in the container
- ✅ node_modules from the container aren't overwritten by host
- ✅ Fast rebuild times

## Development Workflow

1. **Start the development environment**:

   ```bash
   docker-compose -f docker-compose.dev.yml up
   ```

2. **Make changes to your code**:
   - Edit backend files (`.js`) → Server auto-restarts
   - Edit frontend files (`.tsx`, `.ts`, `.css`) → Browser auto-reloads

3. **View logs**:

   ```bash
   # All services
   docker-compose -f docker-compose.dev.yml logs -f

   # Specific service
   docker-compose -f docker-compose.dev.yml logs -f backend
   docker-compose -f docker-compose.dev.yml logs -f frontend
   ```

4. **Rebuild if needed** (after package.json changes):
   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```

## Troubleshooting

### Hot Reload Not Working?

**Backend:**

- Check nodemon is running: `docker-compose -f docker-compose.dev.yml logs backend`
- Verify files are being watched in `nodemon.json`
- Ensure volume mounting is correct

**Frontend:**

- Check React dev server is running on port 3000
- Verify `CHOKIDAR_USEPOLLING=true` is set
- Clear browser cache
- Check browser console for errors

### Port Conflicts

If ports are already in use:

- Backend: Change `5001:5000` in docker-compose.dev.yml
- Frontend: Change `3000:3000` in docker-compose.dev.yml

### Slow Performance on macOS/Windows

Docker volume mounting can be slow on non-Linux systems. Consider:

- Using Docker Desktop's file sharing optimization
- Excluding `node_modules` from file watching
- Using named volumes for better performance

## Environment Variables

Development mode uses the same `.env` file as production. Make sure you have:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SESSION_SECRET=...
DB_USER=pax_user
DB_PASSWORD=pax_password
DB_NAME=pax_local
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=...
```

## Accessing Services

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5001
- **Adminer (DB GUI)**: http://localhost:8080
- **MySQL**: localhost:3306

## Tips

1. **First time setup**: Run with `--build` flag to ensure images are built
2. **Clean restart**: Use `docker-compose -f docker-compose.dev.yml down -v` to remove volumes
3. **Install new packages**: Rebuild the container after modifying `package.json`
4. **Production testing**: Always test with production docker-compose before deploying
