/**
 * API response utilities for Hacka Discord Dashboard
 * Provides standardized response formatting for API endpoints
 * @module utils/response
 */

/**
 * Standard HTTP status codes
 * @constant {Object}
 */
export const STATUS_CODES = {
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
  GATEWAY_TIMEOUT: 504,
};

/**
 * Create a standardized success response
 * @param {Object} res - Express response object
 * @param {*} [data=null] - Response data
 * @param {string} [message='Success'] - Success message
 * @param {number} [statusCode=200] - HTTP status code
 * @returns {Object} Express response
 * @example
 * successResponse(res, { users: [...] }, 'Users retrieved successfully');
 */
export const successResponse = (res, data = null, message = 'Success', statusCode = STATUS_CODES.OK) => {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString(),
  };

  if (data !== null && data !== undefined) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Create a standardized error response
 * @param {Object} res - Express response object
 * @param {string} [message='An error occurred'] - Error message
 * @param {number} [statusCode=500] - HTTP status code
 * @param {Object|Array} [errors=null] - Additional error details
 * @param {string} [errorCode=null] - Application-specific error code
 * @returns {Object} Express response
 * @example
 * errorResponse(res, 'Validation failed', 400, [{ field: 'email', message: 'Invalid email' }]);
 */
export const errorResponse = (res, message = 'An error occurred', statusCode = STATUS_CODES.INTERNAL_SERVER_ERROR, errors = null, errorCode = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };

  if (errorCode) {
    response.errorCode = errorCode;
  }

  if (errors) {
    response.errors = errors;
  }

  // Ensure status code is valid
  const validStatusCode = Object.values(STATUS_CODES).includes(statusCode) 
    ? statusCode 
    : STATUS_CODES.INTERNAL_SERVER_ERROR;

  return res.status(validStatusCode).json(response);
};

/**
 * Create a paginated response
 * @param {Object} res - Express response object
 * @param {Array} data - Array of items for current page
 * @param {Object} pagination - Pagination metadata
 * @param {number} pagination.page - Current page number
 * @param {number} pagination.limit - Items per page
 * @param {number} pagination.total - Total number of items
 * @param {string} [message='Data retrieved successfully'] - Success message
 * @returns {Object} Express response
 * @example
 * paginatedResponse(res, users, { page: 1, limit: 10, total: 100 });
 */
export const paginatedResponse = (res, data, pagination, message = 'Data retrieved successfully') => {
  const { page, limit, total } = pagination;
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return res.status(STATUS_CODES.OK).json({
    success: true,
    message,
    timestamp: new Date().toISOString(),
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? page + 1 : null,
      prevPage: hasPrevPage ? page - 1 : null,
    },
  });
};

/**
 * Create a created resource response
 * @param {Object} res - Express response object
 * @param {*} data - Created resource data
 * @param {string} [message='Resource created successfully'] - Success message
 * @returns {Object} Express response
 * @example
 * createdResponse(res, newUser, 'User created successfully');
 */
export const createdResponse = (res, data, message = 'Resource created successfully') => {
  return successResponse(res, data, message, STATUS_CODES.CREATED);
};

/**
 * Create a no content response (for deletions)
 * @param {Object} res - Express response object
 * @returns {Object} Express response
 * @example
 * noContentResponse(res);
 */
export const noContentResponse = (res) => {
  return res.status(STATUS_CODES.NO_CONTENT).send();
};

/**
 * Create a bad request error response
 * @param {Object} res - Express response object
 * @param {string} [message='Bad request'] - Error message
 * @param {Object|Array} [errors=null] - Validation errors
 * @returns {Object} Express response
 * @example
 * badRequestResponse(res, 'Invalid input', [{ field: 'name', message: 'Required' }]);
 */
export const badRequestResponse = (res, message = 'Bad request', errors = null) => {
  return errorResponse(res, message, STATUS_CODES.BAD_REQUEST, errors, 'BAD_REQUEST');
};

/**
 * Create an unauthorized error response
 * @param {Object} res - Express response object
 * @param {string} [message='Unauthorized'] - Error message
 * @returns {Object} Express response
 * @example
 * unauthorizedResponse(res, 'Invalid credentials');
 */
export const unauthorizedResponse = (res, message = 'Unauthorized') => {
  return errorResponse(res, message, STATUS_CODES.UNAUTHORIZED, null, 'UNAUTHORIZED');
};

/**
 * Create a forbidden error response
 * @param {Object} res - Express response object
 * @param {string} [message='Forbidden'] - Error message
 * @returns {Object} Express response
 * @example
 * forbiddenResponse(res, 'Insufficient permissions');
 */
