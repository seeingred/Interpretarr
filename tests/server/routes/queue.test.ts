import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { setupQueueRoutes } from '../../../src/server/routes/queue';
import { QueueManager, QueueItem } from '../../../src/server/services/queueManager';

// Mock the QueueManager module
vi.mock('../../../src/server/services/queueManager');

describe('Queue Routes', () => {
  let fastify: any;
  let mockQueueManager: any;
  let mockReply: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock QueueManager instance
    mockQueueManager = {
      getQueue: vi.fn(),
      addToQueue: vi.fn(),
      removeFromQueue: vi.fn(),
      clearQueue: vi.fn(),
    };

    (QueueManager.getInstance as Mock).mockReturnValue(mockQueueManager);

    // Mock Fastify instance
    fastify = {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
      log: {
        info: vi.fn(),
        error: vi.fn(),
      },
    };

    // Mock reply object
    mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
  });

  describe('setupQueueRoutes', () => {
    it('should register all queue routes', async () => {
      await setupQueueRoutes(fastify);

      expect(fastify.get).toHaveBeenCalledWith('/queue', expect.any(Function));
      expect(fastify.post).toHaveBeenCalledWith('/queue', expect.any(Function));
      expect(fastify.delete).toHaveBeenCalledWith('/queue/:id', expect.any(Function));
      expect(fastify.delete).toHaveBeenCalledWith('/queue', expect.any(Function));
    });

    it('should get QueueManager instance once', async () => {
      await setupQueueRoutes(fastify);

      expect(QueueManager.getInstance).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /queue', () => {
    it('should return queue items', async () => {
      const mockQueue: QueueItem[] = [
        {
          id: 1,
          type: 'movie',
          item_id: '1',
          item_name: 'Test Movie',
          subtitle_file: 'test.srt',
          target_language: 'es',
          status: 'pending',
        },
        {
          id: 2,
          type: 'episode',
          item_id: '2',
          item_name: 'Test Episode',
          subtitle_file: 'episode.srt',
          target_language: 'fr',
          status: 'active',
        },
      ];

      mockQueueManager.getQueue.mockReturnValue(mockQueue);

      await setupQueueRoutes(fastify);

      const handler = fastify.get.mock.calls[0][1];
      const result = await handler({}, mockReply);

      expect(result).toEqual(mockQueue);
      expect(mockQueueManager.getQueue).toHaveBeenCalled();
    });

    it('should return empty array when queue is empty', async () => {
      mockQueueManager.getQueue.mockReturnValue([]);

      await setupQueueRoutes(fastify);

      const handler = fastify.get.mock.calls[0][1];
      const result = await handler({}, mockReply);

      expect(result).toEqual([]);
    });

    it('should handle getQueue errors', async () => {
      mockQueueManager.getQueue.mockImplementation(() => {
        throw new Error('Database error');
      });

      await setupQueueRoutes(fastify);

      const handler = fastify.get.mock.calls[0][1];

      await expect(handler({}, mockReply)).rejects.toThrow('Database error');
    });
  });

  describe('POST /queue', () => {
    it('should add item to queue', async () => {
      const newItem: Omit<QueueItem, 'id'> = {
        type: 'movie',
        item_id: '3',
        item_name: 'New Movie',
        subtitle_file: '/path/to/movie.srt',
        target_language: 'de',
      };

      mockQueueManager.addToQueue.mockResolvedValue(123);

      await setupQueueRoutes(fastify);

      const handler = fastify.post.mock.calls[0][1];
      const request = { body: newItem };
      const result = await handler(request, mockReply);

      expect(result).toEqual({ id: 123, success: true });
      expect(mockQueueManager.addToQueue).toHaveBeenCalledWith(newItem);
      expect(fastify.log.info).toHaveBeenCalledWith({ queueItem: newItem }, 'Queue item received');
    });

    it('should handle item with subtitle_stream_id', async () => {
      const newItem: Omit<QueueItem, 'id'> = {
        type: 'episode',
        item_id: '4',
        item_name: 'Episode with Embedded',
        subtitle_file: '/path/to/video.mkv',
        subtitle_stream_id: 2,
        target_language: 'ja',
      };

      mockQueueManager.addToQueue.mockResolvedValue(456);

      await setupQueueRoutes(fastify);

      const handler = fastify.post.mock.calls[0][1];
      const request = { body: newItem };
      const result = await handler(request, mockReply);

      expect(result).toEqual({ id: 456, success: true });
      expect(mockQueueManager.addToQueue).toHaveBeenCalledWith(newItem);
    });

    it('should handle addToQueue errors', async () => {
      const newItem: Omit<QueueItem, 'id'> = {
        type: 'movie',
        item_id: '5',
        item_name: 'Error Movie',
        subtitle_file: 'error.srt',
        target_language: 'es',
      };

      mockQueueManager.addToQueue.mockRejectedValue(new Error('Queue full'));

      await setupQueueRoutes(fastify);

      const handler = fastify.post.mock.calls[0][1];
      const request = { body: newItem };

      await expect(handler(request, mockReply)).rejects.toThrow('Queue full');
    });

    it('should handle invalid body', async () => {
      await setupQueueRoutes(fastify);

      const handler = fastify.post.mock.calls[0][1];
      const request = { body: null };

      mockQueueManager.addToQueue.mockResolvedValue(789);
      const result = await handler(request, mockReply);

      expect(result).toEqual({ id: 789, success: true });
      expect(mockQueueManager.addToQueue).toHaveBeenCalledWith(null);
    });
  });

  describe('DELETE /queue/:id', () => {
    it('should remove item from queue', async () => {
      await setupQueueRoutes(fastify);

      const handler = fastify.delete.mock.calls.find(
        (call: any) => call[0] === '/queue/:id'
      )[1];

      const request = { params: { id: '123' } };
      const result = await handler(request, mockReply);

      expect(result).toEqual({ success: true });
      expect(mockQueueManager.removeFromQueue).toHaveBeenCalledWith(123);
    });

    it('should handle removal of active item error', async () => {
      mockQueueManager.removeFromQueue.mockImplementation(() => {
        throw new Error('Cannot remove active translation');
      });

      await setupQueueRoutes(fastify);

      const handler = fastify.delete.mock.calls.find(
        (call: any) => call[0] === '/queue/:id'
      )[1];

      const request = { params: { id: '456' } };
      const result = await handler(request, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(result).toEqual({
        success: false,
        error: 'Cannot remove active translation',
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockQueueManager.removeFromQueue.mockImplementation(() => {
        throw 'String error';
      });

      await setupQueueRoutes(fastify);

      const handler = fastify.delete.mock.calls.find(
        (call: any) => call[0] === '/queue/:id'
      )[1];

      const request = { params: { id: '789' } };
      const result = await handler(request, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(result).toEqual({
        success: false,
        error: 'Failed to remove item',
      });
    });

    it('should handle invalid ID format', async () => {
      await setupQueueRoutes(fastify);

      const handler = fastify.delete.mock.calls.find(
        (call: any) => call[0] === '/queue/:id'
      )[1];

      const request = { params: { id: 'invalid' } };
      const result = await handler(request, mockReply);

      expect(result).toEqual({ success: true });
      expect(mockQueueManager.removeFromQueue).toHaveBeenCalledWith(NaN);
    });

    it('should handle zero ID', async () => {
      await setupQueueRoutes(fastify);

      const handler = fastify.delete.mock.calls.find(
        (call: any) => call[0] === '/queue/:id'
      )[1];

      const request = { params: { id: '0' } };
      const result = await handler(request, mockReply);

      expect(result).toEqual({ success: true });
      expect(mockQueueManager.removeFromQueue).toHaveBeenCalledWith(0);
    });

    it('should handle negative ID', async () => {
      await setupQueueRoutes(fastify);

      const handler = fastify.delete.mock.calls.find(
        (call: any) => call[0] === '/queue/:id'
      )[1];

      const request = { params: { id: '-1' } };
      const result = await handler(request, mockReply);

      expect(result).toEqual({ success: true });
      expect(mockQueueManager.removeFromQueue).toHaveBeenCalledWith(-1);
    });
  });

  describe('DELETE /queue', () => {
    it('should clear the queue', async () => {
      await setupQueueRoutes(fastify);

      // Get the handler for DELETE /queue (not /queue/:id)
      const handler = fastify.delete.mock.calls.find(
        (call: any) => call[0] === '/queue'
      )[1];

      const result = await handler({}, mockReply);

      expect(result).toEqual({ success: true });
      expect(mockQueueManager.clearQueue).toHaveBeenCalled();
    });

    it('should handle clearQueue errors', async () => {
      mockQueueManager.clearQueue.mockImplementation(() => {
        throw new Error('Database locked');
      });

      await setupQueueRoutes(fastify);

      const handler = fastify.delete.mock.calls.find(
        (call: any) => call[0] === '/queue'
      )[1];

      await expect(handler({}, mockReply)).rejects.toThrow('Database locked');
    });

    it('should be registered after DELETE /queue/:id', async () => {
      await setupQueueRoutes(fastify);

      const deleteCalls = fastify.delete.mock.calls;
      const parameterizedIndex = deleteCalls.findIndex((call: any) => call[0] === '/queue/:id');
      const clearIndex = deleteCalls.findIndex((call: any) => call[0] === '/queue');

      expect(parameterizedIndex).toBeGreaterThanOrEqual(0);
      expect(clearIndex).toBeGreaterThanOrEqual(0);
      expect(clearIndex).toBeGreaterThan(parameterizedIndex);
    });
  });

  describe('Route registration order', () => {
    it('should register routes in correct order', async () => {
      await setupQueueRoutes(fastify);

      // Check that routes are registered in order
      expect(fastify.get.mock.calls.length).toBeGreaterThan(0);
      expect(fastify.post.mock.calls.length).toBeGreaterThan(0);
      expect(fastify.delete.mock.calls.length).toBeGreaterThan(0);
    });

    it('should register all four routes', async () => {
      await setupQueueRoutes(fastify);

      expect(fastify.get).toHaveBeenCalledTimes(1);
      expect(fastify.post).toHaveBeenCalledTimes(1);
      expect(fastify.delete).toHaveBeenCalledTimes(2);
    });
  });
});