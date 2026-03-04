/**
 * Logger utility for Hacka Discord Dashboard
 * Provides formatted logging with multiple transports and log levels
 * @module utils/logger
 */

import { createLogger, format, transports, addColors } from 'winston';

/**
 * Custom color palette for log levels
 * @constant {Object}
 */
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'cyan',
  http: 'magenta',
};

addColors(colors);

/**
 * Log format configuration
 * Combines timestamp, colorization, and custom formatting
 */
const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.splat(),
  format.json()
);

/**
 * Console format for development
 * Includes colors and simplified output
 */
const consoleFormat = format.combine(
  format.colorize({ all: true }),
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(({ level, message, timestamp, stack, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    if (stack) {
      msg += `\n${stack}`;
    }
    return msg;
  })
);

/**
 * Create Winston logger instance
 * @type {import('winston').Logger}
 */
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'hacka-discord-dashboard' },
  transports: [
    // Console transport for all environments
    new transports.Console({
      format: consoleFormat,
    }),
    // File transport for error logs
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: logFormat,
    }),
    // File transport for combined logs
    new transports.File({
      filename: 'logs/combined.log',
      format: logFormat,
    }),
  ],
  // Don't exit on handled exceptions
  exitOnError: false,
});

/**
 * Stream object for Morgan HTTP logging integration
 * @type {Object}
 */
export const stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

/**
 * Log an error message
 * @param {string} message - The message to log
 * @param {Object} [metadata] - Additional metadata to include
 * @returns {void}
 */
export const logError = (message, metadata = {}) => {
  logger.error(message, metadata);
};

/**
 * Log a warning message
 * @param {string} message - The message to log
 * @param {Object} [metadata] - Additional metadata to include
 * @returns {void}
 */
export const logWarn = (message, metadata = {}) => {
  logger.warn(message, metadata);
};

/**
 * Log an info message
 * @param {string} message - The message to log
 * @param {Object} [metadata] - Additional metadata to include
 * @returns {void}
 */
export const logInfo = (message, metadata = {}) => {
  logger.info(message, metadata);
};

/**
 * Log a debug message
 * @param {string} message - The message to log
 * @param {Object} [metadata] - Additional metadata to include
 * @returns {void}
 */
export const logDebug = (message, metadata = {}) => {
  logger.debug(message, metadata);
};

/**
 * Log an HTTP request message
 * @param {string} message - The message to log
 * @param {Object} [metadata] - Additional metadata to include
 * @returns {void}
 */
export const logHttp = (message, metadata = {}) => {
  logger.http(message, metadata);
};

export default logger;
