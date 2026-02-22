import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { SettingsService, Settings } from '../../../src/server/services/settings';

// Mock the database module and logger
vi.mock('../../../src/server/db/database');
vi.mock('../../../src/server/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('SettingsService', () => {
  let mockDb: any;
  let settingsService: SettingsService;

  beforeEach(async () => {
    vi.clearAllMocks();

    // In-memory store for settings
    const store: Record<string, string> = {};

    mockDb = {
      prepare: vi.fn((sql: string) => {
        if (sql.includes('SELECT value FROM settings WHERE key = ?')) {
          return {
            get: vi.fn((key: string) => {
              return key in store ? { value: store[key] } : undefined;
            }),
          };
        }
        if (sql.includes('INSERT INTO settings')) {
          return {
            run: vi.fn((key: string, value: string) => {
              store[key] = value;
            }),
          };
        }
        return { run: vi.fn(), get: vi.fn(), all: vi.fn(() => []) };
      }),
    };

    const dbModule = await import('../../../src/server/db/database');
    (dbModule.getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);

    // Reset singleton
    (SettingsService as any).instance = undefined;
    settingsService = SettingsService.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SettingsService.getInstance();
      const instance2 = SettingsService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getSetting', () => {
    it('should return the value when setting exists', () => {
      // First set a value
      settingsService.setSetting('geminiApiKey', 'test-key');

      const result = settingsService.getSetting('geminiApiKey');
      expect(result).toBe('test-key');
    });

    it('should return undefined when setting does not exist', () => {
      const result = settingsService.getSetting('nonExistent');
      expect(result).toBeUndefined();
    });

    it('should return empty string when value is empty', () => {
      settingsService.setSetting('emptyKey', '');

      const result = settingsService.getSetting('emptyKey');
      expect(result).toBe('');
    });
  });

  describe('setSetting', () => {
    it('should insert a new setting', () => {
      settingsService.setSetting('geminiApiKey', 'my-key');

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO settings'));
    });

    it('should log the update', async () => {
      const loggerModule = await import('../../../src/server/utils/logger');
      settingsService.setSetting('geminiApiKey', 'my-key');

      expect(loggerModule.logger.info).toHaveBeenCalledWith('Setting updated: geminiApiKey');
    });
  });

  describe('getAllSettings', () => {
    it('should return all settings', () => {
      settingsService.setSetting('geminiApiKey', 'key-123');
      settingsService.setSetting('geminiModel', 'gemini-2.0-flash');
      settingsService.setSetting('batchSize', '100');
      settingsService.setSetting('sonarrApiKey', 'sonarr-key');
      settingsService.setSetting('sonarrUrl', 'http://sonarr:8989');
      settingsService.setSetting('radarrApiKey', 'radarr-key');
      settingsService.setSetting('radarrUrl', 'http://radarr:7878');

      const result = settingsService.getAllSettings();

      expect(result).toEqual({
        geminiApiKey: 'key-123',
        geminiModel: 'gemini-2.0-flash',
        batchSize: '100',
        sonarrApiKey: 'sonarr-key',
        sonarrUrl: 'http://sonarr:8989',
        radarrApiKey: 'radarr-key',
        radarrUrl: 'http://radarr:7878',
      });
    });

    it('should return undefined for missing settings', () => {
      const result = settingsService.getAllSettings();

      expect(result).toEqual({
        geminiApiKey: undefined,
        geminiModel: undefined,
        batchSize: undefined,
        sonarrApiKey: undefined,
        sonarrUrl: undefined,
        radarrApiKey: undefined,
        radarrUrl: undefined,
      });
    });
  });

  describe('updateSettings', () => {
    it('should update only provided settings', () => {
      settingsService.updateSettings({
        geminiApiKey: 'new-key',
        sonarrUrl: 'http://sonarr:8989',
      });

      expect(settingsService.getSetting('geminiApiKey')).toBe('new-key');
      expect(settingsService.getSetting('sonarrUrl')).toBe('http://sonarr:8989');
      expect(settingsService.getSetting('radarrApiKey')).toBeUndefined();
    });

    it('should handle empty update object', () => {
      settingsService.setSetting('geminiApiKey', 'unchanged');
      settingsService.updateSettings({});

      expect(settingsService.getSetting('geminiApiKey')).toBe('unchanged');
    });

    it('should skip undefined values', () => {
      settingsService.setSetting('geminiApiKey', 'keep');
      settingsService.updateSettings({
        geminiApiKey: undefined,
        sonarrApiKey: 'new-sonarr',
      });

      expect(settingsService.getSetting('geminiApiKey')).toBe('keep');
      expect(settingsService.getSetting('sonarrApiKey')).toBe('new-sonarr');
    });
  });

  describe('isConfigured', () => {
    it('should return true with geminiApiKey and sonarrApiKey', () => {
      settingsService.setSetting('geminiApiKey', 'key');
      settingsService.setSetting('sonarrApiKey', 'sonarr-key');

      expect(settingsService.isConfigured()).toBe(true);
    });

    it('should return true with geminiApiKey and radarrApiKey', () => {
      settingsService.setSetting('geminiApiKey', 'key');
      settingsService.setSetting('radarrApiKey', 'radarr-key');

      expect(settingsService.isConfigured()).toBe(true);
    });

    it('should return true with geminiApiKey and both ARR keys', () => {
      settingsService.setSetting('geminiApiKey', 'key');
      settingsService.setSetting('sonarrApiKey', 'sonarr-key');
      settingsService.setSetting('radarrApiKey', 'radarr-key');

      expect(settingsService.isConfigured()).toBe(true);
    });

    it('should return false when geminiApiKey is missing', () => {
      settingsService.setSetting('sonarrApiKey', 'sonarr-key');

      expect(settingsService.isConfigured()).toBe(false);
    });

    it('should return false when no ARR keys are set', () => {
      settingsService.setSetting('geminiApiKey', 'key');

      expect(settingsService.isConfigured()).toBe(false);
    });

    it('should return false when all settings are missing', () => {
      expect(settingsService.isConfigured()).toBe(false);
    });
  });
});
