export interface TranslatorService {
  translate(options: {
    subtitlePath: string;
    targetLanguage: string;
    context: string;
    streamId?: number;
    sourceLanguage?: string;
    onProgress: (progress: number) => void;
    signal: AbortSignal;
  }): Promise<string>; // returns path to translated SRT file
}