export const forbiddenResponse = (res, message = 'Forbidden') => {
  return errorResponse(res, message, STATUS_CODES.FORBIDDEN, null, 'FORBIDDEN');
};

/**
 * Create a not found error response
 * @param {Object} res - Express response object
 * @param {string} [message='Resource not found'] - Error message
 * @returns {Object} Express response
 * @example
 * notFoundResponse(res, 'User not found');
 */
export const notFoundResponse = (res, message = 'Resource not found') => {
  return errorResponse(res, message, STATUS_CODES.NOT_FOUND, null, 'NOT_FOUND');
};

/**
 * Create a conflict error response
 * @param {Object} res - Express response object
 * @param {string} [message='Resource already exists'] - Error message
 * @returns {Object} Express response
 * @example
 * conflictResponse(res, 'Email already registered');
 */
export const conflictResponse = (res, message = 'Resource already exists') => {
  return errorResponse(res, message, STATUS_CODES.CONFLICT, null, 'CONFLICT');
};

/**
 * Create a validation error response
 * @param {Object} res - Express response object
 * @param {Array} errors - Array of validation error objects
 * @param {string} [message='Validation failed'] - Error message
 * @returns {Object} Express response
 * @example
 * validationErrorResponse(res, [
 *   { field: 'email', message: 'Invalid email format' },
 *   { field: 'password', message: 'Too short' }
 * ]);
 */
export const validationErrorResponse = (res, errors, message = 'Validation failed') => {
  return errorResponse(res, message, STATUS_CODES.UNPROCESSABLE_ENTITY, errors, 'VALIDATION_ERROR');
};

/**
 * Create a rate limit error response
 * @param {Object} res - Express response object
 * @param {number} retryAfter - Seconds until retry is allowed
 * @param {string} [message='Too many requests'] - Error message
 * @returns {Object} Express response
 * @example
 * rateLimitResponse(res, 60, 'Rate limit exceeded');
 */
export const rateLimitResponse = (res, retryAfter, message = 'Too many requests') => {
  const response = {
    success: false,
    message,
    retryAfter,
    timestamp: new Date().toISOString(),
    errorCode: 'RATE_LIMITED',
  };

  return res.status(STATUS_CODES.TOO_MANY_REQUESTS).json(response);
};

/**
 * Create a server error response
 * @param {Object} res - Express response object
 * @param {string} [message='Internal server error'] - Error message
 * @param {Error} [error=null] - Error object (only logged, not sent)
 * @returns {Object} Express response
 * @example
 * serverErrorResponse(res, 'Database connection failed', error);
 */
export const serverErrorResponse = (res, message = 'Internal server error', error = null) => {
  // Log the actual error for debugging
  if (error) {
    console.error('Server error:', error);
  }

  return errorResponse(res, message, STATUS_CODES.INTERNAL_SERVER_ERROR, null, 'INTERNAL_ERROR');
};

/**
 * Async handler wrapper for Express controllers
 * Automatically catches errors and passes them to next()
 * @param {Function} fn - Async controller function
 * @returns {Function} Express middleware function
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await User.find();
 *   successResponse(res, users);
 * }));
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Response helper class for more object-oriented approach
 * Can be extended or used as a mixin
 */
export class ResponseHelper {
  constructor(res) {
    this.res = res;
  }

  success(data, message, statusCode) {
    return successResponse(this.res, data, message, statusCode);
  }

  error(message, statusCode, errors, errorCode) {
    return errorResponse(this.res, message, statusCode, errors, errorCode);
  }

  paginated(data, pagination, message) {
    return paginatedResponse(this.res, data, pagination, message);
  }

  created(data, message) {
    return createdResponse(this.res, data, message);
  }

  noContent() {
    return noContentResponse(this.res);
  }

  badRequest(message, errors) {
    return badRequestResponse(this.res, message, errors);
  }

  unauthorized(message) {
    return unauthorizedResponse(this.res, message);
  }

  forbidden(message) {
    return forbiddenResponse(this.res, message);
  }

  notFound(message) {
    return notFoundResponse(this.res, message);
  }

  conflict(message) {
    return conflictResponse(this.res, message);
  }

  validationError(errors, message) {
    return validationErrorResponse(this.res, errors, message);
  }

  rateLimit(retryAfter, message) {
    return rateLimitResponse(this.res, retryAfter, message);
  }

  serverError(message, error) {
    return serverErrorResponse(this.res, message, error);
  }
}

export default {
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
};
