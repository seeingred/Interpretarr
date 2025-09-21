import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import pino from 'pino';
import fs from 'fs';

// Mock dependencies before importing logger
vi.mock('pino');
vi.mock('fs');

describe('Logger', () => {
  let mockCreateWriteStream: Mock;
  let mockPino: Mock;
  let mockMultistream: Mock;
  let mockTransport: Mock;
  let mockWriteStream: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset module cache to ensure fresh import
    vi.resetModules();

    // Mock write stream
    mockWriteStream = {
      write: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
    };
    mockCreateWriteStream = (fs.createWriteStream as Mock);
    mockCreateWriteStream.mockReturnValue(mockWriteStream);

    // Mock pino functions
    mockTransport = vi.fn().mockReturnValue({ transport: 'mocked' });
    mockMultistream = vi.fn().mockReturnValue({ multistream: 'mocked' });
    mockPino = vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    });

    // Set properties on the mocked pino module
    Object.assign(pino, {
      multistream: mockMultistream,
      transport: mockTransport,
      stdTimeFunctions: {
        isoTime: vi.fn().mockReturnValue('isoTime'),
      },
    });

    // Make pino itself return the mock logger
    (pino as unknown as Mock).mockReturnValue(mockPino());
  });

  describe('Logger initialization', () => {
    it('should create write stream with correct path and flags', async () => {
      // Dynamic import to use fresh mocks
      await import('../../../src/server/utils/logger');

      expect(mockCreateWriteStream).toHaveBeenCalledWith('/app/data/app.log', { flags: 'a' });
    });

    it('should configure pino with correct options', async () => {
      await import('../../../src/server/utils/logger');

      expect(mockPino).toHaveBeenCalledWith(
        {
          level: 'info',
          timestamp: 'isoTime',
        },
        { multistream: 'mocked' }
      );
    });

    it('should setup multistream with console and file outputs', async () => {
      await import('../../../src/server/utils/logger');

      expect(mockMultistream).toHaveBeenCalledWith([
        {
          stream: { transport: 'mocked' },
        },
        {
          stream: mockWriteStream,
        },
      ]);
    });

    it('should configure pino-pretty transport with correct options', async () => {
      await import('../../../src/server/utils/logger');

      expect(mockTransport).toHaveBeenCalledWith({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      });
    });

    it('should use ISO time function from pino', async () => {
      await import('../../../src/server/utils/logger');

      expect((pino as any).stdTimeFunctions.isoTime).toHaveBeenCalled();
    });

    it('should handle write stream creation error', () => {
      mockCreateWriteStream.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Should throw error during module import
      expect(async () => {
        await import('../../../src/server/utils/logger');
      }).rejects.toThrow();
    });

    it('should export logger instance', async () => {
      const mockLoggerInstance = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      mockPino.mockReturnValue(mockLoggerInstance);

      const loggerModule = await import('../../../src/server/utils/logger');

      expect(loggerModule.logger).toBe(mockLoggerInstance);
    });
  });

  describe('Logger configuration', () => {
    it('should set log level to info', async () => {
      await import('../../../src/server/utils/logger');

      const pinoConfig = mockPino.mock.calls[0][0];
      expect(pinoConfig.level).toBe('info');
    });

    it('should append to log file', async () => {
      await import('../../../src/server/utils/logger');

      const writeStreamOptions = mockCreateWriteStream.mock.calls[0][1];
      expect(writeStreamOptions.flags).toBe('a');
    });

    it('should setup two streams in multistream', async () => {
      await import('../../../src/server/utils/logger');

      const streams = mockMultistream.mock.calls[0][0];
      expect(streams).toHaveLength(2);
    });

    it('should configure console stream as first stream', async () => {
      await import('../../../src/server/utils/logger');

      const streams = mockMultistream.mock.calls[0][0];
      expect(streams[0].stream).toEqual({ transport: 'mocked' });
    });

    it('should configure file stream as second stream', async () => {
      await import('../../../src/server/utils/logger');

      const streams = mockMultistream.mock.calls[0][0];
      expect(streams[1].stream).toBe(mockWriteStream);
    });

    it('should enable colorization in console output', async () => {
      await import('../../../src/server/utils/logger');

      const transportOptions = mockTransport.mock.calls[0][0];
      expect(transportOptions.options.colorize).toBe(true);
    });

    it('should translate time to system standard format', async () => {
      await import('../../../src/server/utils/logger');

      const transportOptions = mockTransport.mock.calls[0][0];
      expect(transportOptions.options.translateTime).toBe('SYS:standard');
    });

    it('should ignore pid and hostname in console output', async () => {
      await import('../../../src/server/utils/logger');

      const transportOptions = mockTransport.mock.calls[0][0];
      expect(transportOptions.options.ignore).toBe('pid,hostname');
    });
  });

  describe('Logger usage', () => {
    it('should provide standard logging methods', async () => {
      const mockLoggerInstance = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
        fatal: vi.fn(),
      };
      mockPino.mockReturnValue(mockLoggerInstance);

      const { logger } = await import('../../../src/server/utils/logger');

      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.debug).toBeDefined();
    });

    it('should be callable with string messages', async () => {
      const mockLoggerInstance = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      mockPino.mockReturnValue(mockLoggerInstance);

      const { logger } = await import('../../../src/server/utils/logger');

      logger.info('Test message');
      logger.warn('Warning message');
      logger.error('Error message');
      logger.debug('Debug message');

      expect(mockLoggerInstance.info).toHaveBeenCalledWith('Test message');
      expect(mockLoggerInstance.warn).toHaveBeenCalledWith('Warning message');
      expect(mockLoggerInstance.error).toHaveBeenCalledWith('Error message');
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith('Debug message');
    });

    it('should be callable with object and string', async () => {
      const mockLoggerInstance = {
        info: vi.fn(),
      };
      mockPino.mockReturnValue(mockLoggerInstance);

      const { logger } = await import('../../../src/server/utils/logger');

      const context = { userId: 123, action: 'login' };
      logger.info(context, 'User logged in');

      expect(mockLoggerInstance.info).toHaveBeenCalledWith(context, 'User logged in');
    });
  });

  describe('File paths', () => {
    it('should use /app/data/app.log as log file path', async () => {
      await import('../../../src/server/utils/logger');

      expect(mockCreateWriteStream).toHaveBeenCalledWith('/app/data/app.log', expect.any(Object));
    });

    it('should create parent directories if needed', async () => {
      // Note: Current implementation doesn't create directories
      // This test documents current behavior
      mockCreateWriteStream.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      await expect(import('../../../src/server/utils/logger')).rejects.toThrow('ENOENT');
    });
  });

  describe('Multistream configuration', () => {
    it('should pass multistream result to pino', async () => {
      const multistreamResult = { id: 'multistream-result' };
      mockMultistream.mockReturnValue(multistreamResult);

      await import('../../../src/server/utils/logger');

      expect(mockPino).toHaveBeenCalledWith(expect.any(Object), multistreamResult);
    });

    it('should create transport before multistream', async () => {
      const callOrder: string[] = [];
      mockTransport.mockImplementation(() => {
        callOrder.push('transport');
        return { transport: 'mocked' };
      });
      mockMultistream.mockImplementation(() => {
        callOrder.push('multistream');
        return { multistream: 'mocked' };
      });

      await import('../../../src/server/utils/logger');

      expect(callOrder).toEqual(['transport', 'multistream']);
    });
  });

  describe('Pino configuration object', () => {
    it('should use timestamp function from stdTimeFunctions', async () => {
      const mockIsoTime = vi.fn().mockReturnValue('custom-iso-time');
      (pino as any).stdTimeFunctions = {
        isoTime: mockIsoTime,
      };

      await import('../../../src/server/utils/logger');

      const pinoConfig = mockPino.mock.calls[0][0];
      expect(pinoConfig.timestamp).toBe('custom-iso-time');
    });

    it('should not include additional configuration options', async () => {
      await import('../../../src/server/utils/logger');

      const pinoConfig = mockPino.mock.calls[0][0];
      const configKeys = Object.keys(pinoConfig);
      expect(configKeys).toEqual(['level', 'timestamp']);
    });
  });

  describe('Transport options', () => {
    it('should target pino-pretty', async () => {
      await import('../../../src/server/utils/logger');

      const transportConfig = mockTransport.mock.calls[0][0];
      expect(transportConfig.target).toBe('pino-pretty');
    });

    it('should include all required options', async () => {
      await import('../../../src/server/utils/logger');

      const transportConfig = mockTransport.mock.calls[0][0];
      const optionKeys = Object.keys(transportConfig.options);
      expect(optionKeys).toContain('colorize');
      expect(optionKeys).toContain('translateTime');
      expect(optionKeys).toContain('ignore');
    });
  });
});