import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Mock dependencies
vi.mock('better-sqlite3');
vi.mock('fs');
vi.mock('path', () => ({
  default: {
    dirname: vi.fn().mockReturnValue('/mocked/dir'),
    join: vi.fn().mockReturnValue('/mocked/data/interpretarr.db'),
  },
  dirname: vi.fn().mockReturnValue('/mocked/dir'),
  join: vi.fn().mockReturnValue('/mocked/data/interpretarr.db'),
}));
vi.mock('url', () => ({
  fileURLToPath: vi.fn().mockReturnValue('/mocked/file/path.js'),
}));

describe('Database', () => {
  let mockDb: any;
  let mockExec: Mock;
  let mockPrepare: Mock;
  let initializeDatabase: any;
  let getDb: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Re-apply mock return values after clearAllMocks
    (path.dirname as Mock).mockReturnValue('/mocked/dir');
    (path.join as Mock).mockReturnValue('/mocked/data/interpretarr.db');
    (fileURLToPath as Mock).mockReturnValue('/mocked/file/path.js');
    (fs.existsSync as Mock).mockReturnValue(true);
    (fs.mkdirSync as Mock).mockReturnValue(undefined);

    mockExec = vi.fn();
    mockPrepare = vi.fn();
    mockDb = {
      exec: mockExec,
      prepare: mockPrepare,
    };

    (Database as unknown as Mock).mockReturnValue(mockDb);

    // Reset module cache and re-import
    vi.resetModules();
    const dbModule = await import('../../../src/server/db/database');
    initializeDatabase = dbModule.initializeDatabase;
    getDb = dbModule.getDb;
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
      expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS queue'));
      expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS settings'));
    });

    it('should create data directory if it does not exist', () => {
      (fs.existsSync as Mock).mockReturnValue(false);
      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([{ name: 'subtitle_stream_id' }]),
      });

      initializeDatabase();

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });

    it('should not create data directory if it exists', () => {
      (fs.existsSync as Mock).mockReturnValue(true);
      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([{ name: 'subtitle_stream_id' }]),
      });

      initializeDatabase();

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should create queue table with correct schema', () => {
      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([{ name: 'subtitle_stream_id' }]),
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
        all: vi.fn().mockReturnValue([{ name: 'subtitle_stream_id' }]),
      });

      initializeDatabase();

      const createTableCall = mockExec.mock.calls[0][0];
      expect(createTableCall).toContain('CREATE TABLE IF NOT EXISTS settings');
      expect(createTableCall).toContain('key TEXT PRIMARY KEY');
      expect(createTableCall).toContain('value TEXT NOT NULL');
    });

    it('should create indexes', () => {
      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([{ name: 'subtitle_stream_id' }]),
      });

      initializeDatabase();

      const createTableCall = mockExec.mock.calls[0][0];
      expect(createTableCall).toContain('CREATE INDEX IF NOT EXISTS idx_queue_status');
      expect(createTableCall).toContain('CREATE INDEX IF NOT EXISTS idx_queue_status_created');
    });

    it('should run migration for subtitle_stream_id if missing', () => {
      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          { name: 'id' },
          { name: 'type' },
        ]),
      });

      initializeDatabase();

      expect(mockPrepare).toHaveBeenCalledWith('PRAGMA table_info(queue)');
      expect(mockExec).toHaveBeenCalledWith('ALTER TABLE queue ADD COLUMN subtitle_stream_id INTEGER');
    });

    it('should skip migration if subtitle_stream_id exists', () => {
      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          { name: 'id' },
          { name: 'subtitle_stream_id' },
        ]),
      });

      initializeDatabase();

      expect(mockExec).toHaveBeenCalledTimes(1); // Only table creation
      expect(mockExec).not.toHaveBeenCalledWith('ALTER TABLE queue ADD COLUMN subtitle_stream_id INTEGER');
    });

    it('should handle migration error gracefully', () => {
      mockPrepare.mockImplementation(() => {
        throw new Error('Table does not exist');
      });

      expect(() => initializeDatabase()).not.toThrow();
    });
  });

  describe('getDb', () => {
    it('should return database instance when initialized', () => {
      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([{ name: 'subtitle_stream_id' }]),
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
        all: vi.fn().mockReturnValue([{ name: 'subtitle_stream_id' }]),
      });
      initializeDatabase();

      expect(getDb()).toBe(getDb());
    });
  });
});
