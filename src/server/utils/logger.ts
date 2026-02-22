import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Use /app/data in Docker, data/ relative to project root in development
const logDir = fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, '../../../data');
fs.mkdirSync(logDir, { recursive: true });

// Create a write stream to log file
const logStream = fs.createWriteStream(path.join(logDir, 'app.log'), { flags: 'a' });

// Create logger with multiple outputs
export const logger = pino({
  level: 'info',
  timestamp: pino.stdTimeFunctions.isoTime
}, pino.multistream([
  // Console output with pretty printing
  {
    stream: pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    })
  },
  // File output without formatting
  {
    stream: logStream
  }
]));