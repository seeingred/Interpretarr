import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupHealthRoutes } from '../../../src/server/routes/health';

// Mock the version module
vi.mock('../../../src/version', () => ({
  APP_VERSION: '1.0.14',
}));

describe('Health Routes', () => {
  let fastify: any;

  beforeEach(() => {
    fastify = {
      get: vi.fn(),
    };
  });

  describe('setupHealthRoutes', () => {
    it('should register all health routes', async () => {
      await setupHealthRoutes(fastify);

      expect(fastify.get).toHaveBeenCalledWith('/version', expect.any(Function));
      expect(fastify.get).toHaveBeenCalledWith('/health', expect.any(Function));
      expect(fastify.get).toHaveBeenCalledWith('/logs/stream', expect.any(Function));
    });

    it('should register three routes', async () => {
      await setupHealthRoutes(fastify);
      expect(fastify.get).toHaveBeenCalledTimes(3);
    });
  });

  describe('GET /version', () => {
    it('should return the app version', async () => {
      await setupHealthRoutes(fastify);

      const handler = fastify.get.mock.calls.find(
        (call: any) => call[0] === '/version'
      )[1];

      const result = await handler({}, {});

      expect(result).toEqual({ version: '1.0.14' });
    });
  });

  describe('GET /health', () => {
    it('should return ok status with services', async () => {
      await setupHealthRoutes(fastify);

      const handler = fastify.get.mock.calls.find(
        (call: any) => call[0] === '/health'
      )[1];

      const result = await handler({}, {});

      expect(result).toEqual({
        status: 'ok',
        services: {
          interpretarr: true,
        },
      });
    });
  });

  describe('GET /logs/stream', () => {
    it('should setup server-sent events stream', async () => {
      const mockReply = {
        raw: {
          writeHead: vi.fn(),
          write: vi.fn(),
          end: vi.fn(),
        },
      };

      const mockRequest = {
        raw: {
          on: vi.fn(),
        },
      };

      await setupHealthRoutes(fastify);

      const handler = fastify.get.mock.calls.find(
        (call: any) => call[0] === '/logs/stream'
      )[1];

      handler(mockRequest, mockReply);

      expect(mockReply.raw.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      expect(mockReply.raw.write).toHaveBeenCalledWith('data: Connected to log stream\n\n');
      expect(mockRequest.raw.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should cleanup on connection close', async () => {
      vi.useFakeTimers();

      const mockReply = {
        raw: {
          writeHead: vi.fn(),
          write: vi.fn(),
          end: vi.fn(),
        },
      };

      let closeCallback: Function;
      const mockRequest = {
        raw: {
          on: vi.fn((event: string, callback: Function) => {
            if (event === 'close') {
              closeCallback = callback;
            }
          }),
        },
      };

      await setupHealthRoutes(fastify);

      const handler = fastify.get.mock.calls.find(
        (call: any) => call[0] === '/logs/stream'
      )[1];

      handler(mockRequest, mockReply);
      closeCallback!();

      expect(mockReply.raw.end).toHaveBeenCalled();

      // Verify interval is cleared
      mockReply.raw.write.mockClear();
      vi.advanceTimersByTime(30000);
      expect(mockReply.raw.write).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
