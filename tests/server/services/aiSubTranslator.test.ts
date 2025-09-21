import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { AiSubTranslatorService } from '../../../src/server/services/aiSubTranslator';
import { SettingsService } from '../../../src/server/services/settings';
import jayson from 'jayson';
import fs from 'fs';
import path from 'path';

// Mock dependencies
vi.mock('../../../src/server/services/settings');
vi.mock('../../../src/server/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}));
vi.mock('jayson');
vi.mock('fs');

describe('AiSubTranslatorService', () => {
  let service: AiSubTranslatorService;
  let mockSettingsService: any;
  let mockClient: any;
  let mockRequest: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    (AiSubTranslatorService as any).instance = undefined;

    // Mock SettingsService
    mockSettingsService = {
      getSetting: vi.fn((key: string) => {
        const settings: { [key: string]: string } = {
          aiSubTranslatorUrl: 'http://localhost:9090',
          aiSubTranslatorApiKey: 'test-api-key',
        };
        return settings[key];
      }),
    };
    (SettingsService.getInstance as Mock).mockReturnValue(mockSettingsService);

    // Mock jayson client
    mockRequest = vi.fn();
    mockClient = {
      request: mockRequest,
    };
    (jayson.Client.http as Mock).mockReturnValue(mockClient);

    service = AiSubTranslatorService.getInstance();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = AiSubTranslatorService.getInstance();
      const instance2 = AiSubTranslatorService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance if none exists', () => {
      (AiSubTranslatorService as any).instance = undefined;
      const instance = AiSubTranslatorService.getInstance();
      expect(instance).toBeInstanceOf(AiSubTranslatorService);
    });
  });

  describe('translateSubtitle', () => {
    beforeEach(() => {
      mockRequest.mockImplementation((method: string, params: any[], callback: Function) => {
        const responses: { [key: string]: any } = {
          'clear': { result: 'cleared' },
          'file.load': {
            result: {
              type: 'subtitle',
              path: '/path/to/subtitle.srt'
            }
          },
          'translation.start': {
            result: { success: true }
          },
          'translation.status': {
            result: { status: 'completed', progress: 100 }
          },
          'translation.save': {
            result: { saved: true }
          },
        };
        callback(null, responses[method] || { result: null });
      });
    });

    it('should translate external subtitle file', async () => {
      const progressCallback = vi.fn();

      const result = await service.translateSubtitle(
        '/path/to/subtitle.srt',
        'es',
        progressCallback
      );

      expect(result).toBe('/path/to/subtitle.es.srt');
      expect(mockRequest).toHaveBeenCalledWith('clear', [], expect.any(Function));
      expect(mockRequest).toHaveBeenCalledWith('file.load', ['/path/to/subtitle.srt'], expect.any(Function));
      expect(mockRequest).toHaveBeenCalledWith('translation.start', [
        {
          apiKey: 'test-api-key',
          language: 'es',
          context: 'subtitle',
          model: 'gemini-1.5-flash-8b',
          batchSize: 50,
        }
      ], expect.any(Function));
      expect(mockRequest).toHaveBeenCalledWith('translation.save', ['/path/to/subtitle.es.srt'], expect.any(Function));
    });

    it('should handle translation progress updates', async () => {
      vi.useFakeTimers();
      const progressCallback = vi.fn();
      let statusCallCount = 0;

      mockRequest.mockImplementation((method: string, params: any[], callback: Function) => {
        if (method === 'translation.status') {
          statusCallCount++;
          const statuses = [
            { result: { status: 'processing', progress: 25 } },
            { result: { status: 'processing', progress: 50 } },
            { result: { status: 'processing', progress: 75 } },
            { result: { status: 'completed', progress: 100 } },
          ];
          callback(null, statuses[Math.min(statusCallCount - 1, statuses.length - 1)]);
        } else {
          const responses: { [key: string]: any } = {
            'clear': { result: 'cleared' },
            'file.load': { result: { type: 'subtitle', path: '/path/to/subtitle.srt' } },
            'translation.start': { result: { success: true } },
            'translation.save': { result: { saved: true } },
          };
          callback(null, responses[method] || { result: null });
        }
      });

      const promise = service.translateSubtitle('/path/to/subtitle.srt', 'es', progressCallback);

      // Wait for initial delay
      await vi.advanceTimersByTimeAsync(500);

      // Advance timers to trigger progress polling
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(2000);

      await promise;
      vi.useRealTimers();

      expect(progressCallback).toHaveBeenCalledWith(25);
      expect(progressCallback).toHaveBeenCalledWith(50);
      expect(progressCallback).toHaveBeenCalledWith(75);
      expect(progressCallback).toHaveBeenCalledWith(100);
    });
  });

  describe('pollProgress', () => {
    it('should poll until completion', async () => {
      vi.useFakeTimers();
      let pollCount = 0;
      mockRequest.mockImplementation((method: string, params: any[], callback: Function) => {
        if (method === 'translation.status') {
          pollCount++;
          const statuses = [
            { result: { status: 'processing', progress: 33 } },
            { result: { status: 'processing', progress: 66 } },
            { result: { status: 'completed', progress: 100 } },
          ];
          callback(null, statuses[Math.min(pollCount - 1, statuses.length - 1)]);
        }
      });

      const progressCallback = vi.fn();
      const promise = (service as any).pollProgress(progressCallback);

      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(2000);

      await promise;
      vi.useRealTimers();

      expect(progressCallback).toHaveBeenCalledTimes(3);
      expect(progressCallback).toHaveBeenCalledWith(33);
      expect(progressCallback).toHaveBeenCalledWith(66);
      expect(progressCallback).toHaveBeenCalledWith(100);
    });
  });
});