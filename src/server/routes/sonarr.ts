import { FastifyInstance } from 'fastify';
import { SonarrService } from '../services/sonarr.js';
import { logger } from '../utils/logger.js';

export async function setupSonarrRoutes(fastify: FastifyInstance) {
  const sonarrService = SonarrService.getInstance();

  fastify.get('/sonarr/series', async (request, reply) => {
    if (!sonarrService.isConfigured()) {
      logger.warn('Sonarr API called but not configured');
      reply.code(503);
      return { error: 'Sonarr not configured' };
    }

    try {
      return await sonarrService.getSeries();
    } catch (error) {
      logger.error(`Failed to fetch series from Sonarr: ${error instanceof Error ? error.message : String(error)}`);
      reply.code(500);
      return { error: 'Failed to fetch series' };
    }
  });

  fastify.get('/sonarr/series/:id/episodes', async (request, reply) => {
    if (!sonarrService.isConfigured()) {
      reply.code(503);
      return { error: 'Sonarr not configured' };
    }

    const { id } = request.params as { id: string };

    try {
      const episodes = await sonarrService.getEpisodes(parseInt(id));
      const episodesWithFiles = await Promise.all(
        episodes
          .filter(ep => ep.hasFile)
          .map(async (episode) => {
            try {
              const file = await sonarrService.getEpisodeFile(episode.episodeFileId);
              return {
                ...episode,
                filePath: file.path
              };
            } catch {
              return episode;
            }
          })
      );

      return episodesWithFiles.sort((a, b) => {
        if (a.seasonNumber !== b.seasonNumber) {
          return b.seasonNumber - a.seasonNumber;
        }
        return b.episodeNumber - a.episodeNumber;
      });
    } catch (error) {
      reply.code(500);
      return { error: 'Failed to fetch episodes' };
    }
  });
}