import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import pino from 'pino';
import fs from 'fs';

// Mock dependencies before importing logger
vi.mock('pino');
vi.mock('fs');

describe('Logger', () => {
  let mockCreateWriteStream: Mock;
  let mockMultistream: Mock;
  let mockTransport: Mock;
  let mockWriteStream: any;
  let mockLoggerInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mockWriteStream = {
      write: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
    };
    mockCreateWriteStream = fs.createWriteStream as Mock;
    mockCreateWriteStream.mockReturnValue(mockWriteStream);

    mockTransport = vi.fn().mockReturnValue({ transport: 'mocked' });
    mockMultistream = vi.fn().mockReturnValue({ multistream: 'mocked' });

    mockLoggerInstance = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    Object.assign(pino, {
      multistream: mockMultistream,
      transport: mockTransport,
      stdTimeFunctions: {
        isoTime: vi.fn().mockReturnValue('isoTime'),
      },
    });

    (pino as unknown as Mock).mockReturnValue(mockLoggerInstance);
  });

  describe('Logger initialization', () => {
    it('should create write stream with correct path', async () => {
      await import('../../../src/server/utils/logger');

      expect(mockCreateWriteStream).toHaveBeenCalledWith('/app/data/app.log', { flags: 'a' });
    });

    it('should configure pino with info level', async () => {
      await import('../../../src/server/utils/logger');

      expect(pino).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'info' }),
        expect.anything()
      );
    });

    it('should setup multistream with console and file outputs', async () => {
      await import('../../../src/server/utils/logger');

      expect(mockMultistream).toHaveBeenCalledWith([
        { stream: { transport: 'mocked' } },
        { stream: mockWriteStream },
      ]);
    });

    it('should configure pino-pretty transport', async () => {
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

    it('should export logger instance', async () => {
      const loggerModule = await import('../../../src/server/utils/logger');
      expect(loggerModule.logger).toBeDefined();
      expect(loggerModule.logger).toBe(mockLoggerInstance);
    });
  });
});
