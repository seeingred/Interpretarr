# Interpretarr - Project Knowledge

## Overview

Interpretarr is an AI-powered subtitle translation server that integrates with Radarr and Sonarr. It provides a web UI for browsing media, selecting subtitles, and managing a translation queue. Translation is handled by the `ai-sub-translator` npm module, which calls the Google Gemini API directly -- no external translation service is required.

## Tech Stack

- **Backend**: Fastify, TypeScript, Node.js 20+
- **Database**: SQLite via better-sqlite3 (embedded, file-based)
- **Frontend**: React 19, Vite 7, Tailwind CSS v4, React Router v7, Headless UI
- **Translation**: `ai-sub-translator` npm module (Google Gemini API)
- **Logging**: Pino with pino-pretty, file-based persistence
- **Testing**: Vitest with @vitest/coverage-v8
- **Deployment**: Docker (Alpine Linux, multi-stage build)

## Key Components

### QueueManager (`src/server/services/queueManager.ts`)
- Event-driven FIFO queue processor
- Dependency injection: receives `Database`, `TranslatorService`, and `Logger` via constructor
- Uses `AbortController` for cancellation of active translations
- `recover()` method marks stale active items as failed on server restart
- Uses `queueMicrotask()` to trigger async processing without blocking
- Status flow: `pending` -> `active` -> `completed` | `failed`
- Only one item active at a time; automatically picks up next pending item

### NpmTranslatorAdapter (`src/server/services/npmTranslatorAdapter.ts`)
- Implements `TranslatorService` interface
- Wraps the `ai-sub-translator` npm module's `translate()` function
- Reads settings (apiKey, model, batchSize) from `SettingsService`
- Reads subtitle file from disk, calls translate, writes output file
- Output naming: `{base}.{targetLanguage}.srt`

### TranslatorService (`src/server/services/translatorService.ts`)
- Interface with single `translate()` method
- Accepts: subtitlePath, targetLanguage, context, streamId, onProgress callback, AbortSignal
- Returns: path to translated SRT file

### SettingsService (`src/server/services/settings.ts`)
- Singleton pattern (`getInstance()`)
- Key-value store backed by SQLite `settings` table
- `isConfigured()`: requires geminiApiKey and at least one of sonarrApiKey or radarrApiKey

## Database Schema

Located at `data/interpretarr.db`. Initialized in `src/server/db/database.ts`.

### queue table
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | Primary key, autoincrement |
| type | TEXT | `movie` or `episode` |
| item_id | TEXT | Sonarr/Radarr item ID |
| item_name | TEXT | Display name |
| subtitle_file | TEXT | Path to subtitle file |
| subtitle_stream_id | INTEGER | Optional, for embedded subtitles |
| target_language | TEXT | Target language code |
| status | TEXT | `pending`, `active`, `completed`, `failed` |
| progress | INTEGER | 0-100 |
| error | TEXT | Error message on failure |
| created_at | DATETIME | Auto-set |
| updated_at | DATETIME | Auto-set |

Indexes: `idx_queue_status`, `idx_queue_status_created`.

### settings table
| Column | Type | Notes |
|--------|------|-------|
| key | TEXT | Primary key |
| value | TEXT | Setting value |

## Settings Keys

- `geminiApiKey` - Google Gemini API key
- `geminiModel` - Gemini model name (default: `gemini-2.0-flash`)
- `batchSize` - Subtitles per translation batch (default: `50`)
- `sonarrUrl` - Sonarr server URL
- `sonarrApiKey` - Sonarr API key
- `radarrUrl` - Radarr server URL
- `radarrApiKey` - Radarr API key

## API Endpoints

All endpoints are prefixed with `/api`.

### Settings
- `GET /api/settings` - Returns all settings plus `isConfigured` boolean
- `PUT /api/settings` - Partial update of settings

### Queue
- `GET /api/queue` - List all queue items (sorted: active, pending, completed, failed)
- `POST /api/queue` - Add item to queue (body: `QueueItemInput`)
- `DELETE /api/queue/:id` - Remove or cancel a queue item
- `DELETE /api/queue` - Clear all non-active items

### Sonarr
- `GET /api/sonarr/series` - List all TV series
- `GET /api/sonarr/series/:id/episodes` - List episodes with file paths

### Radarr
- `GET /api/radarr/movies` - List all movies with file paths

### Subtitles
- `POST /api/subtitles/available` - Find external subtitle files for a video (body: `{ videoPath }`)

### System
- `GET /api/health` - Health check (`{ status: "ok" }`)
- `GET /api/version` - App version
- `GET /api/logs` - Last 500 log lines (formatted)
- `GET /api/logs/stream` - SSE log stream

## UI Architecture

React SPA served as static files by Fastify. SPA catch-all handler serves `index.html` for non-API routes.

