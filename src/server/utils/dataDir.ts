import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDataDir = path.join(__dirname, '../../../data');

export function getDataDir(): string {
  return process.env.DATA_DIR || defaultDataDir;
}
