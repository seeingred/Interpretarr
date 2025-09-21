import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { RadarrService, Movie, MovieFile } from '../../../src/server/services/radarr';
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

describe('RadarrService', () => {
  let service: RadarrService;
  let mockSettingsService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    (RadarrService as any).instance = undefined;

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
          radarrApiKey: 'test-radarr-key',
          radarrUrl: 'http://localhost:7878',
        };
        return settings[key];
      }),
    };
    (SettingsService.getInstance as Mock).mockReturnValue(mockSettingsService);

    service = RadarrService.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = RadarrService.getInstance();
      const instance2 = RadarrService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance if none exists', () => {
      (RadarrService as any).instance = undefined;
      const instance = RadarrService.getInstance();
      expect(instance).toBeInstanceOf(RadarrService);
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
      expect(fetch).toHaveBeenCalledWith('http://localhost:7878/api/v3/test', {
        headers: {
          'X-Api-Key': 'test-radarr-key',
          'Accept': 'application/json',
        },
      });
      expect(logger.logger.info).toHaveBeenCalledWith('[Radarr] Requesting: http://localhost:7878/api/v3/test');
      expect(logger.logger.info).toHaveBeenCalledWith('[Radarr] Response received for /test');
    });

    it('should throw error when API key is missing', async () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'radarrApiKey') return undefined;
        return 'http://localhost:7878';
      });

      await expect((service as any).request('/test')).rejects.toThrow('Radarr not configured');
    });

    it('should throw error when URL is missing', async () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'radarrUrl') return undefined;
        return 'test-radarr-key';
      });

      await expect((service as any).request('/test')).rejects.toThrow('Radarr not configured');
    });

    it('should throw error on non-OK response', async () => {
      (fetch as Mock).mockResolvedValue(
        new Response('Forbidden', {
          status: 403,
          statusText: 'Forbidden',
        })
      );

      await expect((service as any).request('/test')).rejects.toThrow('Radarr API error: Forbidden');
      expect(logger.logger.error).toHaveBeenCalledWith('[Radarr] API error: 403 Forbidden');
    });

    it('should handle network error', async () => {
      (fetch as Mock).mockRejectedValue(new Error('ECONNREFUSED'));

      await expect((service as any).request('/test')).rejects.toThrow('ECONNREFUSED');
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
        new Response('Not JSON', {
          status: 200,
          statusText: 'OK',
        })
      );

      await expect((service as any).request('/test')).rejects.toThrow();
    });

    it('should handle different API base URLs', async () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'radarrUrl') return 'https://radarr.example.com:9999';
        return 'test-radarr-key';
      });

      (fetch as Mock).mockResolvedValue(
        new Response('[]', {
          status: 200,
          statusText: 'OK',
        })
      );

      await (service as any).request('/movie');

      expect(fetch).toHaveBeenCalledWith('https://radarr.example.com:9999/api/v3/movie', expect.any(Object));
    });

    it('should handle URL with trailing slash', async () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'radarrUrl') return 'http://localhost:7878/';
        return 'test-radarr-key';
      });

      (fetch as Mock).mockResolvedValue(
        new Response('{}', {
          status: 200,
          statusText: 'OK',
        })
      );

      await (service as any).request('/test');

      expect(fetch).toHaveBeenCalledWith('http://localhost:7878//api/v3/test', expect.any(Object));
    });
  });

  describe('getMovies', () => {
    it('should fetch all movies', async () => {
      const mockMovies: Movie[] = [
        {
          id: 1,
          title: 'The Shawshank Redemption',
          path: '/movies/The Shawshank Redemption (1994)',
          year: 1994,
          hasFile: true,
          movieFileId: 100,
          status: 'released',
          overview: 'Two imprisoned men bond over a number of years',
        },
        {
          id: 2,
          title: 'The Godfather',
          path: '/movies/The Godfather (1972)',
          year: 1972,
          hasFile: true,
          movieFileId: 101,
          status: 'released',
          overview: 'The aging patriarch of an organized crime dynasty',
        },
      ];

      (fetch as Mock).mockResolvedValue(
        new Response(JSON.stringify(mockMovies), {
          status: 200,
          statusText: 'OK',
        })
      );

      const result = await service.getMovies();

      expect(result).toEqual(mockMovies);
      expect(fetch).toHaveBeenCalledWith('http://localhost:7878/api/v3/movie', expect.any(Object));
    });

    it('should handle empty movies list', async () => {
      (fetch as Mock).mockResolvedValue(
        new Response('[]', {
          status: 200,
          statusText: 'OK',
        })
      );

      const result = await service.getMovies();

      expect(result).toEqual([]);
    });

    it('should handle and log error when fetching movies fails', async () => {
      (fetch as Mock).mockRejectedValue(new Error('Connection timeout'));

      await expect(service.getMovies()).rejects.toThrow('Connection timeout');
      expect(logger.logger.error).toHaveBeenCalledWith('Failed to fetch movies: Error: Connection timeout');
    });

    it('should handle API error response', async () => {
      (fetch as Mock).mockResolvedValue(
        new Response('Bad Gateway', {
          status: 502,
          statusText: 'Bad Gateway',
        })
      );

      await expect(service.getMovies()).rejects.toThrow('Radarr API error: Bad Gateway');
      expect(logger.logger.error).toHaveBeenCalledWith('[Radarr] API error: 502 Bad Gateway');
      expect(logger.logger.error).toHaveBeenCalledWith('Failed to fetch movies: Error: Radarr API error: Bad Gateway');
    });

    it('should handle movies with missing files', async () => {
      const mockMovies: Movie[] = [
        {
          id: 3,
          title: 'Upcoming Movie',
          path: '/movies/Upcoming Movie (2025)',
          year: 2025,
          hasFile: false,
          movieFileId: 0,
          status: 'announced',
          overview: 'A movie that has not been released yet',
        },
      ];

      (fetch as Mock).mockResolvedValue(
        new Response(JSON.stringify(mockMovies), {
          status: 200,
          statusText: 'OK',
        })
      );

      const result = await service.getMovies();

      expect(result).toEqual(mockMovies);
      expect(result[0].hasFile).toBe(false);
    });
  });

  describe('getMovieFile', () => {
    it('should fetch movie file details', async () => {
      const mockFile: MovieFile = {
        id: 100,
        path: '/movies/The Shawshank Redemption (1994)/The.Shawshank.Redemption.1994.1080p.BluRay.x264.mkv',
        size: 10737418240,
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

      const result = await service.getMovieFile(100);

      expect(result).toEqual(mockFile);
      expect(fetch).toHaveBeenCalledWith('http://localhost:7878/api/v3/moviefile/100', expect.any(Object));
    });

    it('should handle and log error when fetching movie file fails', async () => {
      (fetch as Mock).mockRejectedValue(new Error('File not found'));

      await expect(service.getMovieFile(999)).rejects.toThrow('File not found');
      expect(logger.logger.error).toHaveBeenCalledWith('Failed to fetch movie file: Error: File not found');
    });

    it('should handle 404 response for non-existent file', async () => {
      (fetch as Mock).mockResolvedValue(
        new Response('Not Found', {
          status: 404,
          statusText: 'Not Found',
        })
      );

      await expect(service.getMovieFile(999)).rejects.toThrow('Radarr API error: Not Found');
      expect(logger.logger.error).toHaveBeenCalledWith('[Radarr] API error: 404 Not Found');
    });

    it('should handle different file IDs', async () => {
      (fetch as Mock).mockResolvedValue(
        new Response('{}', {
          status: 200,
          statusText: 'OK',
        })
      );

      await service.getMovieFile(1);
      expect(fetch).toHaveBeenCalledWith('http://localhost:7878/api/v3/moviefile/1', expect.any(Object));

      await service.getMovieFile(999999);
      expect(fetch).toHaveBeenCalledWith('http://localhost:7878/api/v3/moviefile/999999', expect.any(Object));
    });

    it('should handle movie file with minimal data', async () => {
      const mockFile: MovieFile = {
        id: 200,
        path: '/movies/test.mkv',
        size: 0,
        quality: null,
      };

      (fetch as Mock).mockResolvedValue(
        new Response(JSON.stringify(mockFile), {
          status: 200,
          statusText: 'OK',
        })
      );

      const result = await service.getMovieFile(200);

      expect(result).toEqual(mockFile);
      expect(result.quality).toBeNull();
      expect(result.size).toBe(0);
    });
  });

  describe('isConfigured', () => {
    it('should return true when both API key and URL are configured', () => {
      const result = service.isConfigured();
      expect(result).toBe(true);
    });

    it('should return false when API key is missing', () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'radarrApiKey') return undefined;
        return 'http://localhost:7878';
      });

      const result = service.isConfigured();
      expect(result).toBe(false);
    });

    it('should return false when URL is missing', () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'radarrUrl') return undefined;
        return 'test-radarr-key';
      });

      const result = service.isConfigured();
      expect(result).toBe(false);
    });

    it('should return false when both are missing', () => {
      mockSettingsService.getSetting.mockReturnValue(undefined);

      const result = service.isConfigured();
      expect(result).toBe(false);
    });

    it('should return false for empty string API key', () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'radarrApiKey') return '';
        if (key === 'radarrUrl') return 'http://localhost:7878';
        return undefined;
      });

      const result = service.isConfigured();
      expect(result).toBe(false);
    });

    it('should return false for empty string URL', () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'radarrApiKey') return 'test-key';
        if (key === 'radarrUrl') return '';
        return undefined;
      });

      const result = service.isConfigured();
      expect(result).toBe(false);
    });

    it('should return false when both are empty strings', () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'radarrApiKey') return '';
        if (key === 'radarrUrl') return '';
        return undefined;
      });

      const result = service.isConfigured();
      expect(result).toBe(false);
    });
  });
});