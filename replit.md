# Historia — Cinematic Scene Asset Generator

## Overview
Historia transforms historical documentary scripts into cinematic scene asset packs. Users paste a script, and the app breaks it into scenes using Groq AI, then generates images (via Whisk/Imagen 3.5 or mock SVGs) and audio narration (via Inworld TTS or mock) for each scene.

## Architecture

### Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express.js (TypeScript, served via tsx)
- **Database**: PostgreSQL (Replit Neon) via Drizzle ORM
- **File Storage**: Local filesystem (`uploads/` directory)

### Structure
```
src/               # React frontend
  lib/api.ts       # Frontend API client (calls Express routes)
  lib/providers.ts # Client-side AI helpers (Whisk, Inworld, Groq proxy)
  pages/           # React pages
  components/      # Shared React components
server/
  index.ts         # Express server entry point (port 5000)
  db.ts            # Drizzle + pg pool setup
  routes/
    projects.ts    # CRUD + pipeline for projects/scenes
    assets.ts      # File serving + upload + ZIP download
    regenerate.ts  # Regenerate individual scene image/audio
    whisk-proxy.ts # Server-side proxy for Whisk/Groq APIs
shared/
  schema.ts        # Drizzle schema (projects, scenes tables)
uploads/           # Project assets (images, audio, style refs)
dist/              # Vite build output (served by Express)
```

### How it works
1. User submits a title + script via the form
2. Frontend calls Groq directly (via `/api/whisk-proxy` which proxies to Groq) to generate a scene manifest (JSON array of scenes)
3. Scene manifest is sent to the server to insert into DB
4. Frontend generates images/audio per scene and uploads them via `/api/assets/...`
5. Project status is tracked in the DB; polling drives the status page

## API Routes
- `GET /api/projects` — list all projects
- `GET /api/projects/:id` — get project + scenes
- `POST /api/projects` — create project (multipart with optional style images)
- `PATCH /api/projects/:id` — update project fields
- `DELETE /api/projects/:id` — delete project + files
- `PATCH /api/projects/:id/stop` — mark project as stopped
- `POST /api/projects/:id/scenes` — insert scene manifest
- `PATCH /api/projects/:id/scenes/:num` — update a scene
- `POST /api/projects/:id/split-scene` — split a scene into two
- `GET /api/assets/:projectId/:type/:filename` — serve an uploaded file
- `POST /api/assets/:projectId/:type/:filename` — upload a file
- `GET /api/download/:projectId` — download project as ZIP
- `POST /api/regenerate` — regenerate image or audio for a scene
- `POST /api/whisk-proxy` — proxy for Whisk/Groq/Inworld API calls

## Environment Variables
- `DATABASE_URL` — Neon Postgres connection string (auto-set by Replit)
- `GROQ_API_KEY` — Optional server-side Groq key (users can also provide their own in Settings)
- `WHISK_COOKIE` — Optional server-side Whisk cookie for server-rendered image gen
- `INWORLD_API_KEY` — Optional server-side Inworld key for server-rendered TTS

## Key Notes
- API keys (Groq, Whisk, Inworld) are stored in `localStorage` under `historia-settings` for the client-side pipeline
- The server-side pipeline (running in the background after `POST /api/projects`) uses env vars
- Files are stored in `uploads/{projectId}/{images|audio|style}/`
- Mock providers (SVG images, silent MP3) work without any API keys for testing

## Scripts
- `npm run dev` — build frontend then start Express server (port 5000)
- `npm run build` — build frontend only
- `npm run db:push` — push Drizzle schema to Postgres
