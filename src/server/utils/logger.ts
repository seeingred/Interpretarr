import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { getDataDir } from './dataDir.js';

const logDir = getDataDir();
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