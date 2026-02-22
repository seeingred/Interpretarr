import { initializeFFmpeg } from 'ai-sub-translator';
import { getDataDir } from '../utils/dataDir.js';
import path from 'path';

type FFmpegStatus =
  | { state: 'idle' }
  | { state: 'downloading'; progress: number }
  | { state: 'ready'; path: string }
  | { state: 'error'; message: string };

let status: FFmpegStatus = { state: 'idle' };
const listeners = new Set<(s: FFmpegStatus) => void>();

export function getFfmpegStatus(): FFmpegStatus {
  return status;
}

export function onFfmpegStatus(cb: (s: FFmpegStatus) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function setStatus(s: FFmpegStatus) {
  status = s;
  listeners.forEach(cb => cb(s));
}

export function getFfmpegDir(): string {
  return path.join(getDataDir(), 'ffmpeg');
}

export async function startFfmpegDownload(): Promise<void> {
  const ffmpegDir = getFfmpegDir();
  setStatus({ state: 'downloading', progress: 0 });
  try {
    const execPath = await initializeFFmpeg({
      outputDir: ffmpegDir,
      onProgress: (p) => setStatus({ state: 'downloading', progress: p }),
    });
    setStatus({ state: 'ready', path: execPath });
  } catch (err: any) {
    setStatus({ state: 'error', message: err.message });
  }
}
