import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { SonarrService, Series, Episode, EpisodeFile } from '../../../src/server/services/sonarr';
import { SettingsService } from '../../../src/server/services/settings';
import * as logger from '../../../src/server/utils/logger';
import fetch from 'node-fetch';

// Mock dependencies
vi.mock('../../../src/server/services/settings');
vi.mock('../../../src/server/utils/logger');
vi.mock('node-fetch');

// Create a mock Response class
class MockResponse {
  ok: boolean;
  status: number;
  statusText: string;
  private body: string;

  constructor(body: string, init?: { status?: number; statusText?: string; headers?: any }) {
    this.body = body;
    this.ok = init?.status ? init.status >= 200 && init.status < 300 : true;
    this.status = init?.status || 200;
    this.statusText = init?.statusText || 'OK';
  }

  async json() {
    return JSON.parse(this.body);
  }

  async text() {
    return this.body;
  }
}

const Response = MockResponse;

describe('SonarrService', () => {
  let service: SonarrService;
  let mockSettingsService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    (SonarrService as any).instance = undefined;

    // Mock logger
    (logger.logger as any) = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    // Mock SettingsService
    mockSettingsService = {
      getSetting: vi.fn((key: string) => {
        const settings: { [key: string]: string } = {
          sonarrApiKey: 'test-api-key',
          sonarrUrl: 'http://localhost:8989',
        };
        return settings[key];
      }),
    };
    (SettingsService.getInstance as Mock).mockReturnValue(mockSettingsService);

    service = SonarrService.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SonarrService.getInstance();
      const instance2 = SonarrService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance if none exists', () => {
      (SonarrService as any).instance = undefined;
      const instance = SonarrService.getInstance();
      expect(instance).toBeInstanceOf(SonarrService);
    });
  });

  describe('request', () => {
    it('should make successful API request with correct headers', async () => {
      const mockData = { test: 'data' };
      (fetch as Mock).mockResolvedValue(
        new Response(JSON.stringify(mockData), {
          status: 200,
          statusText: 'OK',
        })
      );

      const result = await (service as any).request('/test');

      expect(result).toEqual(mockData);
      expect(fetch).toHaveBeenCalledWith('http://localhost:8989/api/v3/test', {
        headers: {
          'X-Api-Key': 'test-api-key',
          'Accept': 'application/json',
        },
      });
      expect(logger.logger.info).toHaveBeenCalledWith('[Sonarr] Requesting: http://localhost:8989/api/v3/test');
      expect(logger.logger.info).toHaveBeenCalledWith('[Sonarr] Response received for /test');
    });

    it('should throw error when API key is missing', async () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'sonarrApiKey') return undefined;
        return 'http://localhost:8989';
      });

      await expect((service as any).request('/test')).rejects.toThrow('Sonarr not configured');
    });

    it('should throw error when URL is missing', async () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'sonarrUrl') return undefined;
        return 'test-api-key';
      });

      await expect((service as any).request('/test')).rejects.toThrow('Sonarr not configured');
    });

    it('should throw error on non-OK response', async () => {
      (fetch as Mock).mockResolvedValue(
        new Response('Unauthorized', {
          status: 401,
          statusText: 'Unauthorized',
        })
      );

      await expect((service as any).request('/test')).rejects.toThrow('Sonarr API error: Unauthorized');
      expect(logger.logger.error).toHaveBeenCalledWith('[Sonarr] API error: 401 Unauthorized');
    });

    it('should handle network error', async () => {
      (fetch as Mock).mockRejectedValue(new Error('Network error'));

      await expect((service as any).request('/test')).rejects.toThrow('Network error');
    });

    it('should handle empty response', async () => {
      (fetch as Mock).mockResolvedValue(
        new Response('', {
          status: 200,
          statusText: 'OK',
        })
      );

      await expect((service as any).request('/test')).rejects.toThrow();
    });

    it('should handle invalid JSON response', async () => {
      (fetch as Mock).mockResolvedValue(
        new Response('Invalid JSON', {
          status: 200,
          statusText: 'OK',
        })
      );

      await expect((service as any).request('/test')).rejects.toThrow();
    });

    it('should handle different API base URLs', async () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'sonarrUrl') return 'https://sonarr.example.com:7878';
        return 'test-api-key';
      });

      (fetch as Mock).mockResolvedValue(
        new Response('[]', {
          status: 200,
          statusText: 'OK',
        })
      );

      await (service as any).request('/series');

      expect(fetch).toHaveBeenCalledWith('https://sonarr.example.com:7878/api/v3/series', expect.any(Object));
    });
  });

  describe('getSeries', () => {
    it('should fetch all series', async () => {
      const mockSeries: Series[] = [
        {
          id: 1,
          title: 'Breaking Bad',
          path: '/tv/breaking-bad',
          seasonCount: 5,
          episodeCount: 62,
          episodeFileCount: 62,
          status: 'ended',
          overview: 'A chemistry teacher becomes a meth cook',
        },
        {
          id: 2,
          title: 'Better Call Saul',
          path: '/tv/better-call-saul',
          seasonCount: 6,
          episodeCount: 63,
          episodeFileCount: 63,
          status: 'ended',
          overview: 'The story of Jimmy McGill',
        },
      ];

      (fetch as Mock).mockResolvedValue(
        new Response(JSON.stringify(mockSeries), {
          status: 200,
          statusText: 'OK',
        })
      );

      const result = await service.getSeries();

      expect(result).toEqual(mockSeries);
      expect(fetch).toHaveBeenCalledWith('http://localhost:8989/api/v3/series', expect.any(Object));
    });

    it('should handle empty series list', async () => {
      (fetch as Mock).mockResolvedValue(
        new Response('[]', {
          status: 200,
          statusText: 'OK',
        })
      );

      const result = await service.getSeries();

      expect(result).toEqual([]);
    });

    it('should handle and log error when fetching series fails', async () => {
      (fetch as Mock).mockRejectedValue(new Error('Connection refused'));

      await expect(service.getSeries()).rejects.toThrow('Connection refused');
      expect(logger.logger.error).toHaveBeenCalledWith('Failed to fetch series: Error: Connection refused');
    });

    it('should handle API error response', async () => {
      (fetch as Mock).mockResolvedValue(
        new Response('Server Error', {
          status: 500,
          statusText: 'Internal Server Error',
        })
      );

      await expect(service.getSeries()).rejects.toThrow('Sonarr API error: Internal Server Error');
      expect(logger.logger.error).toHaveBeenCalledWith('[Sonarr] API error: 500 Internal Server Error');
      expect(logger.logger.error).toHaveBeenCalledWith('Failed to fetch series: Error: Sonarr API error: Internal Server Error');
    });
  });

  describe('getEpisodes', () => {
    it('should fetch episodes for a series', async () => {
      const mockEpisodes: Episode[] = [
        {
          id: 1,
          seriesId: 1,
          seasonNumber: 1,
          episodeNumber: 1,
          title: 'Pilot',
          hasFile: true,
          episodeFileId: 100,
        },
        {
          id: 2,
          seriesId: 1,
          seasonNumber: 1,
          episodeNumber: 2,
          title: 'Cat\'s in the Bag...',
          hasFile: true,
          episodeFileId: 101,
        },
      ];

      (fetch as Mock).mockResolvedValue(
        new Response(JSON.stringify(mockEpisodes), {
          status: 200,
          statusText: 'OK',
        })
      );

      const result = await service.getEpisodes(1);

      expect(result).toEqual(mockEpisodes);
      expect(fetch).toHaveBeenCalledWith('http://localhost:8989/api/v3/episode?seriesId=1', expect.any(Object));
    });

    it('should handle empty episodes list', async () => {
      (fetch as Mock).mockResolvedValue(
        new Response('[]', {
          status: 200,
          statusText: 'OK',
        })
      );

      const result = await service.getEpisodes(999);

      expect(result).toEqual([]);
      expect(fetch).toHaveBeenCalledWith('http://localhost:8989/api/v3/episode?seriesId=999', expect.any(Object));
    });

    it('should handle and log error when fetching episodes fails', async () => {
      (fetch as Mock).mockRejectedValue(new Error('Timeout'));

      await expect(service.getEpisodes(1)).rejects.toThrow('Timeout');
      expect(logger.logger.error).toHaveBeenCalledWith('Failed to fetch episodes: Error: Timeout');
    });

    it('should handle different series IDs', async () => {
      (fetch as Mock).mockResolvedValue(
        new Response('[]', {
          status: 200,
          statusText: 'OK',
        })
      );

      await service.getEpisodes(42);
      expect(fetch).toHaveBeenCalledWith('http://localhost:8989/api/v3/episode?seriesId=42', expect.any(Object));

      await service.getEpisodes(0);
      expect(fetch).toHaveBeenCalledWith('http://localhost:8989/api/v3/episode?seriesId=0', expect.any(Object));
    });
  });

  describe('getEpisodeFile', () => {
    it('should fetch episode file details', async () => {
      const mockFile: EpisodeFile = {
        id: 100,
        path: '/tv/breaking-bad/Season 01/Breaking.Bad.S01E01.1080p.BluRay.x264.mkv',
        size: 2147483648,
        quality: {
          quality: {
            id: 7,
            name: 'Bluray-1080p',
            source: 'bluray',
            resolution: 1080,
          },
        },
      };

      (fetch as Mock).mockResolvedValue(
        new Response(JSON.stringify(mockFile), {
          status: 200,
          statusText: 'OK',
        })
      );

      const result = await service.getEpisodeFile(100);

      expect(result).toEqual(mockFile);
      expect(fetch).toHaveBeenCalledWith('http://localhost:8989/api/v3/episodefile/100', expect.any(Object));
    });

    it('should handle and log error when fetching episode file fails', async () => {
      (fetch as Mock).mockRejectedValue(new Error('File not found'));

      await expect(service.getEpisodeFile(999)).rejects.toThrow('File not found');
      expect(logger.logger.error).toHaveBeenCalledWith('Failed to fetch episode file: Error: File not found');
    });

    it('should handle 404 response for non-existent file', async () => {
      (fetch as Mock).mockResolvedValue(
        new Response('Not Found', {
          status: 404,
          statusText: 'Not Found',
        })
      );

      await expect(service.getEpisodeFile(999)).rejects.toThrow('Sonarr API error: Not Found');
    });

    it('should handle different file IDs', async () => {
      (fetch as Mock).mockResolvedValue(
        new Response('{}', {
          status: 200,
          statusText: 'OK',
        })
      );

      await service.getEpisodeFile(1);
      expect(fetch).toHaveBeenCalledWith('http://localhost:8989/api/v3/episodefile/1', expect.any(Object));

      await service.getEpisodeFile(999999);
      expect(fetch).toHaveBeenCalledWith('http://localhost:8989/api/v3/episodefile/999999', expect.any(Object));
    });
  });

  describe('isConfigured', () => {
    it('should return true when both API key and URL are configured', () => {
      const result = service.isConfigured();
      expect(result).toBe(true);
    });

    it('should return false when API key is missing', () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'sonarrApiKey') return undefined;
        return 'http://localhost:8989';
      });

      const result = service.isConfigured();
      expect(result).toBe(false);
    });

    it('should return false when URL is missing', () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'sonarrUrl') return undefined;
        return 'test-api-key';
      });

      const result = service.isConfigured();
      expect(result).toBe(false);
    });

    it('should return false when both are missing', () => {
      mockSettingsService.getSetting.mockReturnValue(undefined);

      const result = service.isConfigured();
      expect(result).toBe(false);
    });

    it('should return false for empty string values', () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'sonarrApiKey') return '';
        if (key === 'sonarrUrl') return 'http://localhost:8989';
        return undefined;
      });

      const result = service.isConfigured();
      expect(result).toBe(false);
    });

    it('should return false when URL is empty string', () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'sonarrApiKey') return 'test-key';
        if (key === 'sonarrUrl') return '';
        return undefined;
      });

      const result = service.isConfigured();
      expect(result).toBe(false);
    });
  });
});