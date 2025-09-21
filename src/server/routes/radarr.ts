import { FastifyInstance } from 'fastify';
import { RadarrService } from '../services/radarr.js';

export async function setupRadarrRoutes(fastify: FastifyInstance) {
  const radarrService = RadarrService.getInstance();

  fastify.get('/radarr/movies', async (request, reply) => {
    if (!radarrService.isConfigured()) {
      reply.code(503);
      return { error: 'Radarr not configured' };
    }

    try {
      const movies = await radarrService.getMovies();
      const moviesWithFiles = await Promise.all(
        movies
          .filter(movie => movie.hasFile)
          .map(async (movie) => {
            try {
              const file = await radarrService.getMovieFile(movie.movieFileId);
              return {
                ...movie,
                filePath: file.path
              };
            } catch {
              return movie;
            }
          })
      );

      return moviesWithFiles;
    } catch (error) {
      reply.code(500);
      return { error: 'Failed to fetch movies' };
    }
  });
}