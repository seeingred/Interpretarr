import jayson from 'jayson';
import { SettingsService } from './settings.js';
import { logger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs';

export class AiSubTranslatorService {
  private static instance: AiSubTranslatorService;
  private client: jayson.HttpClient;
  private pollInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.client = this.createClient();
  }

  private createClient(): jayson.HttpClient {
    const settings = SettingsService.getInstance();
    const url = settings.getSetting('aiSubTranslatorUrl') || 'http://localhost:9090';
    const urlParts = new URL(url);

    return jayson.Client.http({
      hostname: urlParts.hostname,
      port: parseInt(urlParts.port || '9090')
    });
  }

  static getInstance(): AiSubTranslatorService {
    if (!AiSubTranslatorService.instance) {
      AiSubTranslatorService.instance = new AiSubTranslatorService();
    }
    return AiSubTranslatorService.instance;
  }

  private async request(method: string, params: any[] = []): Promise<any> {
    logger.info({ params }, `[ai-sub-translator] Calling ${method}`);
    return new Promise((resolve, reject) => {
      this.client.request(method, params, (err: any, response: any) => {
        if (err) {
          logger.error(`[ai-sub-translator] RPC Error: ${err.message || err}`);
          logger.error({ error: err }, `[ai-sub-translator] Full error`);
          return reject(err);
        }
        if (response?.error) {
          logger.error(`[ai-sub-translator] API Error: ${response.error.message}`);
          return reject(new Error(response.error.message));
        }
        logger.info({ result: response?.result }, `[ai-sub-translator] Response from ${method}`);
        resolve(response?.result);
      });
    });
  }

  async translateSubtitle(
    subtitlePath: string,
    targetLanguage: string,
    progressCallback?: (progress: number) => void,
    streamId?: number
  ): Promise<string> {
    const settings = SettingsService.getInstance();
    const apiKey = settings.getSetting('aiSubTranslatorApiKey');

    if (!apiKey) {
      throw new Error('AI Subtitle Translator API key not configured');
    }

    try {
      // Always clear before starting a new translation to ensure clean state
      await this.request('clear');
      logger.info('Cleared ai-sub-translator state before starting translation');

      const loadResult = await this.request('file.load', [subtitlePath]);
      logger.info({ loadResult }, `Loaded file: ${loadResult.type} - ${loadResult.path}`);

      if (loadResult.type === 'video') {
        const subtitles = loadResult.subtitles || [];
        if (subtitles.length === 0) {
          throw new Error('No subtitles found in video file');
        }

        // Use provided streamId or default to first subtitle
        let subtitleToExtract;
        if (streamId !== undefined) {
          subtitleToExtract = subtitles.find((s: any) => s.id === streamId);
          if (!subtitleToExtract) {
            throw new Error(`Subtitle stream ${streamId} not found in video`);
          }
        } else {
          subtitleToExtract = subtitles[0];
        }

        await this.request('subtitle.extract', [subtitleToExtract.id]);
        logger.info({ subtitleId: subtitleToExtract.id }, `Extracted subtitle stream ${subtitleToExtract.id}`);
      }

      const translationOptions = {
        apiKey,
        language: targetLanguage,
        context: path.basename(subtitlePath, path.extname(subtitlePath)),
        model: 'gemini-1.5-flash-8b',
        batchSize: 50
      };

      await this.request('translation.start', [translationOptions]);
      logger.info(`Started translation job`);

      // Small delay to ensure job is registered before polling
      await new Promise(resolve => setTimeout(resolve, 500));

      await this.pollProgress(progressCallback);

      // Get the translated result first
      const translationResult = await this.request('translation.result');
      logger.info(`Translation result received, ${translationResult?.length || 0} characters`);

      const videoDir = path.dirname(subtitlePath);
      const videoBase = path.basename(subtitlePath, path.extname(subtitlePath));
      const outputPath = path.join(videoDir, `${videoBase}.${targetLanguage}.srt`);

      await this.request('translation.save', [outputPath]);
      logger.info({ outputPath }, `Saved translation`);

      return outputPath;
    } catch (error) {
      logger.error(`Translation failed: ${error}`);
      throw error;
    } finally {
      // Clean up if needed
    }
  }

  private async pollProgress(progressCallback?: (progress: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      let noJobRetries = 0;
      const maxNoJobRetries = 3;
      let lastProgress = -1;

      // Clear any existing interval
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }

      this.pollInterval = setInterval(async () => {
        try {
          const status = await this.request('translation.status');

          // Reset retry counter on successful status check
          noJobRetries = 0;

          // Only report progress if it actually changed and is valid
          if (progressCallback && status.progress !== undefined &&
              status.progress !== lastProgress &&
              status.progress >= 0 && status.progress <= 100) {
            lastProgress = status.progress;
            progressCallback(Math.round(status.progress));
          }

          logger.debug(`Translation progress: ${status.progress}% - ${status.status}`);

          if (status.status === 'completed') {
            if (this.pollInterval) {
              clearInterval(this.pollInterval);
              this.pollInterval = null;
            }
            resolve();
          } else if (status.status === 'failed') {
            if (this.pollInterval) {
              clearInterval(this.pollInterval);
              this.pollInterval = null;
            }
            reject(new Error(status.error || 'Translation failed'));
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // Handle "No active translation job" error with retries
          if (errorMessage.includes('No active translation job')) {
            noJobRetries++;
            logger.warn(`No active job found, retry ${noJobRetries}/${maxNoJobRetries}`);

            if (noJobRetries >= maxNoJobRetries) {
              if (this.pollInterval) {
                clearInterval(this.pollInterval);
                this.pollInterval = null;
              }
              // Assume completed if we can't find the job after retries
              logger.info('No active job after retries, assuming translation completed');
              resolve();
            }
            // Continue polling for a few more attempts
          } else {
            // For other errors, fail immediately
            if (this.pollInterval) {
              clearInterval(this.pollInterval);
              this.pollInterval = null;
            }
            reject(error);
          }
        }
      }, 2000);
    });
  }

  async getAvailableSubtitles(videoPath: string): Promise<any[]> {
    try {
      // First check for external subtitle files
      const videoDir = path.dirname(videoPath);
      const videoBase = path.basename(videoPath, path.extname(videoPath));
      const externalSubs: any[] = [];

      // Try to list files in the directory (this may fail in Docker)
      try {
        if (fs.existsSync(videoDir)) {
          const files = fs.readdirSync(videoDir);
          files.forEach(file => {
            const isSubtitle = ['.srt', '.ass', '.vtt', '.sub'].some(ext =>
              file.toLowerCase().endsWith(ext)
            );
            if (isSubtitle && file.toLowerCase().includes(videoBase.toLowerCase())) {
              externalSubs.push({
                path: path.join(videoDir, file),
                type: 'external',
                filename: file
              });
            }
          });
        }
      } catch (err) {
        logger.warn(`Could not access local filesystem: ${err}`);
      }

      // Load the video file in ai-sub-translator to get embedded subtitles
      const loadResult = await this.request('file.load', [videoPath]);

      if (loadResult.type === 'video' && loadResult.subtitles) {
        // Add embedded subtitles from the video
        const embeddedSubs = loadResult.subtitles.map((sub: any) => ({
          ...sub,
          type: 'embedded',
          path: videoPath
        }));

        return [...externalSubs, ...embeddedSubs];
      }

      // If it's not a video or has no subtitles, return external subs only
      return externalSubs;
    } catch (error) {
      logger.error(`Failed to get available subtitles: ${error}`);
      return [];
    }
  }

  async cancelTranslation(): Promise<void> {
    try {
      // Clear any active polling interval
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }

      await this.request('clear');
      logger.info('Translation cancelled');
    } catch (error) {
      logger.error(`Failed to cancel translation: ${error}`);
      throw error;
    }
  }

  async checkServerHealth(): Promise<boolean> {
    try {
      const result = await this.request('ping');
      return result === 'pong';
    } catch (error) {
      logger.error(`Server health check failed: ${error}`);
      return false;
    }
  }

  async getServerInfo(): Promise<any> {
    try {
      return await this.request('info');
    } catch (error) {
      logger.error(`Failed to get server info: ${error}`);
      return null;
    }
  }

  async hasActiveTranslation(): Promise<boolean> {
    try {
      const status = await this.request('translation.status');
      return status.status === 'active' || status.status === 'processing';
    } catch (error) {
      // If there's an error getting status, assume no active translation
      return false;
    }
  }
}