import fetch from 'node-fetch';
import { SettingsService } from './settings.js';
import { logger } from '../utils/logger.js';

export interface Movie {
  id: number;
  title: string;
  path: string;
  year: number;
  hasFile: boolean;
  movieFileId: number;
  status: string;
  overview: string;
}

export interface MovieFile {
  id: number;
  path: string;
  size: number;
  quality: any;
}

export class RadarrService {
  private static instance: RadarrService;

  static getInstance(): RadarrService {
    if (!RadarrService.instance) {
      RadarrService.instance = new RadarrService();
    }
    return RadarrService.instance;
  }

  private async request<T>(endpoint: string): Promise<T> {
    const settings = SettingsService.getInstance();
    const apiKey = settings.getSetting('radarrApiKey');
    const url = settings.getSetting('radarrUrl');

    if (!apiKey || !url) {
      throw new Error('Radarr not configured');
    }

    logger.info(`[Radarr] Requesting: ${url}/api/v3${endpoint}`);

    const response = await fetch(`${url}/api/v3${endpoint}`, {
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      logger.error(`[Radarr] API error: ${response.status} ${response.statusText}`);
      throw new Error(`Radarr API error: ${response.statusText}`);
    }

    const data = await response.json() as T;
    logger.info(`[Radarr] Response received for ${endpoint}`);
    return data;
  }

  async getMovies(): Promise<Movie[]> {
    try {
      return await this.request<Movie[]>('/movie');
    } catch (error) {
      logger.error(`Failed to fetch movies: ${error}`);
      throw error;
    }
  }

  async getMovieFile(movieFileId: number): Promise<MovieFile> {
    try {
      return await this.request<MovieFile>(`/moviefile/${movieFileId}`);
    } catch (error) {
      logger.error(`Failed to fetch movie file: ${error}`);
      throw error;
    }
  }

  isConfigured(): boolean {
    const settings = SettingsService.getInstance();
    return !!(settings.getSetting('radarrApiKey') && settings.getSetting('radarrUrl'));
  }
}