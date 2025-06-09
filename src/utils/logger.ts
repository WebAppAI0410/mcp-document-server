import pino from 'pino';
import { config } from '../config';
import fs from 'fs';
import path from 'path';

// Ensure log directory exists
const logDir = path.dirname(config.logging.file);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const targets: pino.TransportTargetOptions[] = [
  {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'yyyy-mm-dd HH:MM:ss',
    },
  },
];

// Add file transport in production
if (config.server.nodeEnv === 'production') {
  targets.push({
    target: 'pino/file',
    options: {
      destination: config.logging.file,
    },
  });
}

export const logger = pino({
  level: config.logging.level,
  transport: {
    targets,
  },
});