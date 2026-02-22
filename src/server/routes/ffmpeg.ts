import { FastifyInstance } from 'fastify';
import { getFfmpegStatus, onFfmpegStatus } from '../services/ffmpegManager.js';

export async function setupFfmpegRoutes(fastify: FastifyInstance) {
  // Poll endpoint for initial load
  fastify.get('/ffmpeg/status', async (request, reply) => {
    const query = request.query as { poll?: string };
    if (query.poll === 'true') {
      return getFfmpegStatus();
    }

    // SSE stream
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const send = (data: any) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send current status immediately
    send(getFfmpegStatus());

    // Subscribe to updates
    const unsubscribe = onFfmpegStatus((s) => {
      send(s);
    });

    request.raw.on('close', () => {
      unsubscribe();
    });
  });
}
