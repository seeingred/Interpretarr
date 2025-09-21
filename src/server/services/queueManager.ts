import { getDb } from '../db/database.js';
import { logger } from '../utils/logger.js';
import { AiSubTranslatorService } from './aiSubTranslator.js';

export interface QueueItem {
  id?: number;
  type: 'movie' | 'episode';
  item_id: string;
  item_name: string;
  subtitle_file: string;
  subtitle_stream_id?: number;  // For embedded subtitles
  target_language: string;
  status?: 'pending' | 'active' | 'completed' | 'failed';
  progress?: number;
  error?: string;
  created_at?: string;
  updated_at?: string;
}

export class QueueManager {
  private static instance: QueueManager;
  private isProcessing = false;
  private currentItem: QueueItem | null = null;
  private isCancelled = false;
  private processInterval: NodeJS.Timeout | null = null;

  static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  constructor() {
    this.processInterval = setInterval(() => this.processQueue(), 5000);
  }

  async addToQueue(item: Omit<QueueItem, 'id'>): Promise<number> {
    const db = getDb();

    logger.info({
      item_name: item.item_name,
      subtitle_file: item.subtitle_file,
      subtitle_stream_id: item.subtitle_stream_id,
      target_language: item.target_language
    }, 'Adding item to queue with details');

    const result = db.prepare(`
      INSERT INTO queue (type, item_id, item_name, subtitle_file, subtitle_stream_id, target_language, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      item.type,
      item.item_id,
      item.item_name,
      item.subtitle_file,
      item.subtitle_stream_id || null,
      item.target_language
    );

    logger.info(`Added to queue: ${item.item_name} - ${item.target_language} (stream_id: ${item.subtitle_stream_id || 'none'})`)

    // The interval will handle processing - don't trigger manually to avoid conflicts

    return result.lastInsertRowid as number;
  }

  getQueue(): QueueItem[] {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM queue
      ORDER BY
        CASE status
          WHEN 'active' THEN 1
          WHEN 'pending' THEN 2
          WHEN 'completed' THEN 3
          WHEN 'failed' THEN 4
        END,
        created_at ASC
    `).all() as QueueItem[];
  }

  async removeFromQueue(id: number, forceCancel: boolean = false): Promise<void> {
    const db = getDb();
    const item = db.prepare('SELECT * FROM queue WHERE id = ?').get(id) as QueueItem;

    if (item && item.status === 'active') {
      if (!forceCancel) {
        logger.warn(`Cannot remove active item without cancellation: ${item.item_name}`);
        throw new Error('Cannot remove active translation without cancellation');
      }

      // Cancel the active translation
      logger.info(`Cancelling active translation: ${item.item_name}`);
      const translator = AiSubTranslatorService.getInstance();
      try {
        this.isCancelled = true; // Set flag to prevent auto-restart
        await translator.cancelTranslation();
        this.isProcessing = false;
        this.currentItem = null;

        // Reset cancellation flag after a short delay
        setTimeout(() => {
          this.isCancelled = false;
        }, 1000);
      } catch (error) {
        logger.error(`Failed to cancel translation: ${error}`);
        this.isCancelled = false;
        throw new Error('Failed to cancel translation');
      }
    }

    db.prepare('DELETE FROM queue WHERE id = ?').run(id);
    logger.info(`Removed from queue: ${id}`);
  }

  clearQueue(): void {
    const db = getDb();
    db.prepare("DELETE FROM queue WHERE status != 'active'").run();
    logger.info('Queue cleared (except active items)');
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.isCancelled) return;

    // Check if ai-sub-translator has an active translation
    const translator = AiSubTranslatorService.getInstance();
    const hasActive = await translator.hasActiveTranslation();
    if (hasActive) {
      logger.debug('ai-sub-translator has an active translation, skipping queue processing');
      return;
    }

    const db = getDb();
    const nextItem = db.prepare(`
      SELECT * FROM queue
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
    `).get() as QueueItem | undefined;

    if (!nextItem) return;

    this.isProcessing = true;
    this.currentItem = nextItem;

    try {
      this.updateQueueItem(nextItem.id!, { status: 'active', progress: 0 });

      const translator = AiSubTranslatorService.getInstance();
      await translator.translateSubtitle(
        nextItem.subtitle_file,
        nextItem.target_language,
        (progress) => {
          // Only update progress if we're still processing this item
          if (this.currentItem?.id === nextItem.id && !this.isCancelled) {
            this.updateQueueItem(nextItem.id!, { progress: Math.round(progress) });
          }
        },
        nextItem.subtitle_stream_id
      );

      this.updateQueueItem(nextItem.id!, {
        status: 'completed',
        progress: 100
      });

      logger.info(`Translation completed: ${nextItem.item_name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateQueueItem(nextItem.id!, {
        status: 'failed',
        error: errorMessage
      });
      logger.error(`Translation failed: ${nextItem.item_name} - ${errorMessage}`);
    } finally {
      this.isProcessing = false;
      this.currentItem = null;
      // Only continue processing if not cancelled
      if (!this.isCancelled) {
        setTimeout(() => this.processQueue(), 1000);
      }
    }
  }

  private updateQueueItem(id: number, updates: Partial<QueueItem>): void {
    const db = getDb();
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);

    db.prepare(`
      UPDATE queue
      SET ${fields}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(...values, id);
  }

  getCurrentItem(): QueueItem | null {
    return this.currentItem;
  }
}