import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupQueueRoutes } from '../../../src/server/routes/queue';
import { QueueManager } from '../../../src/server/services/queueManager';

describe('Queue Routes', () => {
  let fastify: any;
  let mockQueueManager: any;
  let mockReply: any;

  beforeEach(() => {
    mockQueueManager = {
      getQueue: vi.fn(),
      addToQueue: vi.fn(),
      removeFromQueue: vi.fn(),
      clearQueue: vi.fn(),
      cancelActive: vi.fn(),
      recover: vi.fn(),
    };

    fastify = {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    };

    mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
  });

  describe('setupQueueRoutes', () => {
    it('should register all queue routes', async () => {
      await setupQueueRoutes(fastify, mockQueueManager as unknown as QueueManager);

      expect(fastify.get).toHaveBeenCalledWith('/queue', expect.any(Function));
      expect(fastify.post).toHaveBeenCalledWith('/queue', expect.any(Function));
      expect(fastify.delete).toHaveBeenCalledWith('/queue/:id', expect.any(Function));
      expect(fastify.delete).toHaveBeenCalledWith('/queue', expect.any(Function));
    });

    it('should register all four routes', async () => {
      await setupQueueRoutes(fastify, mockQueueManager as unknown as QueueManager);

      expect(fastify.get).toHaveBeenCalledTimes(1);
      expect(fastify.post).toHaveBeenCalledTimes(1);
      expect(fastify.delete).toHaveBeenCalledTimes(2);
    });
  });

  describe('GET /queue', () => {
    it('should return queue items', async () => {
      const mockQueue = [
        { id: 1, item_name: 'Test Movie', status: 'pending' },
        { id: 2, item_name: 'Test Episode', status: 'active' },
      ];
      mockQueueManager.getQueue.mockReturnValue(mockQueue);

      await setupQueueRoutes(fastify, mockQueueManager as unknown as QueueManager);

      const handler = fastify.get.mock.calls[0][1];
      const result = await handler({}, mockReply);

      expect(result).toEqual(mockQueue);
      expect(mockQueueManager.getQueue).toHaveBeenCalled();
    });

    it('should return empty array when queue is empty', async () => {
      mockQueueManager.getQueue.mockReturnValue([]);

      await setupQueueRoutes(fastify, mockQueueManager as unknown as QueueManager);

      const handler = fastify.get.mock.calls[0][1];
      const result = await handler({}, mockReply);

      expect(result).toEqual([]);
    });
  });

  describe('POST /queue', () => {
    it('should add item to queue and return id', async () => {
      const newItem = {
        type: 'movie',
        item_id: '3',
        item_name: 'New Movie',
        subtitle_file: '/path/to/movie.srt',
        target_language: 'de',
      };

      mockQueueManager.addToQueue.mockReturnValue({ id: 123 });

      await setupQueueRoutes(fastify, mockQueueManager as unknown as QueueManager);

      const handler = fastify.post.mock.calls[0][1];
      const result = await handler({ body: newItem }, mockReply);

      expect(result).toEqual({ id: 123, success: true });
      expect(mockQueueManager.addToQueue).toHaveBeenCalledWith(newItem);
    });

    it('should handle item with subtitle_stream_id', async () => {
      const newItem = {
        type: 'episode',
        item_id: '4',
        item_name: 'Episode with Embedded',
        subtitle_file: '/path/to/video.mkv',
        subtitle_stream_id: 2,
        target_language: 'ja',
      };

      mockQueueManager.addToQueue.mockReturnValue({ id: 456 });

      await setupQueueRoutes(fastify, mockQueueManager as unknown as QueueManager);

      const handler = fastify.post.mock.calls[0][1];
      const result = await handler({ body: newItem }, mockReply);

      expect(result).toEqual({ id: 456, success: true });
    });
  });

  describe('DELETE /queue/:id', () => {
    it('should remove item from queue', async () => {
      await setupQueueRoutes(fastify, mockQueueManager as unknown as QueueManager);

      const handler = fastify.delete.mock.calls.find(
        (call: any) => call[0] === '/queue/:id'
      )[1];

      const result = await handler({ params: { id: '123' } }, mockReply);

      expect(result).toEqual({ success: true });
      expect(mockQueueManager.removeFromQueue).toHaveBeenCalledWith(123);
    });

    it('should return 400 when removeFromQueue throws Error', async () => {
      mockQueueManager.removeFromQueue.mockImplementation(() => {
        throw new Error('Item not found');
      });

      await setupQueueRoutes(fastify, mockQueueManager as unknown as QueueManager);

      const handler = fastify.delete.mock.calls.find(
        (call: any) => call[0] === '/queue/:id'
      )[1];

      const result = await handler({ params: { id: '999' } }, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(result).toEqual({
        success: false,
        error: 'Item not found',
      });
    });

    it('should return generic error for non-Error exceptions', async () => {
      mockQueueManager.removeFromQueue.mockImplementation(() => {
        throw 'String error';
      });

      await setupQueueRoutes(fastify, mockQueueManager as unknown as QueueManager);

      const handler = fastify.delete.mock.calls.find(
        (call: any) => call[0] === '/queue/:id'
      )[1];

      const result = await handler({ params: { id: '789' } }, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(result).toEqual({
        success: false,
        error: 'Failed to remove item',
      });
    });
  });

  describe('DELETE /queue', () => {
    it('should clear the queue', async () => {
      await setupQueueRoutes(fastify, mockQueueManager as unknown as QueueManager);

      const handler = fastify.delete.mock.calls.find(
        (call: any) => call[0] === '/queue'
      )[1];

      const result = await handler({}, mockReply);

      expect(result).toEqual({ success: true });
      expect(mockQueueManager.clearQueue).toHaveBeenCalled();
    });
  });
});
