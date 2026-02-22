import { getDb } from '../db/database.js';
import { logger } from '../utils/logger.js';

export interface Settings {
  geminiApiKey?: string;
  geminiModel?: string;
  batchSize?: string;
  sonarrApiKey?: string;
  sonarrUrl?: string;
  radarrApiKey?: string;
  radarrUrl?: string;
}

export class SettingsService {
  private static instance: SettingsService;

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  getSetting(key: string): string | undefined {
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
    return row?.value;
  }

  setSetting(key: string, value: string): void {
    const db = getDb();

    db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value
    `).run(key, value);

    logger.info(`Setting updated: ${key}`);
  }

  getAllSettings(): Settings {
    return {
      geminiApiKey: this.getSetting('geminiApiKey'),
      geminiModel: this.getSetting('geminiModel'),
      batchSize: this.getSetting('batchSize'),
      sonarrApiKey: this.getSetting('sonarrApiKey'),
      sonarrUrl: this.getSetting('sonarrUrl'),
      radarrApiKey: this.getSetting('radarrApiKey'),
      radarrUrl: this.getSetting('radarrUrl'),
    };
  }

  updateSettings(settings: Partial<Settings>): void {
    if (settings.geminiApiKey !== undefined) {
      this.setSetting('geminiApiKey', settings.geminiApiKey);
    }
    if (settings.geminiModel !== undefined) {
      this.setSetting('geminiModel', settings.geminiModel);
    }
    if (settings.batchSize !== undefined) {
      this.setSetting('batchSize', settings.batchSize);
    }
    if (settings.sonarrApiKey !== undefined) {
      this.setSetting('sonarrApiKey', settings.sonarrApiKey);
    }
    if (settings.sonarrUrl !== undefined) {
      this.setSetting('sonarrUrl', settings.sonarrUrl);
    }
    if (settings.radarrApiKey !== undefined) {
      this.setSetting('radarrApiKey', settings.radarrApiKey);
    }
    if (settings.radarrUrl !== undefined) {
      this.setSetting('radarrUrl', settings.radarrUrl);
    }
  }

  isConfigured(): boolean {
    const settings = this.getAllSettings();
    return !!(
      settings.geminiApiKey &&
      (settings.sonarrApiKey || settings.radarrApiKey)
    );
  }
}
