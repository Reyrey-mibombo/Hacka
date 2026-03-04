/**
 * Application constants for Hacka Discord Dashboard
 * Provides centralized configuration values, limits, and error messages
 * @module utils/constants
 */

/**
 * Discord permission flags
 * Bitwise permission values as defined by Discord API
 * @constant {Object}
 * @see {@link https://discord.com/developers/docs/topics/permissions}
 */
export const PERMISSIONS = {
  CREATE_INSTANT_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  ADD_REACTIONS: 1n << 6n,
  VIEW_AUDIT_LOG: 1n << 7n,
  PRIORITY_SPEAKER: 1n << 8n,
  STREAM: 1n << 9n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  SEND_TTS_MESSAGES: 1n << 12n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  MENTION_EVERYONE: 1n << 17n,
  USE_EXTERNAL_EMOJIS: 1n << 18n,
  VIEW_GUILD_INSIGHTS: 1n << 19n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  DEAFEN_MEMBERS: 1n << 23n,
  MOVE_MEMBERS: 1n << 24n,
  USE_VAD: 1n << 25n,
  CHANGE_NICKNAME: 1n << 26n,
  MANAGE_NICKNAMES: 1n << 27n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_WEBHOOKS: 1n << 29n,
  MANAGE_GUILD_EXPRESSIONS: 1n << 30n,
  USE_APPLICATION_COMMANDS: 1n << 31n,
  REQUEST_TO_SPEAK: 1n << 32n,
  MANAGE_EVENTS: 1n << 33n,
  MANAGE_THREADS: 1n << 34n,
  CREATE_PUBLIC_THREADS: 1n << 35n,
  CREATE_PRIVATE_THREADS: 1n << 36n,
  USE_EXTERNAL_STICKERS: 1n << 37n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
  USE_EMBEDDED_ACTIVITIES: 1n << 39n,
  MODERATE_MEMBERS: 1n << 40n,
  VIEW_CREATOR_MONETIZATION_ANALYTICS: 1n << 41n,
  USE_SOUNDBOARD: 1n << 42n,
  CREATE_GUILD_EXPRESSIONS: 1n << 43n,
  CREATE_EVENTS: 1n << 44n,
  USE_EXTERNAL_SOUNDS: 1n << 45n,
  SEND_VOICE_MESSAGES: 1n << 46n,
  SEND_POLLS: 1n << 49n,
  USE_EXTERNAL_APPS: 1n << 50n,
};

/**
 * Discord API rate limits and size constraints
 * @constant {Object}
 * @see {@link https://discord.com/developers/docs/topics/rate-limits}
 */
export const DISCORD_LIMITS = {
  // Message limits
  MAX_MESSAGE_LENGTH: 2000,
  MAX_EMBED_TITLE_LENGTH: 256,
  MAX_EMBED_DESCRIPTION_LENGTH: 4096,
  MAX_EMBED_FIELDS: 25,
  MAX_EMBED_FIELD_NAME_LENGTH: 256,
  MAX_EMBED_FIELD_VALUE_LENGTH: 1024,
  MAX_EMBED_FOOTER_LENGTH: 2048,
  MAX_EMBED_AUTHOR_NAME_LENGTH: 256,
  MAX_TOTAL_EMBED_LENGTH: 6000,
  
  // Webhook limits
  MAX_WEBHOOK_NAME_LENGTH: 80,
  
  // User/Guild limits
  MAX_USERNAME_LENGTH: 32,
  MAX_GUILD_NAME_LENGTH: 100,
  MAX_CHANNEL_NAME_LENGTH: 100,
  MAX_ROLE_NAME_LENGTH: 100,
  MAX_NICKNAME_LENGTH: 32,
  
  // File uploads
  MAX_FILE_SIZE_DEFAULT: 25 * 1024 * 1024, // 25 MB
  MAX_FILE_SIZE_BOOST_TIER_1: 25 * 1024 * 1024,
  MAX_FILE_SIZE_BOOST_TIER_2: 50 * 1024 * 1024,
  MAX_FILE_SIZE_BOOST_TIER_3: 100 * 1024 * 1024,
  
  // Rate limits (requests per second)
  GLOBAL_RATE_LIMIT: 50,
  WEBHOOK_RATE_LIMIT: 5,
};

