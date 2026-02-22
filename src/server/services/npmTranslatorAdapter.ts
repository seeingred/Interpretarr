import { translate, extractSubtitle } from 'ai-sub-translator';
import { readFileSync, writeFileSync } from 'fs';
import { TranslatorService } from './translatorService.js';
import { SettingsService } from './settings.js';
import path from 'path';

export class NpmTranslatorAdapter implements TranslatorService {
  constructor(private settings: SettingsService) {}

  async translate(options: {
    subtitlePath: string;
    targetLanguage: string;
    context: string;
    streamId?: number;
    onProgress: (progress: number) => void;
    signal: AbortSignal;
  }): Promise<string> {
    const apiKey = this.settings.getSetting('geminiApiKey');
    const model = this.settings.getSetting('geminiModel') || 'gemini-2.0-flash';
    const batchSize = parseInt(this.settings.getSetting('batchSize') || '50', 10);

    if (!apiKey) throw new Error('Gemini API key not configured');

    let subtitleContent: string;
    if (options.streamId !== undefined) {
      subtitleContent = await extractSubtitle(options.subtitlePath, options.streamId);
    } else {
      subtitleContent = readFileSync(options.subtitlePath, 'utf-8');
    }

    const result = await translate({
      text: subtitleContent,
      targetLanguage: options.targetLanguage,
      apiKey,
      model,
      batchSize,
      context: options.context,
      onProgress: options.onProgress,
      signal: options.signal,
    });

    // Save output file next to the source video/subtitle
    const ext = path.extname(options.subtitlePath);
    const base = options.subtitlePath.slice(0, -ext.length);
    const outputPath = `${base}.${options.targetLanguage}.srt`;
    writeFileSync(outputPath, result.translatedText, 'utf-8');

    return outputPath;
  }
}
