import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs';

export async function setupSubtitleRoutes(fastify: FastifyInstance) {
  fastify.post('/subtitles/available', async (request, reply) => {
    const { videoPath } = request.body as { videoPath: string };

    try {
      const videoDir = path.dirname(videoPath);
      const videoBase = path.basename(videoPath, path.extname(videoPath));
      const subtitles: any[] = [];

      if (fs.existsSync(videoDir)) {
        const files = fs.readdirSync(videoDir);
        for (const file of files) {
          const isSubtitle = ['.srt', '.ass', '.vtt', '.sub'].some(ext =>
            file.toLowerCase().endsWith(ext)
          );
          if (isSubtitle && file.toLowerCase().includes(videoBase.toLowerCase())) {
            subtitles.push({
              path: path.join(videoDir, file),
              filename: file,
              type: 'external'
            });
          }
        }
      }

      return subtitles;
    } catch (error) {
      reply.code(500);
      return { error: 'Failed to fetch subtitles' };
    }
  });
}
