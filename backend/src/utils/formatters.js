/**
 * Data formatting utilities for Hacka Discord Dashboard
 * Provides formatting functions for dates, numbers, durations, and Discord-specific content
 * @module utils/formatters
 */

/**
 * Time units in milliseconds
 * @constant {Object}
 */
const TIME_UNITS = {
  year: 365.25 * 24 * 60 * 60 * 1000,
  month: 30.44 * 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  hour: 60 * 60 * 1000,
  minute: 60 * 1000,
  second: 1000,
};

/**
 * Number suffixes for compact notation
 * @constant {Array}
 */
const NUMBER_SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Q'];

/**
 * Discord markdown escape characters
 * @constant {Array}
 */
const MARKDOWN_CHARS = ['\\', '`', '*', '_', '{', '}', '[', ']', '(', ')', '#', '+', '-', '.', '!', '|'];

/**
 * Format milliseconds into a readable duration string
 * @param {number} ms - Duration in milliseconds
 * @param {Object} [options] - Formatting options
 * @param {boolean} [options.compact=false] - Use compact format (e.g., "2d 5h")
 * @param {number} [options.maxUnits=2] - Maximum number of time units to display
 * @param {boolean} [options.showSeconds=true] - Include seconds in output
 * @returns {string} Formatted duration string
 * @example
 * formatDuration(90061000) // "1 day, 1 hour, 1 minute, 1 second"
 * formatDuration(90061000, { compact: true }) // "1d 1h 1m 1s"
 */
export const formatDuration = (ms, options = {}) => {
  const { compact = false, maxUnits = 2, showSeconds = true } = options;
  
  if (typeof ms !== 'number' || ms < 0) return compact ? '0s' : '0 seconds';
  if (ms === 0) return compact ? '0s' : '0 seconds';
  
  const units = [];
  let remaining = ms;
  
  for (const [unit, value] of Object.entries(TIME_UNITS)) {
    if (unit === 'second' && !showSeconds) continue;
    
    const count = Math.floor(remaining / value);
    if (count > 0) {
      units.push({ unit, count });
      remaining %= value;
    }
  }
  
  if (units.length === 0) {
    return compact ? '0s' : '0 seconds';
  }
  
  const limitedUnits = units.slice(0, maxUnits);
  
  if (compact) {
    return limitedUnits
      .map(({ unit, count }) => `${count}${unit.charAt(0)}`)
      .join(' ');
  }
  
  return limitedUnits
    .map(({ unit, count }) => {
      const plural = count !== 1 ? 's' : '';
      return `${count} ${unit}${plural}`;
    })
    .join(', ');
};

/**
 * Format a date into a readable string
 * @param {Date|string|number} date - The date to format
 * @param {Object} [options] - Formatting options
 * @param {string} [options.format='full'] - Format type: 'full', 'short', 'time', 'date'
 * @param {string} [options.locale='en-US'] - Locale for formatting
 * @returns {string} Formatted date string
 * @example
 * formatDate(new Date()) // "December 20, 2024 at 3:30:45 PM"
 * formatDate(new Date(), { format: 'short' }) // "Dec 20, 2024"
 */
export const formatDate = (date, options = {}) => {
  const { format = 'full', locale = 'en-US' } = options;
  
  const d = date instanceof Date ? date : new Date(date);
  
  if (isNaN(d.getTime())) return 'Invalid date';
  
  const formatters = {
    full: new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    short: new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    date: new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }),
    time: new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    iso: () => d.toISOString(),
  };
  
  const formatter = formatters[format];
  if (!formatter) return d.toString();
  
  return typeof formatter === 'function' ? formatter() : formatter.format(d);
};

/**
 * Format a number with appropriate separators and notation
 * @param {number} num - The number to format
 * @param {Object} [options] - Formatting options
 * @param {boolean} [options.compact=false] - Use compact notation (e.g., 1.2K)
 * @param {number} [options.decimals=0] - Number of decimal places
 * @param {string} [options.locale='en-US'] - Locale for formatting
 * @returns {string} Formatted number string
 * @example
 * formatNumber(1234567) // "1,234,567"
 * formatNumber(1234567, { compact: true }) // "1.2M"
 * formatNumber(1234.567, { decimals: 2 }) // "1,234.57"
 */
