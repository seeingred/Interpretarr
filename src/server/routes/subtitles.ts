import { FastifyInstance } from 'fastify';
import { AiSubTranslatorService } from '../services/aiSubTranslator.js';
import path from 'path';

export async function setupSubtitleRoutes(fastify: FastifyInstance) {
  const translatorService = AiSubTranslatorService.getInstance();

  fastify.post('/subtitles/available', async (request, reply) => {
    const { videoPath } = request.body as { videoPath: string };

    try {
      const subtitles = await translatorService.getAvailableSubtitles(videoPath);

      // Handle both external and embedded subtitles
      return subtitles.map(subtitle => {
        if (subtitle.type === 'external') {
          return {
            path: subtitle.path,
            filename: subtitle.filename,
            type: 'external'
          };
        } else {
          // Embedded subtitle
          return {
            path: videoPath,
            filename: `Stream ${subtitle.id}: ${subtitle.language || 'unknown'} (${subtitle.title || subtitle.format || 'embedded'})`,
            type: 'embedded',
            streamId: subtitle.id
          };
        }
      });
    } catch (error) {
      reply.code(500);
      return { error: 'Failed to fetch subtitles' };
    }
  });
}