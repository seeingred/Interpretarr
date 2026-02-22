import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { SonarrService, Series, Episode, EpisodeFile } from '../../../src/server/services/sonarr';
import { SettingsService } from '../../../src/server/services/settings';

// Mock dependencies
vi.mock('../../../src/server/services/settings');
vi.mock('../../../src/server/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Helper to create mock Response
function mockResponse(body: any, init?: { status?: number; statusText?: string }) {
  return {
    ok: (init?.status ?? 200) >= 200 && (init?.status ?? 200) < 300,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
  };
}

describe('SonarrService', () => {
  let service: SonarrService;
  let mockSettingsService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    (SonarrService as any).instance = undefined;

    // Mock SettingsService
    mockSettingsService = {
      getSetting: vi.fn((key: string) => {
        const settings: Record<string, string> = {
          sonarrApiKey: 'test-api-key',
          sonarrUrl: 'http://localhost:8989',
        };
        return settings[key];
      }),
    };
    (SettingsService.getInstance as Mock).mockReturnValue(mockSettingsService);

    // Mock global fetch
    (global.fetch as Mock).mockResolvedValue(mockResponse([]));

    service = SonarrService.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SonarrService.getInstance();
      const instance2 = SonarrService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('request', () => {
    it('should make API request with correct headers', async () => {
      (global.fetch as Mock).mockResolvedValue(mockResponse({ test: 'data' }));

      const result = await (service as any).request('/test');

      expect(result).toEqual({ test: 'data' });
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8989/api/v3/test', {
        headers: {
          'X-Api-Key': 'test-api-key',
          'Accept': 'application/json',
        },
      });
    });

    it('should throw when API key is missing', async () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'sonarrApiKey') return undefined;
        return 'http://localhost:8989';
      });

      await expect((service as any).request('/test')).rejects.toThrow('Sonarr not configured');
    });

    it('should throw when URL is missing', async () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'sonarrUrl') return undefined;
        return 'test-api-key';
      });

      await expect((service as any).request('/test')).rejects.toThrow('Sonarr not configured');
    });

    it('should throw on non-OK response', async () => {
      (global.fetch as Mock).mockResolvedValue(
        mockResponse('', { status: 401, statusText: 'Unauthorized' })
      );

      await expect((service as any).request('/test')).rejects.toThrow('Sonarr API error: Unauthorized');
    });
  });

  describe('getSeries', () => {
    it('should fetch all series', async () => {
      const mockSeries: Series[] = [
        { id: 1, title: 'Breaking Bad', path: '/tv/bb', seasonCount: 5, episodeCount: 62, episodeFileCount: 62, status: 'ended', overview: 'Chemistry teacher' },
      ];
      (global.fetch as Mock).mockResolvedValue(mockResponse(mockSeries));

      const result = await service.getSeries();

      expect(result).toEqual(mockSeries);
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8989/api/v3/series', expect.any(Object));
    });

    it('should handle error', async () => {
      (global.fetch as Mock).mockRejectedValue(new Error('Connection refused'));

      await expect(service.getSeries()).rejects.toThrow('Connection refused');
    });
  });

  describe('getEpisodes', () => {
    it('should fetch episodes for a series', async () => {
      const mockEpisodes: Episode[] = [
        { id: 1, seriesId: 1, seasonNumber: 1, episodeNumber: 1, title: 'Pilot', hasFile: true, episodeFileId: 100 },
      ];
      (global.fetch as Mock).mockResolvedValue(mockResponse(mockEpisodes));

      const result = await service.getEpisodes(1);

      expect(result).toEqual(mockEpisodes);
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8989/api/v3/episode?seriesId=1', expect.any(Object));
    });

    it('should handle error', async () => {
      (global.fetch as Mock).mockRejectedValue(new Error('Timeout'));

      await expect(service.getEpisodes(1)).rejects.toThrow('Timeout');
    });
  });

  describe('getEpisodeFile', () => {
    it('should fetch episode file details', async () => {
      const mockFile: EpisodeFile = { id: 100, path: '/tv/bb/S01E01.mkv', size: 2147483648, quality: {} };
      (global.fetch as Mock).mockResolvedValue(mockResponse(mockFile));

      const result = await service.getEpisodeFile(100);

      expect(result).toEqual(mockFile);
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8989/api/v3/episodefile/100', expect.any(Object));
    });

    it('should handle error', async () => {
      (global.fetch as Mock).mockRejectedValue(new Error('File not found'));

      await expect(service.getEpisodeFile(999)).rejects.toThrow('File not found');
    });
  });

  describe('isConfigured', () => {
    it('should return true when both settings are present', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when API key is missing', () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'sonarrApiKey') return undefined;
        return 'http://localhost:8989';
      });

      expect(service.isConfigured()).toBe(false);
    });

    it('should return false when URL is missing', () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'sonarrUrl') return undefined;
        return 'test-api-key';
      });

      expect(service.isConfigured()).toBe(false);
    });

    it('should return false when both are missing', () => {
      mockSettingsService.getSetting.mockReturnValue(undefined);

      expect(service.isConfigured()).toBe(false);
    });
  });
});
