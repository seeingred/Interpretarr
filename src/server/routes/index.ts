import { FastifyInstance } from 'fastify';
import { setupSettingsRoutes } from './settings.js';
import { setupQueueRoutes } from './queue.js';
import { setupSonarrRoutes } from './sonarr.js';
import { setupRadarrRoutes } from './radarr.js';
import { setupSubtitleRoutes } from './subtitles.js';
import { setupHealthRoutes } from './health.js';
import { setupLogsRoutes } from './logs.js';

export async function setupRoutes(fastify: FastifyInstance) {
  await fastify.register(async (fastify) => {
    await setupSettingsRoutes(fastify);
    await setupQueueRoutes(fastify);
    await setupSonarrRoutes(fastify);
    await setupRadarrRoutes(fastify);
    await setupSubtitleRoutes(fastify);
    await setupHealthRoutes(fastify);
    await setupLogsRoutes(fastify);
  }, { prefix: '/api' });
}