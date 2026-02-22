import Database from 'better-sqlite3';
import { TranslatorService } from './translatorService.js';

export interface QueueItem {
  id: number;
  type: 'movie' | 'episode';
  item_id: string;
  item_name: string;
  subtitle_file: string;
  subtitle_stream_id?: number;
  target_language: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  progress: number;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface QueueItemInput {
  type: 'movie' | 'episode';
  item_id: string;
  item_name: string;
  subtitle_file: string;
  subtitle_stream_id?: number;
  target_language: string;
}

export interface Logger {
  info(msg: string, ...args: any[]): void;
  error(msg: string, ...args: any[]): void;
  warn(msg: string, ...args: any[]): void;
}

export class QueueManager {
  private processing = false;
  private currentAbortController?: AbortController;

  constructor(
    private db: Database.Database,
    private translator: TranslatorService,
    private logger: Logger
  ) {}

  addToQueue(item: QueueItemInput): QueueItem {
    const stmt = this.db.prepare(`
      INSERT INTO queue (type, item_id, item_name, subtitle_file, subtitle_stream_id, target_language, status, progress)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', 0)
    `);
    const result = stmt.run(item.type, item.item_id, item.item_name, item.subtitle_file, item.subtitle_stream_id || null, item.target_language);
    this.logger.info(`Added to queue: ${item.item_name} -> ${item.target_language}`);
    this.triggerProcessNext();
    return this.getQueueItem(result.lastInsertRowid as number)!;
  }

  getQueue(): QueueItem[] {
    return this.db.prepare(`
      SELECT * FROM queue
      ORDER BY
        CASE status
          WHEN 'active' THEN 0
          WHEN 'pending' THEN 1
          WHEN 'completed' THEN 2
          WHEN 'failed' THEN 3
        END,
        created_at ASC
    `).all() as QueueItem[];
  }

  removeFromQueue(id: number): void {
    const item = this.getQueueItem(id);
    if (!item) throw new Error('Item not found');

    if (item.status === 'active') {
      this.cancelActive(id);
      return;
    }

    this.db.prepare('DELETE FROM queue WHERE id = ?').run(id);
    this.logger.info(`Removed from queue: ${item.item_name}`);
  }

  cancelActive(id: number): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    this.db.prepare(`
      UPDATE queue SET status = 'failed', error = 'Cancelled by user', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'active'
    `).run(id);
    this.logger.info(`Cancelled active item: ${id}`);
  }

  clearQueue(): void {
    this.db.prepare("DELETE FROM queue WHERE status != 'active'").run();
    this.logger.info('Queue cleared');
  }

  recover(): void {
    const stale = this.db.prepare("SELECT * FROM queue WHERE status = 'active'").all() as QueueItem[];
    if (stale.length > 0) {
      this.db.prepare(`
        UPDATE queue SET status = 'failed', error = 'Server restarted during translation', updated_at = CURRENT_TIMESTAMP
        WHERE status = 'active'
      `).run();
      this.logger.warn(`Recovered ${stale.length} stale active items`);
    }
    this.triggerProcessNext();
  }

  private triggerProcessNext(): void {
    queueMicrotask(() => this.processNext());
  }

  private async processNext(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      // Check for active items first
      const active = this.db.prepare("SELECT COUNT(*) as count FROM queue WHERE status = 'active'").get() as { count: number };
      if (active.count > 0) return;

      // Get next pending item
      const next = this.db.prepare("SELECT * FROM queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1").get() as QueueItem | undefined;
      if (!next) return;

      // Mark as active
      this.db.prepare("UPDATE queue SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(next.id);
      this.logger.info(`Processing: ${next.item_name} -> ${next.target_language}`);

      const abortController = new AbortController();
      this.currentAbortController = abortController;

      try {
        await this.translator.translate({
          subtitlePath: next.subtitle_file,
          targetLanguage: next.target_language,
          context: next.item_name,
          streamId: next.subtitle_stream_id,
          onProgress: (progress: number) => {
            if (!abortController.signal.aborted) {
              this.db.prepare("UPDATE queue SET progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                .run(Math.round(progress * 100), next.id);
            }
          },
          signal: abortController.signal,
        });

        if (!abortController.signal.aborted) {
          this.db.prepare("UPDATE queue SET status = 'completed', progress = 100, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(next.id);
          this.logger.info(`Completed: ${next.item_name}`);
        }
      } catch (err: any) {
        if (!abortController.signal.aborted) {
          this.db.prepare("UPDATE queue SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .run(err.message || 'Unknown error', next.id);
          this.logger.error(`Failed: ${next.item_name} - ${err.message}`);
        }
      } finally {
        this.currentAbortController = undefined;
      }
    } finally {
      this.processing = false;
      // Check if there are more pending items
      const pending = this.db.prepare("SELECT COUNT(*) as count FROM queue WHERE status = 'pending'").get() as { count: number };
      if (pending.count > 0) {
        this.triggerProcessNext();
      }
    }
  }

  private getQueueItem(id: number): QueueItem | undefined {
    return this.db.prepare('SELECT * FROM queue WHERE id = ?').get(id) as QueueItem | undefined;
  }
}
