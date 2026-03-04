/**
 * Utility modules index for Hacka Discord Dashboard
 * Central export point for all utility functions
 * @module utils
 */

export { default as logger, stream, logError, logWarn, logInfo, logDebug, logHttp } from './logger.js';
export { default as validators } from './validators.js';
export {
  validateSnowflake,
  validateEmail,
  validateURL,
  validateHexColor,
  validateDiscordWebhook,
  validateUsername,
  sanitizeInput,
  sanitizeObject,
  validatePassword,
  validateArray,
} from './validators.js';

export { default as formatters } from './formatters.js';
export {
  formatDuration,
  formatDate,
  formatNumber,
  formatRelativeTime,
  truncateString,
  escapeMarkdown,
  snowflakeToDate,
  formatFileSize,
  formatPercentage,
  capitalize,
  toTitleCase,
} from './formatters.js';

export { default as constants } from './constants.js';
export {
  PERMISSIONS,
  DISCORD_LIMITS,
  DEFAULTS,
  TIER_LIMITS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  HTTP_STATUS,
  WS_EVENTS,
  COLORS,
} from './constants.js';

export { default as response } from './response.js';
export {
  STATUS_CODES,
  successResponse,
  errorResponse,
  paginatedResponse,
  createdResponse,
  noContentResponse,
  badRequestResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  conflictResponse,
  validationErrorResponse,
  rateLimitResponse,
  serverErrorResponse,
  asyncHandler,
  ResponseHelper,
} from './response.js';

export { default as cache } from './cache.js';
export {
  generateKey,
  generateGuildKey,
  generateUserKey,
  set,
  get,
  getOrSet,
  has,
  del,
  delPattern,
  clear,
  keys,
  size,
  getStats,
  resetStats,
  cleanup,
  getTTL,
  touch,
  Cache,
  DEFAULT_TTL,
  MAX_CACHE_SIZE,
} from './cache.js';
