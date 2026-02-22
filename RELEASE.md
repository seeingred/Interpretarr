# Release Guide

## Version Management

Current version is defined in `package.json`. To bump the version:

```bash
# Patch release (e.g. 2.0.0 -> 2.0.1)
npm version patch

# Minor release (e.g. 2.0.0 -> 2.1.0)
npm version minor

# Major release (e.g. 2.0.0 -> 3.0.0)
npm version major
```

This automatically updates `package.json` and creates a git tag.

## Building

### Docker Image

> **Note:** The `ai-sub-translator` dependency uses a `file:` reference (`file:../ai-sub-translator`) in package.json.
> For Docker builds to work, the `ai-sub-translator` package must first be published to npm and the dependency
> updated to a versioned reference (e.g. `"ai-sub-translator": "^1.0.0"`). Until then, Docker builds will fail
> during `npm ci` because the local file path is not available inside the Docker build context.

Once the dependency is published:

```bash
# Build the image
docker build -t interpretarr:latest .

# Tag for GitHub Container Registry
docker tag interpretarr:latest ghcr.io/seeingred/interpretarr:VERSION
docker tag interpretarr:latest ghcr.io/seeingred/interpretarr:latest

# Push
docker push ghcr.io/seeingred/interpretarr:VERSION
docker push ghcr.io/seeingred/interpretarr:latest
```

Replace `VERSION` with the actual version (e.g. `2.0.0`).

### Standalone Package

A prebuilt standalone package lets users run Interpretarr without building from source. They only need Node.js installed.

Use the build script:

```bash
./scripts/build-release.sh
```

This will:
1. Build the server and client (`npm run build`)
2. Copy `dist/`, `client/dist/`, `package.json`, and `package-lock.json` into a release directory
3. Install production-only dependencies
4. Create `start.sh` (Linux/macOS) and `start.bat` (Windows) scripts
5. Package everything into `release/interpretarr-VERSION.tar.gz`

Users just need to:
1. Extract the archive
2. Run `./start.sh` (or `start.bat` on Windows)

## GitHub Release Process

### 1. Bump the version

```bash
npm version patch   # or minor/major
```

### 2. Build and test

```bash
npm run build
npm test
```

### 3. Create a git tag (if not using `npm version`)

```bash
git tag v$(node -p "require('./package.json').version")
```

### 4. Push the tag

```bash
git push origin main --tags
```

### 5. Build the release package

```bash
./scripts/build-release.sh
```

### 6. Create the GitHub release

Go to **Releases > Draft a new release** on GitHub, or use the CLI:

```bash
VERSION=$(node -p "require('./package.json').version")

gh release create "v${VERSION}" \
  --title "v${VERSION}" \
  --notes-file - \
  "release/interpretarr-${VERSION}.tar.gz" << 'EOF'
## What's Changed

(Write release notes here)

## Installation

### Docker
```
docker pull ghcr.io/seeingred/interpretarr:VERSION
```

### Standalone
Download `interpretarr-VERSION.tar.gz`, extract, and run `./start.sh`.
Requires Node.js 20+.
EOF
```

## Changelog

### v2.0.0

Major refactoring release. Interpretarr now includes a built-in translation engine and no longer requires an external service.

**Breaking Changes:**
- No longer requires the external `ai-sub-translator` JSON-RPC service

**New Features:**
- Built-in translation engine powered by Google Gemini
- Configurable Gemini model selection (`gemini-2.0-flash` default)
- Configurable batch size for translation
- Light and dark mode (follows system preference)

**Improvements:**
- Completely rewritten queue system -- event-driven and reliable
- Crash recovery -- stale active jobs are reset on server restart
- Clean cancellation with AbortController
- Improved translation prompt for cleaner subtitle output

**Removed:**
- JSON-RPC dependency on external `ai-sub-translator` service
- `jayson` and `node-fetch` dependencies
