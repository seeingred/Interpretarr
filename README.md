# Interpretarr

AI-powered subtitle translation server for Radarr/Sonarr. Built-in Gemini AI translation -- no external services needed.

## Features

- Seamless Radarr/Sonarr integration
- Built-in AI translation powered by Google Gemini (free tier available)
- No external translation service required
- Series and Movies support
- FIFO queue with real-time progress
- Light and dark mode (follows system preference)
- Encrypted API key storage
- Multi-language support
- Docker ready

## Prerequisites

- Node.js 20+ or Docker
- Gemini API key (free at [Google AI Studio](https://aistudio.google.com/))
- Sonarr and/or Radarr

## Quick Start

### Docker Compose (recommended)

```bash
git clone https://github.com/seeingred/Interpretarr.git
cd Interpretarr
cp docker-compose.example.yml docker-compose.yml
```

Edit `docker-compose.yml` and replace `/path/to/media` with your media root directory. **Important**: the media must be mounted at the same path inside the container so that file paths from Radarr/Sonarr work correctly. Then:

```bash
docker compose up -d
```

To rebuild after pulling updates:

```bash
docker compose up -d --build
```

### Docker

```bash
docker build -t interpretarr .
docker run -d --name interpretarr -p 3000:3000 \
  -v ./data:/app/data \
  -v /path/to/media:/path/to/media:ro \
  interpretarr
```

The media volume must be mounted at the **same path** inside the container as Radarr/Sonarr uses on the host, so that file paths match. Mount it read-only (`:ro`) since Interpretarr only reads video files to discover subtitles.

## Configuration

1. Open Interpretarr at `http://localhost:3000`
2. Navigate to **Settings**
3. Enter your **Gemini API key**
4. Configure **Sonarr** and/or **Radarr** URLs and API keys

### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Gemini API Key | Google Gemini API key for translation | -- |
| Gemini Model | AI model to use | `gemini-2.0-flash` |
| Batch Size | Number of subtitles per translation batch | `50` |
| Sonarr URL | Sonarr server URL | -- |
| Sonarr API Key | Sonarr API key | -- |
| Radarr URL | Radarr server URL | -- |
| Radarr API Key | Radarr API key | -- |

Available Gemini models: `gemini-2.0-flash` (recommended), `gemini-2.5-flash`, `gemini-1.5-flash`, `gemini-1.5-flash-8b`. All models have a free tier.

## Usage

### Translating Subtitles

1. Navigate to **Series** or **Movies**
2. Select the media item
3. Click **Translate** on an episode or movie
4. Choose the subtitle file and target language
5. Click **Add to Queue**

### Queue

- Translations are processed one at a time in FIFO order
- Monitor real-time progress on the Queue page
- Active translations can be cancelled
- Use **Clear Queue** to remove all non-active items
- Translated files are saved as `filename.{languageCode}.srt`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/version` | Application version |
| `GET` | `/api/settings` | Get all settings |
| `PUT` | `/api/settings` | Update settings |
| `GET` | `/api/queue` | Get queue items |
| `POST` | `/api/queue` | Add item to queue |
| `DELETE` | `/api/queue/:id` | Remove/cancel queue item |
| `DELETE` | `/api/queue` | Clear all non-active items |
| `GET` | `/api/sonarr/series` | List TV series from Sonarr |
| `GET` | `/api/sonarr/series/:id/episodes` | List episodes for a series |
| `GET` | `/api/radarr/movies` | List movies from Radarr |
| `POST` | `/api/subtitles/available` | Find subtitle files for a video |
| `GET` | `/api/logs` | Get application logs |
| `GET` | `/api/logs/stream` | Server-sent events log stream |

## Development

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Start both backend and frontend in dev mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Type checking
npm run typecheck

# Build for production
npm run build
```

## Architecture

Interpretarr is a full-stack TypeScript application:

- **Backend**: Fastify server with SQLite (better-sqlite3) for persistence
- **Frontend**: React SPA with Tailwind CSS v4, served as static files
- **Translation**: Uses the `ai-sub-translator` npm module which calls the Google Gemini API directly
- **Queue**: Event-driven FIFO processor with AbortController cancellation and crash recovery

## License

MIT
