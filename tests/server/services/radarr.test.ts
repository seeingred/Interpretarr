import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { RadarrService, Movie, MovieFile } from '../../../src/server/services/radarr';
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

describe('RadarrService', () => {
  let service: RadarrService;
  let mockSettingsService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    (RadarrService as any).instance = undefined;

    // Mock SettingsService
    mockSettingsService = {
      getSetting: vi.fn((key: string) => {
        const settings: Record<string, string> = {
          radarrApiKey: 'test-radarr-key',
          radarrUrl: 'http://localhost:7878',
        };
        return settings[key];
      }),
    };
    (SettingsService.getInstance as Mock).mockReturnValue(mockSettingsService);

    // Mock global fetch
    (global.fetch as Mock).mockResolvedValue(mockResponse([]));

    service = RadarrService.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = RadarrService.getInstance();
      const instance2 = RadarrService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('request', () => {
    it('should make API request with correct headers', async () => {
      (global.fetch as Mock).mockResolvedValue(mockResponse({ test: 'data' }));

      const result = await (service as any).request('/test');

      expect(result).toEqual({ test: 'data' });
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:7878/api/v3/test', {
        headers: {
          'X-Api-Key': 'test-radarr-key',
          'Accept': 'application/json',
        },
      });
    });

    it('should throw when API key is missing', async () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'radarrApiKey') return undefined;
        return 'http://localhost:7878';
      });

      await expect((service as any).request('/test')).rejects.toThrow('Radarr not configured');
    });

    it('should throw when URL is missing', async () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'radarrUrl') return undefined;
        return 'test-radarr-key';
      });

      await expect((service as any).request('/test')).rejects.toThrow('Radarr not configured');
    });

    it('should throw on non-OK response', async () => {
      (global.fetch as Mock).mockResolvedValue(
        mockResponse('', { status: 403, statusText: 'Forbidden' })
      );

      await expect((service as any).request('/test')).rejects.toThrow('Radarr API error: Forbidden');
    });
  });

  describe('getMovies', () => {
    it('should fetch all movies', async () => {
      const mockMovies: Movie[] = [
        { id: 1, title: 'The Shawshank Redemption', path: '/movies/shawshank', year: 1994, hasFile: true, movieFileId: 100, status: 'released', overview: 'Two imprisoned men' },
      ];
      (global.fetch as Mock).mockResolvedValue(mockResponse(mockMovies));

      const result = await service.getMovies();

      expect(result).toEqual(mockMovies);
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:7878/api/v3/movie', expect.any(Object));
    });

    it('should handle error', async () => {
      (global.fetch as Mock).mockRejectedValue(new Error('Connection timeout'));

      await expect(service.getMovies()).rejects.toThrow('Connection timeout');
    });
  });

  describe('getMovieFile', () => {
    it('should fetch movie file details', async () => {
      const mockFile: MovieFile = { id: 100, path: '/movies/shawshank/movie.mkv', size: 10737418240, quality: {} };
      (global.fetch as Mock).mockResolvedValue(mockResponse(mockFile));

      const result = await service.getMovieFile(100);

      expect(result).toEqual(mockFile);
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:7878/api/v3/moviefile/100', expect.any(Object));
    });

    it('should handle error', async () => {
      (global.fetch as Mock).mockRejectedValue(new Error('File not found'));

      await expect(service.getMovieFile(999)).rejects.toThrow('File not found');
    });
  });

  describe('isConfigured', () => {
    it('should return true when both settings are present', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when API key is missing', () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'radarrApiKey') return undefined;
        return 'http://localhost:7878';
      });

      expect(service.isConfigured()).toBe(false);
    });

    it('should return false when URL is missing', () => {
      mockSettingsService.getSetting.mockImplementation((key: string) => {
        if (key === 'radarrUrl') return undefined;
        return 'test-radarr-key';
      });

      expect(service.isConfigured()).toBe(false);
    });

    it('should return false when both are missing', () => {
      mockSettingsService.getSetting.mockReturnValue(undefined);

      expect(service.isConfigured()).toBe(false);
    });
  });
});
