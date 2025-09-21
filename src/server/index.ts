import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupRoutes } from './routes/index.js';
import { initializeDatabase } from './db/database.js';
import { QueueManager } from './services/queueManager.js';
import { logger } from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function start() {
  const fastify = Fastify({
    logger: logger as any
  });

  await fastify.register(cors, {
    origin: true
  });

  initializeDatabase();
  QueueManager.getInstance();

  await setupRoutes(fastify);

  const clientPath = path.join(__dirname, '../../client/dist');
  await fastify.register(fastifyStatic, {
    root: clientPath,
    prefix: '/',
  });

  // Catch-all route for SPA - must be after static files
  fastify.setNotFoundHandler((request, reply) => {
    // If it's an API route, return 404
    if (request.url.startsWith('/api/')) {
      reply.code(404).send({ error: 'Not Found' });
    } else {
      // For all other routes, serve index.html
      reply.sendFile('index.html');
    }
  });

  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();