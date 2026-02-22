import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueueManager, QueueItemInput } from '../../../src/server/services/queueManager';
import { TranslatorService } from '../../../src/server/services/translatorService';

describe('QueueManager', () => {
  let mockTranslator: TranslatorService;
  let mockLogger: any;
  let mockDb: any;

  // Helper to build a mock db that handles SQL-based dispatch
  function createMockDb() {
    const runFn = vi.fn().mockReturnValue({ lastInsertRowid: 1 });
    const getFn = vi.fn();
    const allFn = vi.fn().mockReturnValue([]);

    return {
      prepare: vi.fn((sql: string) => {
        // processNext queries that need special handling
        if (sql.includes('SELECT COUNT(*)')) {
          return { get: vi.fn().mockReturnValue({ count: 0 }) };
        }
        if (sql.includes("SELECT * FROM queue WHERE status = 'pending' ORDER BY")) {
          return { get: vi.fn().mockReturnValue(undefined) };
        }
        if (sql.includes("SELECT * FROM queue WHERE status = 'active'")) {
          return { all: vi.fn().mockReturnValue([]) };
        }
        return { run: runFn, get: getFn, all: allFn };
      }),
      _run: runFn,
      _get: getFn,
      _all: allFn,
    };
  }

  beforeEach(() => {
    mockTranslator = {
      translate: vi.fn().mockResolvedValue('/output/translated.srt'),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    mockDb = createMockDb();
  });

  describe('addToQueue', () => {
    it('should insert item into database', () => {
      // Make the get call (for getQueueItem) return the inserted item
      const insertedItem = {
        id: 1, type: 'movie', item_id: 'movie-1', item_name: 'Test Movie',
        subtitle_file: '/path/to/sub.srt', subtitle_stream_id: null,
        target_language: 'es', status: 'pending', progress: 0,
      };
      mockDb._get.mockReturnValue(insertedItem);

      const queueManager = new QueueManager(mockDb, mockTranslator, mockLogger);
      const result = queueManager.addToQueue({
        type: 'movie',
        item_id: 'movie-1',
        item_name: 'Test Movie',
        subtitle_file: '/path/to/sub.srt',
        target_language: 'es',
      });

      expect(result).toEqual(insertedItem);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO queue'));
      expect(mockDb._run).toHaveBeenCalledWith(
        'movie', 'movie-1', 'Test Movie', '/path/to/sub.srt', null, 'es'
      );
    });

    it('should handle subtitle_stream_id', () => {
      mockDb._get.mockReturnValue({ id: 1, subtitle_stream_id: 3 });

      const queueManager = new QueueManager(mockDb, mockTranslator, mockLogger);
      queueManager.addToQueue({
        type: 'episode',
        item_id: 'ep-1',
        item_name: 'Test Episode',
        subtitle_file: '/path/to/video.mkv',
        subtitle_stream_id: 3,
        target_language: 'fr',
      });

      expect(mockDb._run).toHaveBeenCalledWith(
        'episode', 'ep-1', 'Test Episode', '/path/to/video.mkv', 3, 'fr'
      );
    });

    it('should set subtitle_stream_id to null when not provided', () => {
      mockDb._get.mockReturnValue({ id: 1, subtitle_stream_id: null });

      const queueManager = new QueueManager(mockDb, mockTranslator, mockLogger);
      queueManager.addToQueue({
        type: 'movie',
        item_id: 'movie-2',
        item_name: 'No Stream Movie',
        subtitle_file: '/path/to/sub.srt',
        target_language: 'de',
      });

      expect(mockDb._run).toHaveBeenCalledWith(
        'movie', 'movie-2', 'No Stream Movie', '/path/to/sub.srt', null, 'de'
      );
    });

    it('should log when adding to queue', () => {
      mockDb._get.mockReturnValue({ id: 1 });

      const queueManager = new QueueManager(mockDb, mockTranslator, mockLogger);
      queueManager.addToQueue({
        type: 'movie',
        item_id: 'movie-3',
        item_name: 'Log Movie',
        subtitle_file: '/path/to/sub.srt',
        target_language: 'it',
      });

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Log Movie'));
    });

    it('should return the inserted QueueItem', () => {
      const item = {
        id: 42, type: 'movie', item_id: '1', item_name: 'M',
        subtitle_file: '/s.srt', target_language: 'es', status: 'pending', progress: 0,
      };
      mockDb._run.mockReturnValue({ lastInsertRowid: 42 });
      mockDb._get.mockReturnValue(item);

      const queueManager = new QueueManager(mockDb, mockTranslator, mockLogger);
      const result = queueManager.addToQueue({
        type: 'movie', item_id: '1', item_name: 'M',
        subtitle_file: '/s.srt', target_language: 'es',
      });

      expect(result.id).toBe(42);
    });
  });

  describe('getQueue', () => {
    it('should return items sorted by status then date', () => {
      const mockItems = [
        { id: 1, status: 'active' },
        { id: 2, status: 'pending' },
        { id: 3, status: 'completed' },
      ];
      mockDb._all.mockReturnValue(mockItems);

      const queueManager = new QueueManager(mockDb, mockTranslator, mockLogger);
      const result = queueManager.getQueue();

      expect(result).toEqual(mockItems);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('ORDER BY'));
    });

    it('should return empty array when queue is empty', () => {
      mockDb._all.mockReturnValue([]);

      const queueManager = new QueueManager(mockDb, mockTranslator, mockLogger);
      expect(queueManager.getQueue()).toEqual([]);
    });
  });

  describe('removeFromQueue', () => {
    it('should remove a pending item', () => {
      mockDb._get.mockReturnValue({ id: 1, item_name: 'Pending', status: 'pending' });

      const queueManager = new QueueManager(mockDb, mockTranslator, mockLogger);
      queueManager.removeFromQueue(1);

      expect(mockDb.prepare).toHaveBeenCalledWith('DELETE FROM queue WHERE id = ?');
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Pending'));
    });

    it('should remove a completed item', () => {
      mockDb._get.mockReturnValue({ id: 1, item_name: 'Done', status: 'completed' });

      const queueManager = new QueueManager(mockDb, mockTranslator, mockLogger);
      queueManager.removeFromQueue(1);

      expect(mockDb.prepare).toHaveBeenCalledWith('DELETE FROM queue WHERE id = ?');
    });

    it('should remove a failed item', () => {
      mockDb._get.mockReturnValue({ id: 1, item_name: 'Failed', status: 'failed' });

      const queueManager = new QueueManager(mockDb, mockTranslator, mockLogger);
      queueManager.removeFromQueue(1);

      expect(mockDb.prepare).toHaveBeenCalledWith('DELETE FROM queue WHERE id = ?');
    });

    it('should throw when item not found', () => {
      mockDb._get.mockReturnValue(undefined);

      const queueManager = new QueueManager(mockDb, mockTranslator, mockLogger);
      expect(() => queueManager.removeFromQueue(999)).toThrow('Item not found');
    });

    it('should cancel active item instead of deleting', () => {
      mockDb._get.mockReturnValue({ id: 1, item_name: 'Active', status: 'active' });

      const queueManager = new QueueManager(mockDb, mockTranslator, mockLogger);
      queueManager.removeFromQueue(1);

      // Should update status to failed, not delete
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("status = 'failed'"));
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('Cancelled by user'));
    });
  });

  describe('cancelActive', () => {
    it('should mark active item as failed with cancellation message', () => {
      const queueManager = new QueueManager(mockDb, mockTranslator, mockLogger);
      queueManager.cancelActive(1);

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("status = 'failed'"));
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('Cancelled by user'));
      expect(mockDb._run).toHaveBeenCalledWith(1);
    });

    it('should log cancellation', () => {
      const queueManager = new QueueManager(mockDb, mockTranslator, mockLogger);
      queueManager.cancelActive(1);

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('1'));
    });
  });

  describe('clearQueue', () => {
    it('should remove non-active items', () => {
      const queueManager = new QueueManager(mockDb, mockTranslator, mockLogger);
      queueManager.clearQueue();

      expect(mockDb.prepare).toHaveBeenCalledWith("DELETE FROM queue WHERE status != 'active'");
    });

    it('should log the clear operation', () => {
      const queueManager = new QueueManager(mockDb, mockTranslator, mockLogger);
      queueManager.clearQueue();

      expect(mockLogger.info).toHaveBeenCalledWith('Queue cleared');
    });
  });

  describe('recover', () => {
    function createRecoverDb(staleItems: any[]) {
      const runFn = vi.fn();
      return {
        db: {
          prepare: vi.fn((sql: string) => {
            if (sql.includes("SELECT * FROM queue WHERE status = 'active'")) {
              return { all: vi.fn().mockReturnValue(staleItems) };
            }
            if (sql.includes("UPDATE queue SET status = 'failed'")) {
              return { run: runFn };
            }
            if (sql.includes('SELECT COUNT(*)')) {
              return { get: vi.fn().mockReturnValue({ count: 0 }) };
            }
            if (sql.includes("SELECT * FROM queue WHERE status = 'pending'")) {
              return { get: vi.fn().mockReturnValue(undefined) };
            }
            return { run: vi.fn(), get: vi.fn(), all: vi.fn().mockReturnValue([]) };
          }),
        } as any,
        runFn,
      };
    }

    it('should mark stale active items as failed', () => {
      const { db } = createRecoverDb([
        { id: 1, status: 'active' },
        { id: 2, status: 'active' },
      ]);

      const queueManager = new QueueManager(db, mockTranslator, mockLogger);
      queueManager.recover();

      expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("status = 'failed'"));
      expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('Server restarted during translation'));
    });

    it('should log warning for recovered items', () => {
      const { db } = createRecoverDb([{ id: 1, status: 'active' }]);

      const queueManager = new QueueManager(db, mockTranslator, mockLogger);
      queueManager.recover();

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('1'));
    });

    it('should do nothing when no stale items exist', () => {
      const { db } = createRecoverDb([]);

      const queueManager = new QueueManager(db, mockTranslator, mockLogger);
      queueManager.recover();

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('processNext (integration)', () => {
    it('should process a pending item via translator', async () => {
      // Set up mock db to simulate the flow:
      // 1. addToQueue: INSERT + SELECT (getQueueItem)
      // 2. processNext: SELECT active count, SELECT pending, UPDATE to active, translate, UPDATE to completed
      // 3. Check pending count for continuation

      let callCount = 0;
      const pendingItem = {
        id: 1, type: 'movie', item_id: '1', item_name: 'Test Movie',
        subtitle_file: '/path.srt', subtitle_stream_id: null,
        target_language: 'es', status: 'pending', progress: 0,
      };

      const runFn = vi.fn().mockReturnValue({ lastInsertRowid: 1 });
      const getFn = vi.fn();
      const allFn = vi.fn().mockReturnValue([]);

      const db: any = {
        prepare: vi.fn((sql: string) => {
          if (sql.includes('INSERT INTO queue')) {
            return { run: runFn };
          }
          if (sql.includes('SELECT * FROM queue WHERE id = ?')) {
            return { get: getFn.mockReturnValue(pendingItem) };
          }
          if (sql.includes("SELECT COUNT(*) as count FROM queue WHERE status = 'active'")) {
            return { get: vi.fn().mockReturnValue({ count: 0 }) };
          }
          if (sql.includes("SELECT * FROM queue WHERE status = 'pending'")) {
            // Return pending item first time, undefined after
            callCount++;
            return { get: vi.fn().mockReturnValue(callCount <= 1 ? pendingItem : undefined) };
          }
          if (sql.includes("SELECT COUNT(*) as count FROM queue WHERE status = 'pending'")) {
            return { get: vi.fn().mockReturnValue({ count: 0 }) };
          }
          return { run: vi.fn(), get: vi.fn(), all: allFn };
        }),
      };

      const queueManager = new QueueManager(db, mockTranslator, mockLogger);
      queueManager.addToQueue({
        type: 'movie', item_id: '1', item_name: 'Test Movie',
        subtitle_file: '/path.srt', target_language: 'es',
      });

      // Wait for microtask processing
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockTranslator.translate).toHaveBeenCalledWith(
        expect.objectContaining({
          subtitlePath: '/path.srt',
          targetLanguage: 'es',
          context: 'Test Movie',
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should handle translator errors gracefully', async () => {
      (mockTranslator.translate as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Translation failed')
      );

      let callCount = 0;
      const pendingItem = {
        id: 1, type: 'movie', item_id: '1', item_name: 'Fail Movie',
        subtitle_file: '/a.srt', subtitle_stream_id: undefined,
        target_language: 'es', status: 'pending', progress: 0,
      };

      const db: any = {
        prepare: vi.fn((sql: string) => {
          if (sql.includes('INSERT INTO queue')) {
            return { run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }) };
          }
          if (sql.includes('SELECT * FROM queue WHERE id = ?')) {
            return { get: vi.fn().mockReturnValue(pendingItem) };
          }
          if (sql.includes("SELECT COUNT(*) as count FROM queue WHERE status = 'active'")) {
            return { get: vi.fn().mockReturnValue({ count: 0 }) };
          }
          if (sql.includes("SELECT * FROM queue WHERE status = 'pending'")) {
            callCount++;
            return { get: vi.fn().mockReturnValue(callCount <= 1 ? pendingItem : undefined) };
          }
          if (sql.includes("SELECT COUNT(*) as count FROM queue WHERE status = 'pending'")) {
            return { get: vi.fn().mockReturnValue({ count: 0 }) };
          }
          return { run: vi.fn(), get: vi.fn(), all: vi.fn().mockReturnValue([]) };
        }),
      };

      const queueManager = new QueueManager(db, mockTranslator, mockLogger);
      queueManager.addToQueue({
        type: 'movie', item_id: '1', item_name: 'Fail Movie',
        subtitle_file: '/a.srt', target_language: 'es',
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Fail Movie'));
      // Should update to 'failed' with error
      expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("status = 'failed', error = ?"));
    });

    it('should skip processing if already processing', async () => {
      // If there's already an active item, processNext should exit early
      const db: any = {
        prepare: vi.fn((sql: string) => {
          if (sql.includes('INSERT INTO queue')) {
            return { run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }) };
          }
          if (sql.includes('SELECT * FROM queue WHERE id = ?')) {
            return { get: vi.fn().mockReturnValue({ id: 1 }) };
          }
          if (sql.includes("SELECT COUNT(*) as count FROM queue WHERE status = 'active'")) {
            return { get: vi.fn().mockReturnValue({ count: 1 }) };
          }
          if (sql.includes("SELECT COUNT(*) as count FROM queue WHERE status = 'pending'")) {
            return { get: vi.fn().mockReturnValue({ count: 0 }) };
          }
          return { run: vi.fn(), get: vi.fn(), all: vi.fn().mockReturnValue([]) };
        }),
      };

      const queueManager = new QueueManager(db, mockTranslator, mockLogger);
      queueManager.addToQueue({
        type: 'movie', item_id: '1', item_name: 'Should Skip',
        subtitle_file: '/a.srt', target_language: 'es',
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should not call translate because active count > 0
      expect(mockTranslator.translate).not.toHaveBeenCalled();
    });

    it('should pass streamId to translator', async () => {
      let callCount = 0;
      const pendingItem = {
        id: 1, type: 'movie', item_id: '1', item_name: 'Stream Movie',
        subtitle_file: '/a.mkv', subtitle_stream_id: 5,
        target_language: 'ja', status: 'pending', progress: 0,
      };

      const db: any = {
        prepare: vi.fn((sql: string) => {
          if (sql.includes('INSERT INTO queue')) {
            return { run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }) };
          }
          if (sql.includes('SELECT * FROM queue WHERE id = ?')) {
            return { get: vi.fn().mockReturnValue(pendingItem) };
          }
          if (sql.includes("SELECT COUNT(*) as count FROM queue WHERE status = 'active'")) {
            return { get: vi.fn().mockReturnValue({ count: 0 }) };
          }
          if (sql.includes("SELECT * FROM queue WHERE status = 'pending'")) {
            callCount++;
            return { get: vi.fn().mockReturnValue(callCount <= 1 ? pendingItem : undefined) };
          }
          if (sql.includes("SELECT COUNT(*) as count FROM queue WHERE status = 'pending'")) {
            return { get: vi.fn().mockReturnValue({ count: 0 }) };
          }
          return { run: vi.fn(), get: vi.fn(), all: vi.fn().mockReturnValue([]) };
        }),
      };

      const queueManager = new QueueManager(db, mockTranslator, mockLogger);
      queueManager.addToQueue({
        type: 'movie', item_id: '1', item_name: 'Stream Movie',
        subtitle_file: '/a.mkv', subtitle_stream_id: 5, target_language: 'ja',
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockTranslator.translate).toHaveBeenCalledWith(
        expect.objectContaining({ streamId: 5 })
      );
    });
  });
});
