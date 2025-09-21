import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { FastifyInstance } from 'fastify';
import { setupHealthRoutes } from '../../../src/server/routes/health';
import { AiSubTranslatorService } from '../../../src/server/services/aiSubTranslator';
import { APP_VERSION } from '../../../src/version';

// Mock dependencies
vi.mock('../../../src/server/services/aiSubTranslator');
vi.mock('../../../src/version', () => ({
  APP_VERSION: '1.0.2'
}));

describe('Health Routes', () => {
  let fastify: any;
  let mockTranslatorService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock AiSubTranslatorService
    mockTranslatorService = {
      checkServerHealth: vi.fn(),
    };
    (AiSubTranslatorService.getInstance as Mock).mockReturnValue(mockTranslatorService);

    // Mock Fastify instance
    fastify = {
      get: vi.fn(),
      log: {
        info: vi.fn(),
        error: vi.fn(),
      },
    };
  });

  describe('setupHealthRoutes', () => {
    it('should register all health routes', async () => {
      await setupHealthRoutes(fastify);

      expect(fastify.get).toHaveBeenCalledWith('/version', expect.any(Function));
      expect(fastify.get).toHaveBeenCalledWith('/health', expect.any(Function));
      expect(fastify.get).toHaveBeenCalledWith('/logs/stream', expect.any(Function));
    });

    it('should get AiSubTranslatorService instance once', async () => {
      await setupHealthRoutes(fastify);

      expect(AiSubTranslatorService.getInstance).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /version', () => {
    it('should return the app version', async () => {
      await setupHealthRoutes(fastify);

      const handler = fastify.get.mock.calls.find(
        (call: any) => call[0] === '/version'
      )[1];

      const result = await handler({}, {});

      expect(result).toEqual({ version: '1.0.2' });
    });

    it('should return version from APP_VERSION constant', async () => {
      await setupHealthRoutes(fastify);

      const handler = fastify.get.mock.calls.find(
        (call: any) => call[0] === '/version'
      )[1];

      const result = await handler({}, {});

      expect(result.version).toBe(APP_VERSION);
    });
  });

  describe('GET /health', () => {
    it('should return health status with services', async () => {
      mockTranslatorService.checkServerHealth.mockResolvedValue(true);

      await setupHealthRoutes(fastify);

      const handler = fastify.get.mock.calls.find(
        (call: any) => call[0] === '/health'
      )[1];

      const result = await handler({}, {});

      expect(result).toEqual({
        status: 'ok',
        services: {
          interpretarr: true,
          aiSubTranslator: true,
        },
      });
      expect(mockTranslatorService.checkServerHealth).toHaveBeenCalled();
    });

    it('should handle translator service being down', async () => {
      mockTranslatorService.checkServerHealth.mockResolvedValue(false);

      await setupHealthRoutes(fastify);

      const handler = fastify.get.mock.calls.find(
        (call: any) => call[0] === '/health'
      )[1];

      const result = await handler({}, {});

      expect(result).toEqual({
        status: 'ok',
        services: {
          interpretarr: true,
          aiSubTranslator: false,
        },
      });
    });

    it('should handle translator service check error', async () => {
      mockTranslatorService.checkServerHealth.mockRejectedValue(new Error('Connection failed'));

      await setupHealthRoutes(fastify);

      const handler = fastify.get.mock.calls.find(
        (call: any) => call[0] === '/health'
      )[1];

      await expect(handler({}, {})).rejects.toThrow('Connection failed');
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

    it('should send periodic heartbeat messages', async () => {
      vi.useFakeTimers();

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

      // Advance time to trigger heartbeat
      vi.advanceTimersByTime(30000);

      expect(mockReply.raw.write).toHaveBeenCalledWith(
        expect.stringContaining('[')
      );
      expect(mockReply.raw.write).toHaveBeenCalledWith(
        expect.stringContaining('] Server is running')
      );

      vi.useRealTimers();
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
          on: vi.fn((event, callback) => {
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

      // Simulate connection close
      closeCallback!();

      expect(mockReply.raw.end).toHaveBeenCalled();

      // Verify interval is cleared (no more writes after close)
      mockReply.raw.write.mockClear();
      vi.advanceTimersByTime(30000);
      expect(mockReply.raw.write).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('Route registration order', () => {
    it('should register version route before health route', async () => {
      await setupHealthRoutes(fastify);

      const getCalls = fastify.get.mock.calls;
      const versionIndex = getCalls.findIndex((call: any) => call[0] === '/version');
      const healthIndex = getCalls.findIndex((call: any) => call[0] === '/health');

      expect(versionIndex).toBeGreaterThanOrEqual(0);
      expect(healthIndex).toBeGreaterThanOrEqual(0);
      expect(versionIndex).toBeLessThan(healthIndex);
    });

    it('should register all three routes', async () => {
      await setupHealthRoutes(fastify);

      expect(fastify.get).toHaveBeenCalledTimes(3);
    });
  });
});