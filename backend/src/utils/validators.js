/**
 * Input validation utilities for Hacka Discord Dashboard
 * Provides validation functions for Discord-related and common data formats
 * @module utils/validators
 */

/**
 * Regular expression for Discord snowflake IDs
 * Discord snowflakes are 64-bit integers, typically 17-20 digits
 * @constant {RegExp}
 */
const SNOWFLAKE_REGEX = /^\d{17,20}$/;

/**
 * Regular expression for valid email addresses
 * @constant {RegExp}
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Regular expression for valid URLs
 * @constant {RegExp}
 */
const URL_REGEX = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

/**
 * Regular expression for hex color codes
 * Supports 3, 4, 6, and 8 digit formats with optional # prefix
 * @constant {RegExp}
 */
const HEX_COLOR_REGEX = /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3}|[A-Fa-f0-9]{8}|[A-Fa-f0-9]{4})$/;

/**
 * Regular expression for Discord webhook URLs
 * @constant {RegExp}
 */
const DISCORD_WEBHOOK_REGEX = /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/;

/**
 * HTML entities for sanitization
 * @constant {Object}
 */
const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

/**
 * Validate a Discord snowflake ID
 * Snowflakes are 64-bit unsigned integers used as unique identifiers
 * @param {string} id - The ID to validate
 * @returns {boolean} True if valid snowflake, false otherwise
 * @example
 * validateSnowflake('123456789012345678') // true
 * validateSnowflake('invalid') // false
 */
export const validateSnowflake = (id) => {
  if (typeof id !== 'string' && typeof id !== 'number') return false;
  const strId = String(id);
  if (!SNOWFLAKE_REGEX.test(strId)) return false;
  // Ensure it's a valid 64-bit unsigned integer
  const num = BigInt(strId);
  return num > 0n && num <= 18446744073709551615n;
};

/**
 * Validate an email address
 * @param {string} email - The email to validate
 * @returns {boolean} True if valid email, false otherwise
 * @example
 * validateEmail('user@example.com') // true
 * validateEmail('invalid-email') // false
 */
export const validateEmail = (email) => {
  if (typeof email !== 'string') return false;
  if (email.length > 254) return false;
  return EMAIL_REGEX.test(email);
};

/**
 * Validate a URL string
 * @param {string} url - The URL to validate
 * @param {Object} [options] - Validation options
 * @param {boolean} [options.requireProtocol=true] - Require http:// or https://
 * @param {string[]} [options.allowedProtocols] - Allowed protocols (e.g., ['https'])
 * @returns {boolean} True if valid URL, false otherwise
 * @example
 * validateURL('https://example.com') // true
 * validateURL('example.com', { requireProtocol: false }) // true
 */
export const validateURL = (url, options = {}) => {
  const { requireProtocol = true, allowedProtocols } = options;
  
  if (typeof url !== 'string') return false;
  if (url.length > 2048) return false;
  
  if (!URL_REGEX.test(url)) return false;
  
  if (requireProtocol && !/^https?:\/\//i.test(url)) {
    return false;
  }
  
  if (allowedProtocols) {
    const protocol = url.split(':')[0].toLowerCase();
    if (!allowedProtocols.includes(protocol)) {
      return false;
    }
  }
  
  return true;
};

/**
 * Validate a hex color code
 * Supports 3, 4, 6, and 8 digit formats
 * @param {string} color - The color code to validate
 * @returns {boolean} True if valid hex color, false otherwise
 * @example
 * validateHexColor('#FF5733') // true
 * validateHexColor('FF5733') // true
 * validateHexColor('#FFF') // true
 */
export const validateHexColor = (color) => {
  if (typeof color !== 'string') return false;
  return HEX_COLOR_REGEX.test(color);
};

/**
 * Validate a Discord webhook URL
 * @param {string} url - The webhook URL to validate
 * @returns {boolean} True if valid webhook URL, false otherwise
 * @example
 * validateDiscordWebhook('https://discord.com/api/webhooks/123/abc') // true
 */
export const validateDiscordWebhook = (url) => {
  if (typeof url !== 'string') return false;
  return DISCORD_WEBHOOK_REGEX.test(url);
};

/**
 * Validate a username
 * @param {string} username - The username to validate
 * @param {Object} [options] - Validation options
 * @param {number} [options.minLength=2] - Minimum length
 * @param {number} [options.maxLength=32] - Maximum length
 * @param {RegExp} [options.allowedChars] - Allowed character pattern
 * @returns {boolean} True if valid username, false otherwise
 */
export const validateUsername = (username, options = {}) => {
  const { minLength = 2, maxLength = 32, allowedChars = /^[a-zA-Z0-9_\-\s]+$/ } = options;
  
  if (typeof username !== 'string') return false;
  if (username.length < minLength || username.length > maxLength) return false;
  if (!allowedChars.test(username)) return false;
  
  // Check for consecutive spaces or special edge cases
  if (/\s{2,}/.test(username)) return false;
  if (username.trim() !== username) return false;
  
  return true;
};

/**
 * Sanitize input to prevent XSS attacks
 * Escapes HTML special characters
 * @param {string} input - The input string to sanitize
 * @returns {string} Sanitized string
 * @example
 * sanitizeInput('<script>alert("xss")</script>') // '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  
  return input.replace(/[&<>"'\/]/g, (char) => HTML_ENTITIES[char] || char);
};

/**
 * Sanitize an object recursively
 * Applies sanitizeInput to all string values in an object
 * @param {Object} obj - The object to sanitize
 * @returns {Object} Sanitized object
 */
export const sanitizeObject = (obj) => {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

/**
 * Validate a password strength
 * @param {string} password - The password to validate
 * @param {Object} [options] - Validation options
 * @param {number} [options.minLength=8] - Minimum length
 * @param {boolean} [options.requireUppercase=true] - Require uppercase letter
 * @param {boolean} [options.requireLowercase=true] - Require lowercase letter
 * @param {boolean} [options.requireNumbers=true] - Require numeric digit
 * @param {boolean} [options.requireSpecial=true] - Require special character
 * @returns {Object} Validation result with isValid and errors
 * @example
 * validatePassword('StrongP@ss123')
 * // { isValid: true, errors: [], strength: 'strong' }
 */
export const validatePassword = (password, options = {}) => {
  const {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumbers = true,
    requireSpecial = true,
  } = options;
  
  const errors = [];
  
  if (typeof password !== 'string') {
    return { isValid: false, errors: ['Password must be a string'], strength: 'weak' };
  }
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  
  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Calculate strength
  let strength = 'weak';
  if (errors.length === 0) {
    const score = [
      password.length >= 12,
      /[A-Z]/.test(password) && /[a-z]/.test(password),
      /\d/.test(password),
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
      password.length >= 16,
    ].filter(Boolean).length;
    
    if (score >= 4) strength = 'very-strong';
    else if (score >= 3) strength = 'strong';
    else if (score >= 2) strength = 'medium';
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    strength,
  };
};

/**
 * Validate an array of items using a validator function
 * @param {Array} arr - The array to validate
 * @param {Function} validator - Validator function for each item
 * @returns {boolean} True if all items are valid
 */
export const validateArray = (arr, validator) => {
  if (!Array.isArray(arr)) return false;
  return arr.every(item => validator(item));
};

export default {
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
};
