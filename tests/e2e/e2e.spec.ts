import { test, expect } from '@playwright/test';
import { execSync, spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Paths ────────────────────────────────────────────────────────────────────
const PROJECT_DIR = path.resolve(__dirname, '../..');
const E2E_DIR = path.resolve(__dirname);
const TMP_DIR = path.join(E2E_DIR, 'tmp');
const MOVIES_DIR = path.join(TMP_DIR, 'movies');
const RADARR_CONFIG_DIR = path.join(TMP_DIR, 'radarr-config');
const SCREENSHOTS_DIR = path.join(E2E_DIR, 'screenshots');
const DATA_DIR = path.join(TMP_DIR, 'data');

// Source of MKV test media (public domain films)
const MEDIA_SOURCE = path.resolve(PROJECT_DIR, '../Interpretarr_e2e');

const RADARR_PORT = 17878;
const RADARR_URL = `http://localhost:${RADARR_PORT}`;
const INTERPRETARR_PORT = 13000;
const INTERPRETARR_URL = `http://localhost:${INTERPRETARR_PORT}`;

// ── Test movies ──────────────────────────────────────────────────────────────
const MOVIES = [
  {
    title: 'Popeye the Sailor Meets Sindbad the Sailor',
    year: 1936,
    tmdbId: 67713,
    slug: 'popeye-the-sailor-meets-sindbad-the-sailor-1936',
    mkvFile: 'PopeyeMeetsSinbad.mkv',
  },
  {
    title: 'St. Louis Blues',
    year: 1929,
    tmdbId: 148941,
    slug: 'st-louis-blues-1929',
    mkvFile: 'StLouisBlues.mkv',
  },
];

let interpretarrProcess: ChildProcess | null = null;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'your-gemini-api-key-here') {
    throw new Error(
      'GEMINI_API_KEY not set. Export it or create a .env file in the project root.'
    );
  }
  return key;
}

