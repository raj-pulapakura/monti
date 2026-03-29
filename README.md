# Docker Setup

This repo has two apps:

- `web` (Next.js) on port `3000`
- `backend` (NestJS) on port `3001`

## Files Added

- `backend/Dockerfile.dev`
- `backend/Dockerfile.prod`
- `backend/.dockerignore`
- `web/Dockerfile.dev`
- `web/Dockerfile.prod`
- `web/.dockerignore`
- `docker-compose.dev.yml`
- `docker-compose.prod.yml`

## Prerequisites

- Docker Desktop (or Docker Engine + Compose plugin)

## Development

Run both services with hot reload:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Access:

- Web: `http://localhost:3000`
- Backend: `http://localhost:3001`

Stop:

```bash
docker compose -f docker-compose.dev.yml down
```

## Production

Build and run production images:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Railway deployment instructions live in [docs/railway-deployment.md](./docs/railway-deployment.md).

Access:

- Web: `http://localhost:3000`
- Backend: `http://localhost:3001`

Stop:

```bash
docker compose -f docker-compose.prod.yml down
```

## Logs

Development logs:

```bash
docker compose -f docker-compose.dev.yml logs -f
```

Production logs:

```bash
docker compose -f docker-compose.prod.yml logs -f
```
