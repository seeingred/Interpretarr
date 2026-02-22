import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs';
import { getVideoInfo } from 'ai-sub-translator';

export async function setupSubtitleRoutes(fastify: FastifyInstance) {
  fastify.post('/subtitles/available', async (request, reply) => {
    const { videoPath } = request.body as { videoPath: string };

    try {
      const videoDir = path.dirname(videoPath);
      const videoBase = path.basename(videoPath, path.extname(videoPath));
      const subtitles: any[] = [];

      // Discover external subtitle files
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

      // Detect embedded subtitle tracks via ffmpeg
      try {
        const videoInfo = await getVideoInfo(videoPath);
        for (const track of videoInfo.subtitleTracks) {
          subtitles.push({
            path: videoPath,
            filename: `[Embedded] ${track.title || 'Stream #' + track.index} (${track.language || 'und'}) - ${track.format}`,
            type: 'embedded',
            streamId: track.index,
          });
        }
      } catch (err) {
        // ffmpeg not available or failed — still return external subtitles
        console.warn('Failed to detect embedded subtitles:', err);
      }

      return subtitles;
    } catch (error) {
      reply.code(500);
      return { error: 'Failed to fetch subtitles' };
    }
  });
}