function getRadarrApiKey(): string {
  const configPath = path.join(RADARR_CONFIG_DIR, 'config.xml');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Radarr config.xml not found at ${configPath}`);
  }
  const content = fs.readFileSync(configPath, 'utf-8');
  const match = content.match(/<ApiKey>([^<]+)<\/ApiKey>/);
  if (!match) {
    throw new Error('Could not extract API key from Radarr config.xml');
  }
  return match[1];
}

async function pollUntilReady(
  url: string,
  label: string,
  timeoutMs = 120000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await fetch(url);
      // Accept any HTTP response (including 401) as "ready".
      // A 401 from Radarr means the server is up but requires auth.
      if (resp.status > 0) return;
    } catch {
      // not ready yet (connection refused, etc.)
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`${label} did not become ready within ${timeoutMs / 1000}s`);
}

function setupMovieFiles(): void {
  for (const movie of MOVIES) {
    const movieDir = path.join(MOVIES_DIR, movie.slug);

    // Clean stale files from prior runs (e.g. translated .fr.srt files)
    if (fs.existsSync(movieDir)) {
      fs.rmSync(movieDir, { recursive: true, force: true });
    }
    fs.mkdirSync(movieDir, { recursive: true });

    // Symlink MKV file (avoid copying ~580 MB each)
    const srcMkv = path.join(MEDIA_SOURCE, movie.mkvFile);
    const dstMkv = path.join(movieDir, movie.mkvFile);
    if (!fs.existsSync(srcMkv)) {
      throw new Error(`Source MKV not found: ${srcMkv}`);
    }
    fs.symlinkSync(srcMkv, dstMkv);
  }
}

function writeDockerCompose(): void {
  // Mount MOVIES_DIR at the same absolute path inside the Radarr container.
  // This ensures the file paths Radarr reports match what Interpretarr can
  // access natively on the host.
  const uid = process.getuid?.() ?? 1000;
  const gid = process.getgid?.() ?? 1000;

  const compose = `services:
  radarr:
    image: lscr.io/linuxserver/radarr:latest
    container_name: interpretarr-e2e-radarr
    environment:
      - PUID=${uid}
      - PGID=${gid}
      - TZ=UTC
    volumes:
      - ${RADARR_CONFIG_DIR}:/config
      - ${MOVIES_DIR}:${MOVIES_DIR}
      - ${MEDIA_SOURCE}:${MEDIA_SOURCE}:ro
    ports:
      - "${RADARR_PORT}:7878"
    restart: "no"
`;

  fs.writeFileSync(path.join(TMP_DIR, 'docker-compose.yml'), compose, 'utf-8');
}

async function addMovieToRadarr(
  apiKey: string,
  movie: (typeof MOVIES)[number]
): Promise<void> {
  const moviePath = path.join(MOVIES_DIR, movie.slug);

  // Look up the movie via Radarr's TMDB lookup to get proper metadata
  const lookupResp = await fetch(
    `${RADARR_URL}/api/v3/movie/lookup/tmdb?tmdbId=${movie.tmdbId}`,
    {
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json',
      },
    }
  );

  let body: any;
  if (lookupResp.ok) {
    body = await lookupResp.json();
    // Override path and options
    body.path = moviePath;
    body.monitored = false;
    body.qualityProfileId = body.qualityProfileId || 1;
    body.addOptions = { searchForMovie: false };
  } else {
    // Fallback: manual movie body with TMDB ID
    body = {
      title: movie.title,
      year: movie.year,
      tmdbId: movie.tmdbId,
      path: moviePath,
      monitored: false,
      qualityProfileId: 1,
      titleSlug: movie.slug,
      images: [],
      addOptions: { searchForMovie: false },
    };
  }

  const resp = await fetch(`${RADARR_URL}/api/v3/movie`, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    if (text.includes('already been added')) return;
    throw new Error(
      `Failed to add movie "${movie.title}": ${resp.status} ${text}`
    );
  }
}

async function triggerRadarrRescan(apiKey: string): Promise<void> {
  const resp = await fetch(`${RADARR_URL}/api/v3/command`, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'RescanMovie' }),
  });

  if (!resp.ok) {
    console.warn(`Radarr rescan request returned ${resp.status}`);
  }

  // Wait for rescan to finish
  await new Promise((r) => setTimeout(r, 15000));
}

function cleanDataDir(): void {
  if (fs.existsSync(DATA_DIR)) {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function killPortProcess(port: number): void {
  try {
    const pids = execSync(`lsof -ti :${port}`, { encoding: 'utf-8' }).trim();
    if (pids) {
      for (const pid of pids.split('\n')) {
        try { process.kill(Number(pid), 'SIGKILL'); } catch {}
      }
      // Brief wait for process to die
      execSync('sleep 1');
      console.log(`Killed stale process(es) on port ${port}: ${pids.replace(/\n/g, ', ')}`);
    }
  } catch {
    // No process on port — fine
  }
}

function startInterpretarr(): ChildProcess {
  // Kill any stale process from a previous test run
  killPortProcess(INTERPRETARR_PORT);

  // Use tsx directly (not tsx watch) to avoid restarts mid-translation
  const child = spawn('npx', ['tsx', 'src/server/index.ts'], {
    cwd: PROJECT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(INTERPRETARR_PORT), DATA_DIR },
    detached: false,
  });

  child.stdout?.on('data', (data: Buffer) => {
    process.stdout.write(`[interpretarr] ${data}`);
  });

  child.stderr?.on('data', (data: Buffer) => {
    process.stderr.write(`[interpretarr:err] ${data}`);
  });

  return child;
}

function stopInterpretarr(): void {
  if (interpretarrProcess) {
    interpretarrProcess.kill('SIGTERM');
    interpretarrProcess = null;
  }
}

// ── Test suite ───────────────────────────────────────────────────────────────

test.describe('Interpretarr E2E — Subtitle Translation', () => {
  test.beforeAll(async () => {
    // Kill any stale Interpretarr from a prior run FIRST —
    // before backupDataDir() deletes the DB out from under it
    killPortProcess(INTERPRETARR_PORT);

    // Validate environment
    getGeminiApiKey();

    // Verify MKV source files exist
    for (const movie of MOVIES) {
      const src = path.join(MEDIA_SOURCE, movie.mkvFile);
      if (!fs.existsSync(src)) {
        throw new Error(
          `Missing test media: ${src}\n` +
            `Ensure the Interpretarr_e2e repo is cloned alongside this project with the MKV files.`
        );
      }
    }

    // Create directories
    fs.mkdirSync(TMP_DIR, { recursive: true });
    fs.mkdirSync(MOVIES_DIR, { recursive: true });
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    fs.mkdirSync(RADARR_CONFIG_DIR, { recursive: true });

    // Set up movie files (symlink MKVs)
    console.log('Setting up movie files...');
    setupMovieFiles();

    // Generate docker-compose.yml with absolute path volume mounts
    console.log('Writing docker-compose.yml...');
    writeDockerCompose();

    // Start Radarr
    console.log('Starting Radarr via docker compose...');
    execSync('docker compose up -d', { cwd: TMP_DIR, stdio: 'inherit' });

    console.log('Waiting for Radarr...');
    await pollUntilReady(
      `${RADARR_URL}/api/v3/system/status`,
      'Radarr',
      120000
    );
    console.log('Radarr is ready.');

    // Add movies to Radarr
    const radarrApiKey = getRadarrApiKey();
    console.log('Adding movies to Radarr...');
    for (const movie of MOVIES) {
      await addMovieToRadarr(radarrApiKey, movie);
      console.log(`  Added: ${movie.title} (${movie.year})`);
    }

    // Trigger rescan so Radarr discovers movie files
    console.log('Triggering Radarr library rescan...');
    await triggerRadarrRescan(radarrApiKey);
    console.log('Rescan complete.');

    // Clean E2E data directory for fresh test run
    console.log('Preparing clean database...');
    cleanDataDir();

    // Start Interpretarr server
    console.log('Starting Interpretarr...');
    interpretarrProcess = startInterpretarr();

    await pollUntilReady(
      `${INTERPRETARR_URL}/api/health`,
      'Interpretarr',
      60000
    );
    console.log('Interpretarr is ready.');
  });

  test.afterAll(async () => {
    // Stop Interpretarr
    console.log('Stopping Interpretarr...');
    stopInterpretarr();

    // Stop Radarr
    console.log('Stopping Radarr...');
    try {
      execSync('docker compose down', { cwd: TMP_DIR, stdio: 'inherit' });
    } catch {
      console.warn('Failed to stop docker compose');
    }
  });

  test(
    'translate subtitles for public domain movies from English to French',
    async ({ page }) => {
      const geminiApiKey = getGeminiApiKey();
      const radarrApiKey = getRadarrApiKey();

      // ════════════════════════════════════════════════════════════════════
      // PHASE 1: Configure Settings via API (fast & reliable)
      // ════════════════════════════════════════════════════════════════════
      console.log('--- Phase 1: Configure Settings ---');

      await fetch(`${INTERPRETARR_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiApiKey,
          geminiModel: 'gemini-2.5-flash',
          radarrUrl: RADARR_URL,
          radarrApiKey,
        }),
      });

      // Verify settings are applied
      const settingsResp = await fetch(`${INTERPRETARR_URL}/api/settings`);
      const settings = (await settingsResp.json()) as any;
      expect(settings.isConfigured).toBe(true);
      console.log('Settings configured successfully.');

      // ════════════════════════════════════════════════════════════════════
      // PHASE 2: Navigate to Movies and queue translations via UI
      // ════════════════════════════════════════════════════════════════════
      console.log('--- Phase 2: Add Translation Jobs via UI ---');

      await page.goto('/movies');
      await page.waitForLoadState('networkidle');

      // Wait for movies to appear
      await expect(page.locator('button', { hasText: 'Translate' }).first()).toBeVisible({
        timeout: 30000,
      });

      for (const movie of MOVIES) {
        console.log(`  Queuing translation for: ${movie.title}`);

        // Find this movie's card by locating the h3 title, then navigate to parent card
        const movieCard = page
          .locator('h3', { hasText: `${movie.title}` })
          .locator('..');

        await movieCard.locator('button', { hasText: 'Translate' }).click();

        // Wait for translation dialog
        await expect(page.getByText('Translate Subtitle')).toBeVisible({
          timeout: 10000,
        });

        // Subtitle file should be auto-selected in the dropdown
        // First run may download FFmpeg (~20 MB), allow extra time
        await expect(page.locator('select').first()).toBeVisible({
          timeout: 180000,
        });

        // Set target language to French
        const langInput = page.locator(
          'input[placeholder*="Enter language code"]'
        );
        await langInput.fill('fr');

        // Add to Queue
        await page.getByRole('button', { name: 'Add to Queue' }).click();

        // Wait for dialog to close
        await expect(page.getByText('Translate Subtitle')).toBeHidden({
          timeout: 10000,
        });

        console.log(`  Queued: ${movie.title}`);
        await page.waitForTimeout(500);
      }

      // ════════════════════════════════════════════════════════════════════
      // PHASE 3: Wait for translations to complete
      // ════════════════════════════════════════════════════════════════════
      console.log('--- Phase 3: Waiting for Translations ---');

      await page.goto('/queue');
      await page.waitForLoadState('networkidle');

      const maxWaitMs = 600000; // 10 minutes
      const startTime = Date.now();
      let allCompleted = false;

      while (Date.now() - startTime < maxWaitMs) {
        const response = await page.request.get(
          `${INTERPRETARR_URL}/api/queue`
        );
        const queue = await response.json();

        const completed = queue.filter(
          (item: any) => item.status === 'completed'
        );
        const failed = queue.filter((item: any) => item.status === 'failed');
        const active = queue.filter((item: any) => item.status === 'active');
        const pending = queue.filter((item: any) => item.status === 'pending');

        console.log(
          `  Queue: ${completed.length} completed, ${active.length} active, ` +
            `${pending.length} pending, ${failed.length} failed`
        );

        if (failed.length > 0) {
          const errors = failed
            .map((item: any) => `${item.item_name}: ${item.error}`)
            .join('; ');
          throw new Error(`Translation failed: ${errors}`);
        }

        if (completed.length >= MOVIES.length) {
          allCompleted = true;
          break;
        }

        await page.waitForTimeout(5000);
      }

      expect(allCompleted).toBe(true);
      console.log('All translations completed!');

      // Reload queue page to show final state
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // ════════════════════════════════════════════════════════════════════
      // PHASE 4: Verify translated subtitle files
      // ════════════════════════════════════════════════════════════════════
      console.log('--- Phase 4: Verify Results ---');

      // Common French words that must appear in a meaningful French translation
      const frenchIndicators = [
        'le',
        'la',
        'les',
        'de',
        'du',
        'des',
        'un',
        'une',
        'et',
        'est',
        'dans',
        'sur',
        'pour',
        'qui',
        'que',
        'je',
        'il',
        'elle',
        'nous',
        'vous',
        'mon',
        'son',
        'pas',
        'ne',
        'ce',
        'se',
        'au',
        'mais',
        'ou',
        'avec',
      ];

      for (const movie of MOVIES) {
        const movieDir = path.join(MOVIES_DIR, movie.slug);
        const baseName = movie.mkvFile.replace('.mkv', '');
        const frenchSrtPath = path.join(movieDir, `${baseName}.fr.srt`);

        // Check file exists
        expect(
          fs.existsSync(frenchSrtPath),
          `French subtitle file should exist: ${frenchSrtPath}`
        ).toBe(true);

        // Read content
        const content = fs.readFileSync(frenchSrtPath, 'utf-8');
        expect(content.length).toBeGreaterThan(100);

        // Output the translated file for manual inspection
        console.log(`\n${'='.repeat(70)}`);
        console.log(`TRANSLATED SUBTITLES: ${movie.title} (${movie.year})`);
        console.log(`File: ${frenchSrtPath}`);
        console.log(`Size: ${content.length} bytes`);
        console.log('='.repeat(70));
        console.log(content);
        console.log('='.repeat(70));

        // Verify French language content
        const lowerContent = content.toLowerCase();
        const foundFrenchWords = frenchIndicators.filter((word) => {
          const regex = new RegExp(`\\b${word}\\b`, 'i');
          return regex.test(lowerContent);
        });

        console.log(
          `  ${movie.title}: French words found (${foundFrenchWords.length}): [${foundFrenchWords.join(', ')}]`
        );

        // Require at least 5 distinct French words for meaningful content
        expect(
          foundFrenchWords.length,
          `Expected at least 5 French words in translated subtitles for "${movie.title}". ` +
            `Found ${foundFrenchWords.length}: [${foundFrenchWords.join(', ')}]. ` +
            `Content preview: ${content.substring(0, 300)}`
        ).toBeGreaterThanOrEqual(5);

        // Verify SRT format: must have numbered entries and timestamps
        const timestampPattern = /\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/;
        expect(
          timestampPattern.test(content),
          'Translated file must be valid SRT format with timestamps'
        ).toBe(true);

        // Verify multiple subtitle entries exist (not just a single entry)
        const entryCount = (
          content.match(/\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/g) || []
        ).length;
        console.log(`  Entry count: ${entryCount}`);
        expect(
          entryCount,
          `Expected multiple subtitle entries for "${movie.title}"`
        ).toBeGreaterThan(10);
      }

      console.log('\nAll subtitle files verified!');

      // ════════════════════════════════════════════════════════════════════
      // PHASE 5: Take screenshot of Interpretarr with results
      // ════════════════════════════════════════════════════════════════════
      console.log('--- Phase 5: Screenshot ---');

      // Navigate to queue page showing completed translations
      await page.goto('/queue');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotPath = path.join(
        SCREENSHOTS_DIR,
        `e2e-translated-movies-${timestamp}.png`
      );

      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Screenshot saved: ${screenshotPath}`);
      expect(fs.existsSync(screenshotPath)).toBe(true);

      // Also take screenshot of the movies page
      await page.goto('/movies');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const moviesScreenshot = path.join(
        SCREENSHOTS_DIR,
        `e2e-movies-page-${timestamp}.png`
      );
      await page.screenshot({ path: moviesScreenshot, fullPage: true });
      console.log(`Movies screenshot saved: ${moviesScreenshot}`);
    }
  );
});