export const formatNumber = (num, options = {}) => {
  const { compact = false, decimals = 0, locale = 'en-US' } = options;
  
  if (typeof num !== 'number' || isNaN(num)) return '0';
  
  if (compact) {
    const absNum = Math.abs(num);
    const tier = Math.floor(Math.log10(absNum) / 3);
    
    if (tier === 0) return num.toString();
    
    const suffix = NUMBER_SUFFIXES[tier] || '';
    const scale = Math.pow(10, tier * 3);
    const scaled = num / scale;
    
    return `${scaled.toFixed(decimals).replace(/\.?0+$/, '')}${suffix}`;
  }
  
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

/**
 * Format a date as relative time (e.g., "2 hours ago")
 * @param {Date|string|number} date - The date to format
 * @param {Object} [options] - Formatting options
 * @param {string} [options.locale='en-US'] - Locale for formatting
 * @param {string} [options.style='long'] - Style: 'long' or 'short'
 * @returns {string} Relative time string
 * @example
 * formatRelativeTime(new Date(Date.now() - 3600000)) // "1 hour ago"
 */
export const formatRelativeTime = (date, options = {}) => {
  const { locale = 'en-US', style = 'long' } = options;
  
  const d = date instanceof Date ? date : new Date(date);
  
  if (isNaN(d.getTime())) return 'Invalid date';
  
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);
  
  const rtf = new Intl.RelativeTimeFormat(locale, { style });
  
  if (diffSeconds < 60) {
    return rtf.format(-diffSeconds, 'second');
  } else if (diffMinutes < 60) {
    return rtf.format(-diffMinutes, 'minute');
  } else if (diffHours < 24) {
    return rtf.format(-diffHours, 'hour');
  } else if (diffDays < 7) {
    return rtf.format(-diffDays, 'day');
  } else if (diffWeeks < 4) {
    return rtf.format(-diffWeeks, 'week');
  } else if (diffMonths < 12) {
    return rtf.format(-diffMonths, 'month');
  } else {
    return rtf.format(-diffYears, 'year');
  }
};

/**
 * Truncate a string to a specified length
 * @param {string} str - The string to truncate
 * @param {number} [maxLength=100] - Maximum length
 * @param {string} [suffix='...'] - Suffix to add when truncated
 * @returns {string} Truncated string
 * @example
 * truncateString('Hello World', 5) // "Hello..."
 */
export const truncateString = (str, maxLength = 100, suffix = '...') => {
  if (typeof str !== 'string') return '';
  if (str.length <= maxLength) return str;
  
  const truncateAt = maxLength - suffix.length;
  if (truncateAt <= 0) return suffix.slice(0, maxLength);
  
  return str.slice(0, truncateAt) + suffix;
};

/**
 * Escape Discord markdown characters in a string
 * @param {string} text - The text to escape
 * @returns {string} Escaped text safe for Discord
 * @example
 * escapeMarkdown('**bold**') // "\\*\\*bold\\*\\*"
 */
export const escapeMarkdown = (text) => {
  if (typeof text !== 'string') return '';
  
  return text.replace(new RegExp(`[${MARKDOWN_CHARS.map(c => '\\' + c).join('')}]`, 'g'), '\\$&');
};

/**
 * Convert a Discord snowflake to a timestamp
 * @param {string} snowflake - Discord snowflake ID
 * @returns {Date|null} Date object or null if invalid
 * @example
 * snowflakeToDate('123456789012345678') // Date object
 */
export const snowflakeToDate = (snowflake) => {
  if (!/^\d{17,20}$/.test(String(snowflake))) return null;
  
  const timestamp = Number(BigInt(snowflake) >> 22n) + 1420070400000;
  return new Date(timestamp);
};

/**
 * Format file size in human-readable format
 * @param {number} bytes - Size in bytes
 * @param {number} [decimals=2] - Number of decimal places
 * @returns {string} Formatted file size
 * @example
 * formatFileSize(1536) // "1.5 KB"
 */
export const formatFileSize = (bytes, decimals = 2) => {
  if (typeof bytes !== 'number' || bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};

/**
 * Format a percentage value
 * @param {number} value - The value to format
 * @param {number} [decimals=1] - Number of decimal places
 * @returns {string} Formatted percentage
 * @example
 * formatPercentage(0.8567) // "85.7%"
 */
export const formatPercentage = (value, decimals = 1) => {
  if (typeof value !== 'number' || isNaN(value)) return '0%';
  
  const percentage = value * 100;
  return `${percentage.toFixed(decimals)}%`;
};

/**
 * Capitalize the first letter of a string
 * @param {string} str - The string to capitalize
 * @returns {string} Capitalized string
 * @example
 * capitalize('hello world') // "Hello world"
 */
export const capitalize = (str) => {
  if (typeof str !== 'string' || str.length === 0) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Convert a string to title case
 * @param {string} str - The string to convert
 * @returns {string} Title-cased string
 * @example
 * toTitleCase('hello world') // "Hello World"
 */
export const toTitleCase = (str) => {
  if (typeof str !== 'string') return '';
  
  return str
    .toLowerCase()
    .replace(/(?:^|\s)\w/g, match => match.toUpperCase());
};

export default {
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
};
