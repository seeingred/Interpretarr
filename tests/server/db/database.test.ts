import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import these after mocks are set up
let initializeDatabase: any;
let getDb: any;

// Mock dependencies
vi.mock('better-sqlite3');
vi.mock('fs');
vi.mock('path', () => ({
  default: {
    dirname: vi.fn(),
    join: vi.fn(),
  },
  dirname: vi.fn(),
  join: vi.fn(),
}));
vi.mock('url', () => ({
  fileURLToPath: vi.fn(),
}));

describe('Database', () => {
  let mockDb: any;
  let mockExec: Mock;
  let mockPrepare: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import the database module after mocks are set up
    const dbModule = await import('../../../src/server/db/database');
    initializeDatabase = dbModule.initializeDatabase;
    getDb = dbModule.getDb;

    // Reset module state
    (global as any).db = undefined;

    // Mock path functions with realistic behavior
    (path.dirname as Mock).mockImplementation((p: string) => {
      const lastSlash = p.lastIndexOf('/');
      return lastSlash > 0 ? p.substring(0, lastSlash) : '/';
    });
    (path.join as Mock).mockImplementation((...args: string[]) => {
      return args.filter(Boolean).join('/');
    });
    (fileURLToPath as Mock).mockReturnValue('/mocked/file/path.js');

    // Mock fs
    (fs.existsSync as Mock).mockReturnValue(true);
    (fs.mkdirSync as Mock).mockReturnValue(undefined);

    // Mock database instance
    mockExec = vi.fn();
    mockPrepare = vi.fn();
    mockDb = {
      exec: mockExec,
      prepare: mockPrepare,
    };

    (Database as unknown as Mock).mockReturnValue(mockDb);
  });

  afterEach(() => {
    // Clean up module state
    (global as any).db = undefined;
  });

  describe('initializeDatabase', () => {
    it('should create database and tables', () => {
      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          { name: 'id' },
          { name: 'subtitle_stream_id' },
        ]),
      });

      const result = initializeDatabase();

      expect(result).toBe(mockDb);
      expect(Database).toHaveBeenCalledWith('/mocked/path//mocked/path//mocked/path/data/interpretarr.db');
      expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS queue'));
      expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS settings'));
    });

    it('should create data directory if it does not exist', () => {
      (fs.existsSync as Mock).mockReturnValue(false);
      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([]),
      });

      initializeDatabase();

      expect(fs.mkdirSync).toHaveBeenCalledWith('/mocked/path', { recursive: true });
    });

    it('should not create data directory if it exists', () => {
      (fs.existsSync as Mock).mockReturnValue(true);
      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([]),
      });

      initializeDatabase();

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should run migration for subtitle_stream_id column if missing', () => {
      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          { name: 'id' },
          { name: 'type' },
          { name: 'item_id' },
        ]),
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      initializeDatabase();

      expect(mockPrepare).toHaveBeenCalledWith('PRAGMA table_info(queue)');
      expect(mockExec).toHaveBeenCalledWith('ALTER TABLE queue ADD COLUMN subtitle_stream_id INTEGER');
      expect(consoleSpy).toHaveBeenCalledWith('Added subtitle_stream_id column to existing queue table');

      consoleSpy.mockRestore();
    });

    it('should not run migration if subtitle_stream_id column exists', () => {
      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          { name: 'id' },
          { name: 'subtitle_stream_id' },
          { name: 'type' },
        ]),
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      initializeDatabase();

      expect(mockPrepare).toHaveBeenCalledWith('PRAGMA table_info(queue)');
      // Should only call exec once for table creation, not for migration
      expect(mockExec).toHaveBeenCalledTimes(1);
      expect(mockExec).not.toHaveBeenCalledWith('ALTER TABLE queue ADD COLUMN subtitle_stream_id INTEGER');
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle migration error gracefully', () => {
      mockPrepare.mockImplementation(() => {
        throw new Error('Table does not exist');
      });

      // Should not throw
      expect(() => initializeDatabase()).not.toThrow();
    });

    it('should create queue table with correct schema', () => {
      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([]),
      });

      initializeDatabase();

      const createTableCall = mockExec.mock.calls[0][0];
      expect(createTableCall).toContain('id INTEGER PRIMARY KEY AUTOINCREMENT');
      expect(createTableCall).toContain('type TEXT NOT NULL');
      expect(createTableCall).toContain('item_id TEXT NOT NULL');
      expect(createTableCall).toContain('item_name TEXT NOT NULL');
      expect(createTableCall).toContain('subtitle_file TEXT NOT NULL');
      expect(createTableCall).toContain('subtitle_stream_id INTEGER');
      expect(createTableCall).toContain('target_language TEXT NOT NULL');
      expect(createTableCall).toContain("status TEXT DEFAULT 'pending'");
      expect(createTableCall).toContain('progress INTEGER DEFAULT 0');
      expect(createTableCall).toContain('error TEXT');
      expect(createTableCall).toContain('created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
      expect(createTableCall).toContain('updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
    });

    it('should create settings table with correct schema', () => {
      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([]),
      });

      initializeDatabase();

      const createTableCall = mockExec.mock.calls[0][0];
      expect(createTableCall).toContain('CREATE TABLE IF NOT EXISTS settings');
      expect(createTableCall).toContain('key TEXT PRIMARY KEY');
      expect(createTableCall).toContain('value TEXT NOT NULL');
    });

    it('should handle database initialization error', () => {
      (Database as unknown as Mock).mockImplementation(() => {
        throw new Error('Cannot open database');
      });

      expect(() => initializeDatabase()).toThrow('Cannot open database');
    });

    it('should handle directory creation error', () => {
      (fs.existsSync as Mock).mockReturnValue(false);
      (fs.mkdirSync as Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => initializeDatabase()).toThrow('Permission denied');
    });
  });

  describe('getDb', () => {
    it('should return database instance when initialized', () => {
      // Initialize database first
      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([]),
      });
      initializeDatabase();

      const result = getDb();

      expect(result).toBe(mockDb);
    });

    it('should throw error when database not initialized', () => {
      expect(() => getDb()).toThrow('Database not initialized');
    });

    it('should return same instance on multiple calls', () => {
      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([]),
      });
      initializeDatabase();

      const result1 = getDb();
      const result2 = getDb();

      expect(result1).toBe(result2);
      expect(result1).toBe(mockDb);
    });

    it('should work after re-initialization', () => {
      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([]),
      });

      // First initialization
      initializeDatabase();
      const result1 = getDb();
      expect(result1).toBe(mockDb);

      // Create new mock for second initialization
      const mockDb2 = {
        exec: vi.fn(),
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([]),
        }),
      };
      (Database as unknown as Mock).mockReturnValue(mockDb2);

      // Re-initialize
      initializeDatabase();
      const result2 = getDb();
      expect(result2).toBe(mockDb2);
      expect(result2).not.toBe(result1);
    });
  });

  describe('Database paths', () => {
    it('should construct correct database path', () => {
      (path.dirname as Mock).mockReturnValueOnce('/mocked/dir1')
        .mockReturnValueOnce('/mocked/dir2');
      (path.join as Mock).mockReturnValue('/final/path/data/interpretarr.db');
      (fileURLToPath as Mock).mockReturnValue('/source/file.js');

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([]),
      });

      initializeDatabase();

      expect(fileURLToPath).toHaveBeenCalledWith(expect.anything());
      expect(path.dirname).toHaveBeenCalled();
      expect(path.join).toHaveBeenCalledWith('/mocked/dir1', '../../../data/interpretarr.db');
      expect(Database).toHaveBeenCalledWith('/final/path/data/interpretarr.db');
    });
  });

  describe('Migration scenarios', () => {
    it('should handle empty column list', () => {
      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([]),
      });

      initializeDatabase();

      expect(mockExec).toHaveBeenCalledWith('ALTER TABLE queue ADD COLUMN subtitle_stream_id INTEGER');
    });

    it('should handle mixed case column names', () => {
      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          { name: 'ID' },
          { name: 'SUBTITLE_STREAM_ID' },
        ]),
      });

      initializeDatabase();

      // Should not add column if it exists in any case
      expect(mockExec).not.toHaveBeenCalledWith('ALTER TABLE queue ADD COLUMN subtitle_stream_id INTEGER');
    });

    it('should check for exact column name match', () => {
      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          { name: 'id' },
          { name: 'subtitle_stream' }, // Similar but not exact
          { name: 'stream_id' }, // Similar but not exact
        ]),
      });

      initializeDatabase();

      expect(mockExec).toHaveBeenCalledWith('ALTER TABLE queue ADD COLUMN subtitle_stream_id INTEGER');
    });
  });
});