### Pages
- **Queue** (`/`, `/queue`) - Translation queue with progress bars, cancel/remove actions
- **Series** (`/series`) - Browse Sonarr series and episodes, trigger translations
- **Movies** (`/movies`) - Browse Radarr movies, trigger translations
- **Settings** (`/settings`) - Configure API keys and service URLs (auto-saves on blur)
- **Logs** (`/logs`) - View application logs

### Components
- `Layout` - Sidebar navigation, header with config status and version
- `TranslateDialog` - Modal for selecting subtitle file and target language

### Theme
- Light and dark mode via Tailwind CSS v4, follows system preference (`prefers-color-scheme`)
- Navigation items conditionally enabled based on Sonarr/Radarr configuration

## Translation Workflow

1. User selects media item (movie or episode) from Series/Movies page
2. UI calls `POST /api/subtitles/available` with the video file path
3. User picks a subtitle file and target language in the TranslateDialog
4. UI calls `POST /api/queue` to add the translation job
5. QueueManager picks up the pending item (FIFO)
6. NpmTranslatorAdapter reads the subtitle file, calls `ai-sub-translator` `translate()`
7. Progress callbacks update the queue item in the database
8. On success, translated file saved as `{base}.{targetLanguage}.srt`
9. Queue item marked `completed` (or `failed` with error message)
10. QueueManager automatically processes the next pending item

## File Structure

```
Interpretarr/
  src/
    version.ts                          # App version constant
    server/
      index.ts                          # Fastify server entry point
      db/
        database.ts                     # SQLite initialization and schema
      routes/
        index.ts                        # Route registration (all under /api)
        settings.ts                     # Settings CRUD
        queue.ts                        # Queue CRUD
        sonarr.ts                       # Sonarr proxy routes
        radarr.ts                       # Radarr proxy routes
        subtitles.ts                    # Subtitle file discovery
        health.ts                       # Health, version, log stream
        logs.ts                         # Log file reader
      services/
        queueManager.ts                 # FIFO queue processor
        translatorService.ts            # Translator interface
        npmTranslatorAdapter.ts         # ai-sub-translator adapter
        settings.ts                     # Settings singleton
        sonarr.ts                       # Sonarr API client
        radarr.ts                       # Radarr API client
      utils/
        logger.ts                       # Pino logger setup
  client/
    src/
      main.tsx                          # React entry point
      App.tsx                           # Router and app shell
      components/
        Layout.tsx                      # Sidebar, header, outlet
        TranslateDialog.tsx             # Translation modal
      pages/
        Queue.tsx                       # Queue management page
        Series.tsx                      # Sonarr series browser
        Movies.tsx                      # Radarr movies browser
        Settings.tsx                    # Settings form
        Logs.tsx                        # Log viewer
      services/
        api.ts                          # Axios HTTP client
  tests/
    setup.ts                            # Test setup
    version.test.ts                     # Version tests
    server/
      db/database.test.ts              # Database tests
      routes/
        queue.test.ts                   # Queue route tests
        health.test.ts                  # Health route tests
      services/
        queueManager.test.ts           # QueueManager unit tests
        settings.test.ts               # Settings tests
        sonarr.test.ts                 # Sonarr service tests
        radarr.test.ts                 # Radarr service tests
        aiSubTranslator.test.ts        # Translator adapter tests
      utils/
        logger.test.ts                 # Logger tests
  Dockerfile                            # Multi-stage Docker build
  package.json                          # Server dependencies and scripts
  client/package.json                   # Client dependencies
  tsconfig.server.json                  # Server TypeScript config
  vitest.config.ts                      # Vitest configuration
```

## Testing

Uses Vitest. Tests are in the `tests/` directory.

```bash
npm test                  # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
npm run test:server       # Server tests only
npm run test:client       # Client tests only
npm run test:ui           # Vitest UI
```

Always run tests after making code changes. New features should include tests.

## Development

```bash
npm run dev               # Start server + client in dev mode (concurrently)
npm run dev:server        # Server only (tsx watch)
npm run dev:client        # Client only (vite dev server)
npm run build             # Build server + client for production
npm run typecheck         # TypeScript type checking
npm run lint              # ESLint
```

- Frontend dev server proxies `/api` requests to the backend on port 3000
- Database file is created at `data/interpretarr.db`
- Logs use Pino with pretty printing in development, JSON in production
- Log file: `/app/data/app.log` (in Docker)

## Docker

Multi-stage build in `Dockerfile`:

1. **client-builder**: Installs client deps, builds React app with Vite
2. **server-builder**: Installs server deps, compiles TypeScript
3. **production**: Copies built assets, installs production deps only

Configuration:
- Port: 3000
- Volumes: `/app/data` (database + logs), media directory (read-only)
- Health check: `GET /api/health` every 30s
- Environment: `NODE_ENV=production`, `PORT=3000`
