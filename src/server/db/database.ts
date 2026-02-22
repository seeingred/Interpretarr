import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../../data/interpretarr.db');

let db: Database.Database;

export function initializeDatabase() {
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      subtitle_file TEXT NOT NULL,
      subtitle_stream_id INTEGER,
      target_language TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_queue_status ON queue(status);
    CREATE INDEX IF NOT EXISTS idx_queue_status_created ON queue(status, created_at);
  `);

  // Add migration for existing databases
  try {
    const columns = db.prepare("PRAGMA table_info(queue)").all() as any[];
    const hasStreamId = columns.some((col: any) => col.name === 'subtitle_stream_id');
    if (!hasStreamId) {
      db.exec("ALTER TABLE queue ADD COLUMN subtitle_stream_id INTEGER");
      console.log('Added subtitle_stream_id column to existing queue table');
    }
  } catch (error) {
    // Table might not exist yet, which is fine
  }

  return db;
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}