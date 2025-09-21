# Interpretarr

AI-powered subtitle translation server for Radarr/Sonarr using [ai-sub-translator](https://github.com/your-repo/ai-sub-translator).

## Features

- 🎬 **Seamless Integration** - Works with your existing Sonarr and Radarr setup
- 🤖 **AI Translation** - Powered by Google Gemini for accurate translations
- 📺 **Series & Movies** - Browse and translate subtitles for TV shows and films
- 📊 **Queue Management** - FIFO processing with real-time progress tracking
- 🔒 **Secure** - Encrypted storage for API keys
- 🌐 **Multi-language** - Translate to any language supported by Gemini

## Prerequisites

- Node.js 20+ (for standalone) or Docker
- [ai-sub-translator](https://github.com/your-repo/ai-sub-translator) running in headless mode
- Gemini API key
- Sonarr/Radarr installation (at least one of them, for media browsing)

## Installation

### Docker (Standalone)

Clone the repository:
```bash
git clone https://github.com/seeingred/Interpretarr.git
cd interpretarr
```

```bash
# Build the image
docker build -t interpretarr .

# Run the container
docker run -d \
  --name interpretarr \
  -p 3000:3000 \
  -v ./data:/app/data \
  -v /path/to/media:/media:ro \
  -e AI_SUB_TRANSLATOR_URL=http://ai-sub-translator:9090 \
  interpretarr
```

## Configuration

### First-Time Setup

1. **Start ai-sub-translator** in headless mode:
```bash
./ai-sub-translator --headless
```

2. **Access Interpretarr** at `http://localhost:3000`

3. **Configure Settings**:
   - Navigate to Settings
   - Enter ai-sub-translator URL (default: `http://host.docker.internal:9090`)
   - Enter your Gemini API key
   - Configure Sonarr/Radarr integration (at least one of them):
     - Sonarr URL and API key
     - Radarr URL and API key

## Usage

### Translating Subtitles

1. **For Series**:
   - Navigate to Series
   - Select a show
   - Click "Translate" on an episode
   - Choose subtitle file and target language
   - Click "Add to Queue"

2. **For Movies**:
   - Navigate to Movies
   - Click "Translate" on a movie
   - Choose subtitle file and target language
   - Click "Add to Queue"

3. **Monitor Progress**:
   - Go to Queue page
   - View real-time translation progress
   - Completed translations are saved as `filename.languageCode.srt`

### Queue Management

- Translations are processed one at a time (FIFO)
- Active translations cannot be removed
- Use "Clear Queue" to remove all pending/completed items

## API Endpoints

Interpretarr exposes a REST API for integration:

- `GET /api/health` - Health check
- `GET /api/settings` - Get settings
- `PUT /api/settings` - Update settings
- `GET /api/queue` - Get queue status
- `POST /api/queue` - Add to queue
- `DELETE /api/queue/:id` - Remove from queue
- `GET /api/sonarr/series` - List series
- `GET /api/sonarr/series/:id/episodes` - List episodes
- `GET /api/radarr/movies` - List movies
- `POST /api/subtitles/available` - Get available subtitles

## Development

### Running in Development Mode

```bash
# Start both backend and frontend
npm run dev

# Backend only
npm run dev:server

# Frontend only
cd client && npm run dev
```

### Running Tests

```bash
# Run all tests
npm test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Building from Source

```bash
# Build everything
npm run build

# Build server only
npm run build:server

# Build client only
npm run build:client
```

### Logs

- Application logs: `data/interpretarr.log`
- Docker logs: `docker logs interpretarr`
- Browser console for frontend issues

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Credits

- [ai-sub-translator](https://github.com/your-repo/ai-sub-translator) - The translation engine
- [Sonarr](https://sonarr.tv/) - TV show management
- [Radarr](https://radarr.video/) - Movie management
- Google Gemini - AI translation model