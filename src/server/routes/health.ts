import { FastifyInstance } from 'fastify';
import { APP_VERSION } from '../../version.js';

export async function setupHealthRoutes(fastify: FastifyInstance) {
  fastify.get('/version', async (request, reply) => {
    return { version: APP_VERSION };
  });

  fastify.get('/health', async (request, reply) => {
    return {
      status: 'ok',
      services: {
        interpretarr: true,
      }
    };
  });

  fastify.get('/logs/stream', (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const sendLog = (message: string) => {
      reply.raw.write(`data: ${message}\n\n`);
    };

    sendLog('Connected to log stream');

    const interval = setInterval(() => {
      sendLog(`[${new Date().toISOString()}] Server is running`);
    }, 30000);

    request.raw.on('close', () => {
      clearInterval(interval);
      reply.raw.end();
    });
  });
}
