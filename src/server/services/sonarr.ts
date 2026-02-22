import { SettingsService } from './settings.js';
import { logger } from '../utils/logger.js';

export interface Series {
  id: number;
  title: string;
  path: string;
  seasonCount: number;
  episodeCount: number;
  episodeFileCount: number;
  status: string;
  overview: string;
}

export interface Episode {
  id: number;
  seriesId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  hasFile: boolean;
  episodeFileId: number;
}

export interface EpisodeFile {
  id: number;
  path: string;
  size: number;
  quality: any;
}

export class SonarrService {
  private static instance: SonarrService;

  static getInstance(): SonarrService {
    if (!SonarrService.instance) {
      SonarrService.instance = new SonarrService();
    }
    return SonarrService.instance;
  }

  private async request<T>(endpoint: string): Promise<T> {
    const settings = SettingsService.getInstance();
    const apiKey = settings.getSetting('sonarrApiKey');
    const url = settings.getSetting('sonarrUrl');

    if (!apiKey || !url) {
      throw new Error('Sonarr not configured');
    }

    logger.info(`[Sonarr] Requesting: ${url}/api/v3${endpoint}`);

    const response = await fetch(`${url}/api/v3${endpoint}`, {
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      logger.error(`[Sonarr] API error: ${response.status} ${response.statusText}`);
      throw new Error(`Sonarr API error: ${response.statusText}`);
    }

    const data = await response.json() as T;
    logger.info(`[Sonarr] Response received for ${endpoint}`);
    return data;
  }

  async getSeries(): Promise<Series[]> {
    try {
      return await this.request<Series[]>('/series');
    } catch (error) {
      logger.error(`Failed to fetch series: ${error}`);
      throw error;
    }
  }

  async getEpisodes(seriesId: number): Promise<Episode[]> {
    try {
      return await this.request<Episode[]>(`/episode?seriesId=${seriesId}`);
    } catch (error) {
      logger.error(`Failed to fetch episodes: ${error}`);
      throw error;
    }
  }

  async getEpisodeFile(episodeFileId: number): Promise<EpisodeFile> {
    try {
      return await this.request<EpisodeFile>(`/episodefile/${episodeFileId}`);
    } catch (error) {
      logger.error(`Failed to fetch episode file: ${error}`);
      throw error;
    }
  }

  isConfigured(): boolean {
    const settings = SettingsService.getInstance();
    return !!(settings.getSetting('sonarrApiKey') && settings.getSetting('sonarrUrl'));
  }
}