/**
 * Default configuration values
 * @constant {Object}
 */
export const DEFAULTS = {
  // Server settings
  DEFAULT_PREFIX: '!',
  DEFAULT_LANGUAGE: 'en',
  DEFAULT_TIMEZONE: 'UTC',
  
  // Pagination
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  
  // Cache
  DEFAULT_CACHE_TTL: 300, // 5 minutes
  MAX_CACHE_TTL: 86400, // 24 hours
  
  // Logging
  DEFAULT_LOG_LEVEL: 'info',
  MAX_LOG_RETENTION_DAYS: 30,
  
  // Moderation
  DEFAULT_WARN_EXPIRY_DAYS: 30,
  MAX_WARN_EXPIRY_DAYS: 365,
  DEFAULT_MUTE_DURATION: 600, // 10 minutes in seconds
  MAX_MUTE_DURATION: 2419200, // 28 days in seconds
  
  // Economy
  DEFAULT_CURRENCY_NAME: 'coins',
  DEFAULT_CURRENCY_SYMBOL: '🪙',
  DEFAULT_DAILY_REWARD: 100,
  DEFAULT_WEEKLY_REWARD: 500,
};

/**
 * Subscription tier limits and features
 * @constant {Object}
 */
export const TIER_LIMITS = {
  FREE: {
    name: 'Free',
    maxGuilds: 1,
    maxCustomCommands: 10,
    maxReactionRoles: 5,
    maxAutoModerationRules: 3,
    maxWelcomeMessages: 1,
    maxLogChannels: 1,
    maxBackups: 0,
    customBotName: false,
    prioritySupport: false,
    analyticsRetentionDays: 7,
  },
  BASIC: {
    name: 'Basic',
    maxGuilds: 3,
    maxCustomCommands: 50,
    maxReactionRoles: 20,
    maxAutoModerationRules: 10,
    maxWelcomeMessages: 3,
    maxLogChannels: 3,
    maxBackups: 5,
    customBotName: true,
    prioritySupport: false,
    analyticsRetentionDays: 30,
  },
  PREMIUM: {
    name: 'Premium',
    maxGuilds: 10,
    maxCustomCommands: 200,
    maxReactionRoles: 100,
    maxAutoModerationRules: 50,
    maxWelcomeMessages: 10,
    maxLogChannels: 10,
    maxBackups: 20,
    customBotName: true,
    prioritySupport: true,
    analyticsRetentionDays: 90,
  },
  ENTERPRISE: {
    name: 'Enterprise',
    maxGuilds: Infinity,
    maxCustomCommands: Infinity,
    maxReactionRoles: Infinity,
    maxAutoModerationRules: Infinity,
    maxWelcomeMessages: Infinity,
    maxLogChannels: Infinity,
    maxBackups: 100,
    customBotName: true,
    prioritySupport: true,
    analyticsRetentionDays: 365,
  },
};

/**
 * Standardized error messages
 * @constant {Object}
 */
