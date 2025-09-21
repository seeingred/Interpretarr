import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { SettingsService, Settings } from '../../../src/server/services/settings';
import * as database from '../../../src/server/db/database';
import * as logger from '../../../src/server/utils/logger';

// Mock dependencies
vi.mock('../../../src/server/db/database');
vi.mock('../../../src/server/utils/logger');

describe('SettingsService', () => {
  let mockDb: any;
  let settingsService: SettingsService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton instance
    (SettingsService as any).instance = undefined;

    // Mock database
    mockDb = {
      prepare: vi.fn(),
    };
    (database.getDb as Mock).mockReturnValue(mockDb);

    // Mock logger
    (logger.logger as any) = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    settingsService = SettingsService.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SettingsService.getInstance();
      const instance2 = SettingsService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance if none exists', () => {
      (SettingsService as any).instance = undefined;
      const instance = SettingsService.getInstance();
      expect(instance).toBeInstanceOf(SettingsService);
    });
  });

  describe('getSetting', () => {
    it('should return setting value when exists', () => {
      const mockGet = vi.fn().mockReturnValue({ value: 'http://localhost:9090' });
      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = settingsService.getSetting('aiSubTranslatorUrl');

      expect(result).toBe('http://localhost:9090');
      expect(mockDb.prepare).toHaveBeenCalledWith('SELECT value FROM settings WHERE key = ?');
      expect(mockGet).toHaveBeenCalledWith('aiSubTranslatorUrl');
    });

    it('should return undefined when setting does not exist', () => {
      const mockGet = vi.fn().mockReturnValue(undefined);
      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = settingsService.getSetting('nonExistentKey');

      expect(result).toBeUndefined();
      expect(mockGet).toHaveBeenCalledWith('nonExistentKey');
    });

    it('should handle null values', () => {
      const mockGet = vi.fn().mockReturnValue(null);
      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = settingsService.getSetting('nullKey');

      expect(result).toBeUndefined();
    });

    it('should handle empty string values', () => {
      const mockGet = vi.fn().mockReturnValue({ value: '' });
      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = settingsService.getSetting('emptyKey');

      expect(result).toBe('');
    });
  });

  describe('setSetting', () => {
    it('should insert or update setting value', () => {
      const mockRun = vi.fn();
      mockDb.prepare.mockReturnValue({ run: mockRun });

      settingsService.setSetting('apiKey', 'secret123');

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO settings'));
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT(key) DO UPDATE'));
      expect(mockRun).toHaveBeenCalledWith('apiKey', 'secret123');
      expect(logger.logger.info).toHaveBeenCalledWith('Setting updated: apiKey');
    });

    it('should handle empty string values', () => {
      const mockRun = vi.fn();
      mockDb.prepare.mockReturnValue({ run: mockRun });

      settingsService.setSetting('emptyValue', '');

      expect(mockRun).toHaveBeenCalledWith('emptyValue', '');
    });

    it('should handle special characters in values', () => {
      const mockRun = vi.fn();
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const specialValue = "test'value\"with\\special$chars";
      settingsService.setSetting('specialKey', specialValue);

      expect(mockRun).toHaveBeenCalledWith('specialKey', specialValue);
    });
  });

  describe('getAllSettings', () => {
    it('should return all settings', () => {
      const mockGet = vi.fn()
        .mockReturnValueOnce({ value: 'http://localhost:9090' })
        .mockReturnValueOnce({ value: 'gemini-api-key' })
        .mockReturnValueOnce({ value: 'sonarr-api-key' })
        .mockReturnValueOnce({ value: 'http://sonarr:8989' })
        .mockReturnValueOnce({ value: 'radarr-api-key' })
        .mockReturnValueOnce({ value: 'http://radarr:7878' });

      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = settingsService.getAllSettings();

      expect(result).toEqual({
        aiSubTranslatorUrl: 'http://localhost:9090',
        aiSubTranslatorApiKey: 'gemini-api-key',
        sonarrApiKey: 'sonarr-api-key',
        sonarrUrl: 'http://sonarr:8989',
        radarrApiKey: 'radarr-api-key',
        radarrUrl: 'http://radarr:7878',
      });

      expect(mockGet).toHaveBeenCalledTimes(6);
    });

    it('should return undefined for missing settings', () => {
      const mockGet = vi.fn()
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce({ value: 'api-key' })
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined);

      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = settingsService.getAllSettings();

      expect(result).toEqual({
        aiSubTranslatorUrl: undefined,
        aiSubTranslatorApiKey: 'api-key',
        sonarrApiKey: undefined,
        sonarrUrl: undefined,
        radarrApiKey: undefined,
        radarrUrl: undefined,
      });
    });

    it('should handle all undefined settings', () => {
      const mockGet = vi.fn().mockReturnValue(undefined);
      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = settingsService.getAllSettings();

      expect(result).toEqual({
        aiSubTranslatorUrl: undefined,
        aiSubTranslatorApiKey: undefined,
        sonarrApiKey: undefined,
        sonarrUrl: undefined,
        radarrApiKey: undefined,
        radarrUrl: undefined,
      });
    });
  });

  describe('updateSettings', () => {
    it('should update all provided settings', () => {
      const mockRun = vi.fn();
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const settings: Partial<Settings> = {
        aiSubTranslatorUrl: 'http://new-url:9090',
        aiSubTranslatorApiKey: 'new-api-key',
        sonarrApiKey: 'new-sonarr-key',
        sonarrUrl: 'http://new-sonarr:8989',
        radarrApiKey: 'new-radarr-key',
        radarrUrl: 'http://new-radarr:7878',
      };

      settingsService.updateSettings(settings);

      expect(mockRun).toHaveBeenCalledTimes(6);
      expect(mockRun).toHaveBeenCalledWith('aiSubTranslatorUrl', 'http://new-url:9090');
      expect(mockRun).toHaveBeenCalledWith('aiSubTranslatorApiKey', 'new-api-key');
      expect(mockRun).toHaveBeenCalledWith('sonarrApiKey', 'new-sonarr-key');
      expect(mockRun).toHaveBeenCalledWith('sonarrUrl', 'http://new-sonarr:8989');
      expect(mockRun).toHaveBeenCalledWith('radarrApiKey', 'new-radarr-key');
      expect(mockRun).toHaveBeenCalledWith('radarrUrl', 'http://new-radarr:7878');
    });

    it('should only update provided settings', () => {
      const mockRun = vi.fn();
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const settings: Partial<Settings> = {
        aiSubTranslatorUrl: 'http://partial-update:9090',
        sonarrApiKey: 'partial-sonarr-key',
      };

      settingsService.updateSettings(settings);

      expect(mockRun).toHaveBeenCalledTimes(2);
      expect(mockRun).toHaveBeenCalledWith('aiSubTranslatorUrl', 'http://partial-update:9090');
      expect(mockRun).toHaveBeenCalledWith('sonarrApiKey', 'partial-sonarr-key');
    });

    it('should handle empty partial settings', () => {
      const mockRun = vi.fn();
      mockDb.prepare.mockReturnValue({ run: mockRun });

      settingsService.updateSettings({});

      expect(mockRun).not.toHaveBeenCalled();
    });

    it('should handle empty string values in updates', () => {
      const mockRun = vi.fn();
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const settings: Partial<Settings> = {
        aiSubTranslatorUrl: '',
        sonarrApiKey: '',
      };

      settingsService.updateSettings(settings);

      expect(mockRun).toHaveBeenCalledWith('aiSubTranslatorUrl', '');
      expect(mockRun).toHaveBeenCalledWith('sonarrApiKey', '');
    });

    it('should skip undefined values but update defined empty strings', () => {
      const mockRun = vi.fn();
      mockDb.prepare.mockReturnValue({ run: mockRun });

      const settings: Partial<Settings> = {
        aiSubTranslatorUrl: '',
        aiSubTranslatorApiKey: undefined,
        sonarrApiKey: 'defined-value',
      };

      settingsService.updateSettings(settings);

      expect(mockRun).toHaveBeenCalledTimes(2);
      expect(mockRun).toHaveBeenCalledWith('aiSubTranslatorUrl', '');
      expect(mockRun).toHaveBeenCalledWith('sonarrApiKey', 'defined-value');
      expect(mockRun).not.toHaveBeenCalledWith('aiSubTranslatorApiKey', expect.anything());
    });
  });

  describe('isConfigured', () => {
    it('should return true when all required settings are present with Sonarr', () => {
      const mockGet = vi.fn()
        .mockReturnValueOnce({ value: 'http://localhost:9090' })
        .mockReturnValueOnce({ value: 'api-key' })
        .mockReturnValueOnce({ value: 'sonarr-key' })
        .mockReturnValueOnce({ value: 'http://sonarr:8989' })
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined);

      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = settingsService.isConfigured();

      expect(result).toBe(true);
    });

    it('should return true when all required settings are present with Radarr', () => {
      const mockGet = vi.fn()
        .mockReturnValueOnce({ value: 'http://localhost:9090' })
        .mockReturnValueOnce({ value: 'api-key' })
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce({ value: 'radarr-key' })
        .mockReturnValueOnce({ value: 'http://radarr:7878' });

      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = settingsService.isConfigured();

      expect(result).toBe(true);
    });

    it('should return true when both Sonarr and Radarr are configured', () => {
      const mockGet = vi.fn()
        .mockReturnValueOnce({ value: 'http://localhost:9090' })
        .mockReturnValueOnce({ value: 'api-key' })
        .mockReturnValueOnce({ value: 'sonarr-key' })
        .mockReturnValueOnce({ value: 'http://sonarr:8989' })
        .mockReturnValueOnce({ value: 'radarr-key' })
        .mockReturnValueOnce({ value: 'http://radarr:7878' });

      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = settingsService.isConfigured();

      expect(result).toBe(true);
    });

    it('should return false when aiSubTranslatorUrl is missing', () => {
      const mockGet = vi.fn()
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce({ value: 'api-key' })
        .mockReturnValueOnce({ value: 'sonarr-key' })
        .mockReturnValueOnce({ value: 'http://sonarr:8989' })
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined);

      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = settingsService.isConfigured();

      expect(result).toBe(false);
    });

    it('should return false when aiSubTranslatorApiKey is missing', () => {
      const mockGet = vi.fn()
        .mockReturnValueOnce({ value: 'http://localhost:9090' })
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce({ value: 'sonarr-key' })
        .mockReturnValueOnce({ value: 'http://sonarr:8989' })
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined);

      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = settingsService.isConfigured();

      expect(result).toBe(false);
    });

    it('should return false when neither Sonarr nor Radarr are configured', () => {
      const mockGet = vi.fn()
        .mockReturnValueOnce({ value: 'http://localhost:9090' })
        .mockReturnValueOnce({ value: 'api-key' })
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined);

      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = settingsService.isConfigured();

      expect(result).toBe(false);
    });

    it('should return false when all settings are missing', () => {
      const mockGet = vi.fn().mockReturnValue(undefined);
      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = settingsService.isConfigured();

      expect(result).toBe(false);
    });

    it('should return false when settings have empty strings', () => {
      const mockGet = vi.fn()
        .mockReturnValueOnce({ value: '' })
        .mockReturnValueOnce({ value: 'api-key' })
        .mockReturnValueOnce({ value: 'sonarr-key' })
        .mockReturnValueOnce({ value: 'http://sonarr:8989' })
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined);

      mockDb.prepare.mockReturnValue({ get: mockGet });

      const result = settingsService.isConfigured();

      expect(result).toBe(false);
    });
  });
});