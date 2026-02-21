# Interpretarr - Project Knowledge

## Overview
Interpretarr is a Radarr/Sonarr stack extension server that handles AI-powered subtitle translation using **ai-sub-translator** in headless mode. It provides a web interface for browsing media from Sonarr/Radarr, selecting subtitles, and managing a translation queue.

## Architecture

### Tech Stack
- **Backend:** TypeScript, Node.js, Fastify
- **Frontend:** React, TypeScript, Vite, TailwindCSS
- **Database:** SQLite with better-sqlite3 (embedded)
- **Translation Engine:** ai-sub-translator via JSON-RPC API
- **Logging:** Pino logger with file-based persistence
- **Deployment:** Docker (Alpine Linux)

## Key Components

### Queue Manager
- **FIFO Processing:** Items processed in order of addition (oldest first)
- **Single Active Job:** Only one translation at a time (ai-sub-translator limitation)
- **Status Tracking:** pending → active → completed/failed
- **Auto-start:** Queue processing begins automatically when items are added
- **Progress Updates:** Real-time progress from ai-sub-translator

### ai-sub-translator Integration
ai-sub-translator IS AN ELECTRON APP needs to be build!
Uses JSON-RPC API.
Look at the ~/work/ai-sub-translator - there are all the docs and source code
Also available on github (the branch is process-video for headless mode): https://github.com/seeingred/ai-sub-translator/tree/feature/process-video
**Important:** The service expects ai-sub-translator to be running in headless mode

### Settings Service
- **Auto-save:** Settings save on field blur in the UI
- **Configuration Check:** `isConfigured()` validates required settings
- **Keys Stored:**
  - `aiSubTranslatorUrl` - Server URL (default: http://host.docker.internal:9090)
  - `aiSubTranslatorApiKey` - Gemini API key (encrypted)
  - `sonarrApiKey` - Sonarr API key
  - `sonarrUrl` - Sonarr server URL
  - `radarrApiKey` - Radarr API key
  - `radarrUrl` - Radarr server URL

## API Endpoints

### Settings
- `GET /api/settings` - Get all settings
- `PUT /api/settings` - Update settings (auto-encrypts sensitive fields)

### Queue
- `GET /api/queue` - Get queue items (sorted by status and creation time)
- `POST /api/queue` - Add item to queue
- `DELETE /api/queue/:id` - Remove item (fails if active)
- `DELETE /api/queue` - Clear all non-active items

### Media Integration
- `GET /api/sonarr/series` - List all TV series
- `GET /api/sonarr/series/:id/episodes` - Get episodes for a series
- `GET /api/radarr/movies` - List all movies

### Subtitles
- `POST /api/subtitles/available` - Find subtitle files for a video

### System
- `GET /api/health` - Health check
- `GET /api/logs/stream` - Server-sent events log stream

## Business Logic

### Translation Workflow
1. User selects media item (movie/episode)
2. UI fetches available subtitle files for the video
3. User selects subtitle and target language
4. Item added to queue with status 'pending'
5. Queue manager picks up item (FIFO)
6. Status changes to 'active', translation begins
7. Progress updates every 2 seconds
8. On completion, file saved as `filename.{language}.srt`
9. Status changes to 'completed' or 'failed'

### File Naming Convention
Translated subtitles are saved with language code suffix:
- Input: `Movie.2024.1080p.srt`
- Output: `Movie.2024.1080p.es.srt` (for Spanish)

### Error Handling
- **Missing Configuration:** UI shows warning banner
- **API Failures:** Logged and shown in queue status
- **Translation Failures:** Marked as failed with error message
- **Network Issues:** Automatic retry with exponential backoff

## UI/UX Design

### Layout Structure
- **Header:** App title, configuration status and version number
- **Sidebar:** Navigation menu (Series/Movies/Queue/Settings/Logs)
- **Main Content:** Page-specific content
- **Footer:** App information

### Navigation States
- Series menu: Enabled only if Sonarr configured
- Movies menu: Enabled only if Radarr configured
- Other menus: Always available

### Translation Dialog
Modal with:
- Subtitle file selector (dropdown)
- Target language input (text with datalist)
- Popular languages quick select
- Add to Queue button

### Queue Display
Table showing:
- Item name and subtitle file
- Type (movie/episode)
- Target language
- Status badge (color-coded)
- Progress bar (for active items)
- Remove action (disabled for active)

## Deployment

### Docker
Multi-stage build:
1. Build client (Node + Vite)
2. Build server (TypeScript)
3. Production image (Alpine Linux)

### Docker Configuration
- **Port:** 3000 (Interpretarr web interface)
- **Volumes:**
  - `/app/data` - SQLite database and application logs
  - Media directory - Must match paths between host and container
- **Network:** Use `host.docker.internal` to access host services from container (Mac/Windows)

### Data Persistence
- `/app/data/interpretarr.db` - SQLite database
- `/app/data/app.log` - Application logs
- Media files accessed with matching paths between host and container

## Testing Strategy

### Unit Tests
- Queue FIFO logic
- Settings encryption/decryption
- API key validation

### Integration Tests
- End-to-end translation flow
- JSON-RPC communication
- File naming and output

### UI Tests
- Navigation states based on configuration
- Dialog interactions
- Queue management actions

## Performance Considerations

- **Single Translation:** Only one active translation (API limitation)
- **Polling Interval:** 2 seconds for progress updates
- **Database:** SQLite sufficient for queue/settings
- **Memory:** Subtitle content held in memory during processing
- **File Access:** Write access to media directories

## Known Limitations

1. **Single Translation:** ai-sub-translator only handles one job at a time
2. **File Access:** Requires matching paths between host and container for media files
3. **Language Codes:** Uses 2-letter ISO codes
4. **Progress Accuracy:** Based on batch completion, not time
5. **Docker Networking:** On Mac/Windows, use `host.docker.internal` to access host services

## Future Improvements

- Webhook support for Sonarr/Radarr events
- Batch subtitle selection
- Translation history and statistics
- Custom translation models
- Subtitle format conversion
- Multi-user support with authentication

## Development Tips

- Run `npm run dev` to start both frontend and backend
- Frontend proxies `/api` to backend on port 3000
- Use `npm run typecheck` to validate TypeScript
- Database file created at `data/interpretarr.db`
- Logs use Pino with pretty printing in development

### Testing Requirements

**IMPORTANT:** Always run tests after making any code changes:
- Run `npm test` to execute all tests
- Run `npm run test:coverage` to verify 100% code coverage
- Tests must pass with 100% coverage before committing changes
- Use `npm run test:watch` for continuous testing during development
- All new features must include comprehensive unit tests

## My personal deployment

- Designed to run on Raspberry Pi media servers for personal deployment