import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { QueueManager, QueueItem } from '../../../src/server/services/queueManager';
import * as database from '../../../src/server/db/database';
import * as logger from '../../../src/server/utils/logger';
import { AiSubTranslatorService } from '../../../src/server/services/aiSubTranslator';

// Mock dependencies
vi.mock('../../../src/server/db/database');
vi.mock('../../../src/server/utils/logger');
vi.mock('../../../src/server/services/aiSubTranslator');

describe('QueueManager', () => {
  let mockDb: any;
  let mockTranslator: any;
  let queueManager: QueueManager;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Reset singleton instance
    (QueueManager as any).instance = undefined;

    // Mock database
    mockDb = {
      prepare: vi.fn(),
      exec: vi.fn(),
    };
    (database.getDb as Mock).mockReturnValue(mockDb);

    // Mock logger
    (logger.logger as any) = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    // Mock translator
    mockTranslator = {
      translateSubtitle: vi.fn(),
      cancelTranslation: vi.fn(),
      hasActiveTranslation: vi.fn().mockResolvedValue(false),
    };
    (AiSubTranslatorService.getInstance as Mock).mockReturnValue(mockTranslator);

    queueManager = QueueManager.getInstance();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = QueueManager.getInstance();
      const instance2 = QueueManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance if none exists', () => {
      (QueueManager as any).instance = undefined;
      const instance = QueueManager.getInstance();
      expect(instance).toBeInstanceOf(QueueManager);
    });
  });

  describe('constructor', () => {
    it('should set up interval for queue processing', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      (QueueManager as any).instance = undefined;
      new QueueManager();
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
    });
  });

  describe('addToQueue', () => {
    it('should add item to database queue', async () => {
      const mockRun = vi.fn().mockReturnValue({ lastInsertRowid: 123 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const item: Omit<QueueItem, 'id'> = {
        type: 'movie',
        item_id: 'movie-1',
        item_name: 'Test Movie',
        subtitle_file: '/path/to/subtitle.srt',
        target_language: 'es',
      };

      const result = await queueManager.addToQueue(item);

      expect(result).toBe(123);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO queue'));
      expect(mockRun).toHaveBeenCalledWith(
        'movie',
        'movie-1',
        'Test Movie',
        '/path/to/subtitle.srt',
        null,
        'es'
      );
    });

    it('should handle subtitle_stream_id when provided', async () => {
      const mockRun = vi.fn().mockReturnValue({ lastInsertRowid: 124 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const item: Omit<QueueItem, 'id'> = {
        type: 'episode',
        item_id: 'ep-1',
        item_name: 'Test Episode',
        subtitle_file: '/path/to/video.mkv',
        subtitle_stream_id: 3,
        target_language: 'fr',
      };

      await queueManager.addToQueue(item);

      expect(mockRun).toHaveBeenCalledWith(
        'episode',
        'ep-1',
        'Test Episode',
        '/path/to/video.mkv',
        3,
        'fr'
      );
    });

    it('should add item without triggering immediate processing', async () => {
      const mockRun = vi.fn().mockReturnValue({ lastInsertRowid: 125 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const item: Omit<QueueItem, 'id'> = {
        type: 'movie',
        item_id: 'movie-2',
        item_name: 'Test Movie 2',
        subtitle_file: '/path/to/subtitle2.srt',
        target_language: 'de',
      };

      await queueManager.addToQueue(item);

      // Should only call INSERT, not SELECT
      expect(mockDb.prepare).toHaveBeenCalledTimes(1);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO queue'));
    });

    it('should log when adding item to queue', async () => {
      const mockRun = vi.fn().mockReturnValue({ lastInsertRowid: 126 });
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const item: Omit<QueueItem, 'id'> = {
        type: 'movie',
        item_id: 'movie-3',
        item_name: 'Test Movie 3',
        subtitle_file: '/path/to/subtitle3.srt',
        target_language: 'it',
      };

      await queueManager.addToQueue(item);

      expect(logger.logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ item_name: 'Test Movie 3' }),
        'Adding item to queue with details'
      );
    });
  });

  describe('getQueue', () => {
    it('should return all queue items ordered by status and creation time', () => {
      const mockItems: QueueItem[] = [
        { id: 1, type: 'movie', item_id: '1', item_name: 'Movie 1', subtitle_file: 'sub1.srt', target_language: 'es', status: 'active' },
        { id: 2, type: 'movie', item_id: '2', item_name: 'Movie 2', subtitle_file: 'sub2.srt', target_language: 'fr', status: 'pending' },
        { id: 3, type: 'episode', item_id: '3', item_name: 'Episode 1', subtitle_file: 'sub3.srt', target_language: 'de', status: 'completed' },
      ];

      const mockAll = vi.fn().mockReturnValue(mockItems);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      const result = queueManager.getQueue();

      expect(result).toEqual(mockItems);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('ORDER BY'));
      expect(mockAll).toHaveBeenCalled();
    });

    it('should return empty array when queue is empty', () => {
      const mockAll = vi.fn().mockReturnValue([]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      const result = queueManager.getQueue();

      expect(result).toEqual([]);
    });
  });

  describe('removeFromQueue', () => {
    it('should remove non-active item from queue', async () => {
      const mockGet = vi.fn().mockReturnValue({
        id: 1,
        item_name: 'Test Movie',
        status: 'pending',
      });
      const mockRun = vi.fn();

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT')) return { get: mockGet };
        if (sql.includes('DELETE')) return { run: mockRun };
      });

      await queueManager.removeFromQueue(1);

      expect(mockGet).toHaveBeenCalledWith(1);
      expect(mockRun).toHaveBeenCalledWith(1);
      expect(logger.logger.info).toHaveBeenCalledWith('Removed from queue: 1');
    });

    it('should throw error when trying to remove active item without force', async () => {
      const mockGet = vi.fn().mockReturnValue({
        id: 2,
        item_name: 'Active Movie',
        status: 'active',
      });

      mockDb.prepare.mockReturnValue({ get: mockGet });

      await expect(queueManager.removeFromQueue(2, false)).rejects.toThrow(
        'Cannot remove active translation without cancellation'
      );
      expect(logger.logger.warn).toHaveBeenCalledWith(
        'Cannot remove active item without cancellation: Active Movie'
      );
    });

    it('should handle non-existent item', async () => {
      const mockGet = vi.fn().mockReturnValue(undefined);
      const mockRun = vi.fn();

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT')) return { get: mockGet };
        if (sql.includes('DELETE')) return { run: mockRun };
      });

      await queueManager.removeFromQueue(999);

      expect(mockRun).toHaveBeenCalledWith(999);
    });
  });

  describe('clearQueue', () => {
    it('should delete all non-active items from queue', () => {
      const mockRun = vi.fn();
      mockDb.prepare.mockReturnValue({ run: mockRun });

      queueManager.clearQueue();

      expect(mockDb.prepare).toHaveBeenCalledWith("DELETE FROM queue WHERE status != 'active'");
      expect(mockRun).toHaveBeenCalled();
      expect(logger.logger.info).toHaveBeenCalledWith('Queue cleared (except active items)');
    });
  });

  describe('processQueue', () => {
    it('should process pending item successfully', async () => {
      const pendingItem: QueueItem = {
        id: 1,
        type: 'movie',
        item_id: 'movie-1',
        item_name: 'Test Movie',
        subtitle_file: '/path/to/subtitle.srt',
        target_language: 'es',
        status: 'pending',
      };

      const mockGet = vi.fn()
        .mockReturnValueOnce(pendingItem)  // First call returns pending item
        .mockReturnValueOnce(undefined);    // Second call returns nothing

      const mockRun = vi.fn();

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT')) return { get: mockGet };
        if (sql.includes('UPDATE')) return { run: mockRun };
      });

      mockTranslator.translateSubtitle.mockImplementation(
        async (_file: string, _lang: string, progressCb: Function) => {
          progressCb(50);
          progressCb(100);
        }
      );

      // Trigger processQueue via interval
      vi.advanceTimersByTime(5000);
      await vi.runOnlyPendingTimersAsync();

      expect(mockTranslator.translateSubtitle).toHaveBeenCalledWith(
        '/path/to/subtitle.srt',
        'es',
        expect.any(Function),
        undefined
      );

      // Should update status to active, then progress, then completed
      expect(mockRun).toHaveBeenCalledTimes(4); // active, progress 50, progress 100, completed
    });

    it('should handle translation failure', async () => {
      const pendingItem: QueueItem = {
        id: 2,
        type: 'episode',
        item_id: 'ep-1',
        item_name: 'Test Episode',
        subtitle_file: '/path/to/video.mkv',
        subtitle_stream_id: 2,
        target_language: 'fr',
        status: 'pending',
      };

      const mockGet = vi.fn()
        .mockReturnValueOnce(pendingItem)
        .mockReturnValueOnce(undefined);

      const mockRun = vi.fn();

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT')) return { get: mockGet };
        if (sql.includes('UPDATE')) return { run: mockRun };
      });

      const error = new Error('Translation failed');
      mockTranslator.translateSubtitle.mockRejectedValue(error);

      vi.advanceTimersByTime(5000);
      await vi.runOnlyPendingTimersAsync();

      expect(logger.logger.error).toHaveBeenCalledWith(
        'Translation failed: Test Episode - Translation failed'
      );

      // Check that status was updated to failed with error message
      const failedCall = mockRun.mock.calls.find(call =>
        call.includes('failed') && call.includes('Translation failed')
      );
      expect(failedCall).toBeDefined();
    });

    it('should not process if already processing', async () => {
      (queueManager as any).isProcessing = true;

      const mockGet = vi.fn();
      mockDb.prepare.mockReturnValue({ get: mockGet });

      vi.advanceTimersByTime(5000);
      await vi.runOnlyPendingTimersAsync();

      expect(mockGet).not.toHaveBeenCalled();
    });

    it('should skip processing when no pending items', async () => {
      const mockGet = vi.fn().mockReturnValue(undefined);
      mockDb.prepare.mockReturnValue({ get: mockGet });

      vi.advanceTimersByTime(5000);
      await vi.runOnlyPendingTimersAsync();

      expect(mockTranslator.translateSubtitle).not.toHaveBeenCalled();
    });

    it('should handle subtitle_stream_id in translation', async () => {
      const pendingItem: QueueItem = {
        id: 3,
        type: 'movie',
        item_id: 'movie-3',
        item_name: 'Embedded Subtitle Movie',
        subtitle_file: '/path/to/movie.mkv',
        subtitle_stream_id: 5,
        target_language: 'ja',
        status: 'pending',
      };

      const mockGet = vi.fn()
        .mockReturnValueOnce(pendingItem)
        .mockReturnValueOnce(undefined);

      const mockRun = vi.fn();

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT')) return { get: mockGet };
        if (sql.includes('UPDATE')) return { run: mockRun };
      });

      mockTranslator.translateSubtitle.mockResolvedValue(undefined);

      vi.advanceTimersByTime(5000);
      await vi.runOnlyPendingTimersAsync();

      expect(mockTranslator.translateSubtitle).toHaveBeenCalledWith(
        '/path/to/movie.mkv',
        'ja',
        expect.any(Function),
        5
      );
    });

    it('should retry processing after completion', async () => {
      const pendingItem1: QueueItem = {
        id: 1,
        type: 'movie',
        item_id: 'movie-1',
        item_name: 'First Movie',
        subtitle_file: '/path/to/first.srt',
        target_language: 'es',
        status: 'pending',
      };

      const pendingItem2: QueueItem = {
        id: 2,
        type: 'movie',
        item_id: 'movie-2',
        item_name: 'Second Movie',
        subtitle_file: '/path/to/second.srt',
        target_language: 'fr',
        status: 'pending',
      };

      const mockGet = vi.fn()
        .mockReturnValueOnce(pendingItem1)
        .mockReturnValueOnce(pendingItem2)
        .mockReturnValueOnce(undefined);

      const mockRun = vi.fn();

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT')) return { get: mockGet };
        if (sql.includes('UPDATE')) return { run: mockRun };
      });

      mockTranslator.translateSubtitle.mockResolvedValue(undefined);

      // Process first item
      vi.advanceTimersByTime(5000);
      await vi.runOnlyPendingTimersAsync();

      // Process second item after timeout
      vi.advanceTimersByTime(1000);
      await vi.runOnlyPendingTimersAsync();

      expect(mockTranslator.translateSubtitle).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateQueueItem', () => {
    it('should update queue item with provided fields', () => {
      const mockRun = vi.fn();
      mockDb.prepare.mockReturnValue({ run: mockRun });

      (queueManager as any).updateQueueItem(1, {
        status: 'completed',
        progress: 100
      });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('status = ?, progress = ?')
      );
      expect(mockRun).toHaveBeenCalledWith('completed', 100, 1);
    });

    it('should update single field', () => {
      const mockRun = vi.fn();
      mockDb.prepare.mockReturnValue({ run: mockRun });

      (queueManager as any).updateQueueItem(2, { error: 'Test error' });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('error = ?')
      );
      expect(mockRun).toHaveBeenCalledWith('Test error', 2);
    });

    it('should include updated_at timestamp', () => {
      const mockRun = vi.fn();
      mockDb.prepare.mockReturnValue({ run: mockRun });

      (queueManager as any).updateQueueItem(3, { status: 'active' });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = CURRENT_TIMESTAMP')
      );
    });
  });

  describe('getCurrentItem', () => {
    it('should return current processing item', () => {
      const currentItem: QueueItem = {
        id: 1,
        type: 'movie',
        item_id: 'movie-1',
        item_name: 'Current Movie',
        subtitle_file: '/path/to/current.srt',
        target_language: 'es',
        status: 'active',
      };

      (queueManager as any).currentItem = currentItem;

      expect(queueManager.getCurrentItem()).toBe(currentItem);
    });

    it('should return null when no item is processing', () => {
      (queueManager as any).currentItem = null;
      expect(queueManager.getCurrentItem()).toBeNull();
    });
  });

  describe('progress callback', () => {
    it('should update progress during translation', async () => {
      const pendingItem: QueueItem = {
        id: 1,
        type: 'movie',
        item_id: 'movie-1',
        item_name: 'Test Movie',
        subtitle_file: '/path/to/subtitle.srt',
        target_language: 'es',
        status: 'pending',
      };

      const mockGet = vi.fn()
        .mockReturnValueOnce(pendingItem)
        .mockReturnValueOnce(undefined);

      const mockRun = vi.fn();
      const progressValues: number[] = [];

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT')) return { get: mockGet };
        if (sql.includes('UPDATE')) return { run: mockRun };
      });

      mockTranslator.translateSubtitle.mockImplementation(
        async (_file: string, _lang: string, progressCb: Function) => {
          for (let i = 0; i <= 100; i += 25) {
            progressCb(i);
            progressValues.push(i);
          }
        }
      );

      vi.advanceTimersByTime(5000);
      await vi.runOnlyPendingTimersAsync();

      expect(progressValues).toEqual([0, 25, 50, 75, 100]);

      // Verify progress updates were called
      const progressCalls = mockRun.mock.calls.filter(call =>
        typeof call[0] === 'number' && call[0] >= 0 && call[0] <= 100
      );
      expect(progressCalls.length).toBeGreaterThan(0);
    });
  });
});