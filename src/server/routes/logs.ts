import { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getDataDir } from '../utils/dataDir.js';

export function setupLogsRoutes(fastify: FastifyInstance) {
  fastify.get('/logs', async (request, reply) => {
    try {
      const logFile = path.join(getDataDir(), 'app.log');

      // Check if log file exists
      if (!existsSync(logFile)) {
        return { logs: ['No logs yet...'] };
      }

      // Read the log file
      const content = await fs.readFile(logFile, 'utf-8');
      const allLines = content.split('\n').filter(line => line.trim());

      // Get last 500 lines
      const logs = allLines.slice(-500);

      // Parse and format JSON logs to be more readable
      const formattedLogs = logs.map(line => {
        try {
          const parsed = JSON.parse(line);
          const time = parsed.time ? new Date(parsed.time).toISOString() : '';
          const level = parsed.level === 30 ? 'INFO' : parsed.level === 40 ? 'WARN' : parsed.level === 50 ? 'ERROR' : 'LOG';
          const msg = parsed.msg || '';
          return `[${time}] [${level}] ${msg}`;
        } catch {
          // If not JSON, return as is
          return line;
        }
      });

      return { logs: formattedLogs };
    } catch (error) {
      return { logs: [`Error reading logs: ${error}`] };
    }
  });
}