export const ERROR_MESSAGES = {
  // Authentication errors
  UNAUTHORIZED: 'You are not authorized to perform this action',
  FORBIDDEN: 'You do not have permission to access this resource',
  INVALID_TOKEN: 'Invalid or expired authentication token',
  INVALID_CREDENTIALS: 'Invalid email or password',
  ACCOUNT_DISABLED: 'This account has been disabled',
  
  // Validation errors
  INVALID_INPUT: 'Invalid input provided',
  MISSING_REQUIRED_FIELD: 'Missing required field',
  INVALID_FORMAT: 'Invalid data format',
  VALUE_TOO_LONG: 'Value exceeds maximum length',
  VALUE_TOO_SHORT: 'Value is below minimum length',
  INVALID_EMAIL: 'Invalid email address format',
  INVALID_URL: 'Invalid URL format',
  INVALID_DISCORD_ID: 'Invalid Discord ID format',
  INVALID_COLOR: 'Invalid color code',
  
  // Resource errors
  NOT_FOUND: 'The requested resource was not found',
  ALREADY_EXISTS: 'This resource already exists',
  CONFLICT: 'Resource conflict occurred',
  GONE: 'This resource is no longer available',
  
  // Rate limiting
  RATE_LIMITED: 'Too many requests, please try again later',
  
  // Discord API errors
  DISCORD_API_ERROR: 'Discord API returned an error',
  DISCORD_UNAVAILABLE: 'Discord service is currently unavailable',
  INSUFFICIENT_PERMISSIONS: 'Bot lacks required permissions',
  
  // Server errors
  INTERNAL_ERROR: 'An internal server error occurred',
  SERVICE_UNAVAILABLE: 'Service is temporarily unavailable',
  DATABASE_ERROR: 'Database operation failed',
  CACHE_ERROR: 'Cache operation failed',
  
  // Feature limits
  TIER_LIMIT_REACHED: 'You have reached your tier limit for this feature',
  FEATURE_NOT_AVAILABLE: 'This feature is not available on your tier',
};

/**
 * Success messages
 * @constant {Object}
 */
export const SUCCESS_MESSAGES = {
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',
  SAVED: 'Changes saved successfully',
  SYNCED: 'Data synchronized successfully',
  CONNECTED: 'Connected successfully',
  DISCONNECTED: 'Disconnected successfully',
};

/**
 * HTTP status codes
 * @constant {Object}
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
};

/**
 * WebSocket event names
 * @constant {Object}
 */
export const WS_EVENTS = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  
  // Guild events
  GUILD_UPDATE: 'guild:update',
  GUILD_DELETE: 'guild:delete',
  MEMBER_JOIN: 'member:join',
  MEMBER_LEAVE: 'member:leave',
  MEMBER_UPDATE: 'member:update',
  
  // Message events
  MESSAGE_CREATE: 'message:create',
  MESSAGE_UPDATE: 'message:update',
  MESSAGE_DELETE: 'message:delete',
  
  // Moderation events
  BAN_ADD: 'ban:add',
  BAN_REMOVE: 'ban:remove',
  MUTE_ADD: 'mute:add',
  MUTE_REMOVE: 'mute:remove',
  WARN_ADD: 'warn:add',
  
  // Dashboard events
  SETTINGS_UPDATE: 'settings:update',
  COMMAND_EXECUTE: 'command:execute',
  BACKUP_CREATE: 'backup:create',
  BACKUP_RESTORE: 'backup:restore',
};

/**
 * Colors for embeds (hex values)
 * @constant {Object}
 */
export const COLORS = {
  PRIMARY: 0x5865F2,      // Discord blurple
  SUCCESS: 0x57F287,      // Green
  WARNING: 0xFEE75C,      // Yellow
  ERROR: 0xED4245,        // Red
  INFO: 0x5865F2,         // Blurple
  DEFAULT: 0x36393F,      // Dark gray
  
  // Additional colors
  WHITE: 0xFFFFFF,
  BLACK: 0x000000,
  RED: 0xED4245,
  ORANGE: 0xF25C54,
  YELLOW: 0xFEE75C,
  GREEN: 0x57F287,
  BLUE: 0x3498DB,
  PURPLE: 0x9B59B6,
  PINK: 0xEB459E,
};

export default {
  PERMISSIONS,
  DISCORD_LIMITS,
  DEFAULTS,
  TIER_LIMITS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  HTTP_STATUS,
  WS_EVENTS,
  COLORS,
};
