import { FastifyInstance } from 'fastify';
import { QueueManager, QueueItem } from '../services/queueManager.js';

export async function setupQueueRoutes(fastify: FastifyInstance) {
  const queueManager = QueueManager.getInstance();

  fastify.get('/queue', async (request, reply) => {
    return queueManager.getQueue();
  });

  fastify.post('/queue', async (request, reply) => {
    const item = request.body as Omit<QueueItem, 'id'>;
    fastify.log.info({ queueItem: item }, 'Queue item received');
    const id = await queueManager.addToQueue(item);
    return { id, success: true };
  });

  fastify.delete('/queue/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { forceCancel } = request.query as { forceCancel?: string };

    try {
      await queueManager.removeFromQueue(parseInt(id), forceCancel === 'true');
      return { success: true };
    } catch (error) {
      // Check if it's an active item that needs cancellation
      if (error instanceof Error && error.message.includes('Cannot remove active translation without cancellation')) {
        reply.code(409);  // Conflict status
        return {
          success: false,
          error: error.message,
          requiresCancel: true
        };
      }
      reply.code(400);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove item'
      };
    }
  });

  fastify.delete('/queue', async (request, reply) => {
    queueManager.clearQueue();
    return { success: true };
  });
}