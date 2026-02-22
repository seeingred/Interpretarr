import { FastifyInstance } from 'fastify';
import { QueueManager, QueueItemInput } from '../services/queueManager.js';

export async function setupQueueRoutes(fastify: FastifyInstance, queueManager: QueueManager) {
  fastify.get('/queue', async () => {
    return queueManager.getQueue();
  });

  fastify.post('/queue', async (request) => {
    const body = request.body as QueueItemInput & { source_language?: string };
    const inserted = queueManager.addToQueue(body);
    return { id: inserted.id, success: true };
  });

  fastify.delete('/queue/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      queueManager.removeFromQueue(parseInt(id));
      return { success: true };
    } catch (error) {
      reply.code(400);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove item'
      };
    }
  });

  fastify.delete('/queue', async () => {
    queueManager.clearQueue();
    return { success: true };
  });
}
