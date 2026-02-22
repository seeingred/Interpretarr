# Interpretarr v2.0.0

Major refactoring release with a rewritten architecture, new features, and comprehensive testing.

## Highlights

- **npm module integration** — Translation engine extracted to [`ai-sub-translator`](https://www.npmjs.com/package/ai-sub-translator) v1.2.0, replacing the JSON-RPC approach
- **Event-driven queue** — Rewritten FIFO queue using microtasks instead of `setInterval`, with AbortController cancellation and crash recovery
- **Embedded subtitle support** — Detect and extract embedded SRT subtitle tracks from video files via FFmpeg
- **Source language selector** — Specify the source language in the translate dialog for more accurate translations; auto-populates from subtitle track metadata (ISO 639 codes)
- **FFmpeg background download** — FFmpeg pre-downloads at server startup with real-time progress notification in the UI; persisted to `data/ffmpeg/` so Docker containers don't re-download on restart
- **Light/dark mode** — Follows system preference via Tailwind CSS media strategy
- **Configurable data directory** — `DATA_DIR` env var to customize where the database and logs are stored
- **Docker improvements** — Media mount now defaults to read-write (required for saving translated subtitles next to video files)

## New Features

- Source language field in the Translate dialog with datalist of common languages
- FFmpeg download progress toast notification (SSE-powered)
- `GET /api/ffmpeg/status` endpoint (SSE stream + poll mode)
- `source_language` column in the queue table (auto-migrated for existing databases)
- `DATA_DIR` environment variable for custom data directory

## Bug Fixes

- Fixed `SQLITE_READONLY_DBMOVED` error when stale server holds the DB file
- Fixed stream index 0 being treated as falsy (`null` vs `undefined` check)
- Fixed E2E tests overwriting user's `data/` directory — now uses isolated `tests/e2e/tmp/data`
- Fixed Docker README media mount showing `:ro` (subtitles need write access)

## Breaking Changes

- Requires `ai-sub-translator` v1.2.0 (bundled via npm)
- Database schema adds `source_language` column (auto-migrated on startup)

## Docker

```bash
docker compose up -d --build
```

Or standalone:

```bash
docker run -d --name interpretarr -p 3000:3000 \
  -v ./data:/app/data \
  -v /path/to/media:/path/to/media \
  interpretarr
```

## Full Changelog

- Add E2E data isolation, FFmpeg background download, source language selector
- Fix SQLITE_READONLY_DBMOVED: kill stale server before DB backup
- Fix E2E stability: kill stale port, use tsx without watch mode
- Update ai-sub-translator to 1.2.0
- Increase E2E timeouts, fix stream index 0 bug in queue
- Fix null vs undefined streamId check, clean stale E2E files
- Add embedded subtitle extraction, remove E2E SRT fixtures
- Add docker-compose.example.yml
- Refactor: npm module integration, event-driven queue, dark mode, tests
