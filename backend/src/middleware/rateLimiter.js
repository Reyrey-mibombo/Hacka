import rateLimit from 'express-rate-limit';

const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    message = 'Too many requests, please try again later.',
    keyGenerator = null,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    standardHeaders = true,
    legacyHeaders = false
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: 'Too Many Requests',
      message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    keyGenerator: keyGenerator || ((req) => req.ip),
    skipSuccessfulRequests,
    skipFailedRequests,
    standardHeaders,
    legacyHeaders,
    handler: (req, res, next, options) => {
      res.status(429).json(options.message);
    }
  });
};

export const generalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});

export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts, please try again later.'
});

export const loginLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again after an hour.'
});

export const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'API rate limit exceeded, please slow down your requests.'
});

export const dashboardLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Dashboard rate limit exceeded, please slow down.'
});

export const webhookLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Webhook rate limit exceeded.'
});

export const discordApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Discord API proxy rate limit exceeded, please slow down.'
});

export const strictLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'This endpoint has strict rate limiting, please slow down.'
});

export const createCustomLimiter = (windowMinutes, maxRequests, customMessage) => {
  return createRateLimiter({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    message: customMessage || `Rate limit: ${maxRequests} requests per ${windowMinutes} minutes`
  });
};

export const userSpecificLimiter = (windowMs, maxRequests) => {
  return createRateLimiter({
    windowMs,
    max: maxRequests,
    keyGenerator: (req) => {
      const userId = req.user?.id;
      const ip = req.ip;
      return userId ? `user:${userId}` : `ip:${ip}`;
    },
    message: `Rate limit: ${maxRequests} requests per ${Math.ceil(windowMs / 60000)} minutes`
  });
};

export const guildSpecificLimiter = (windowMs, maxRequests) => {
  return createRateLimiter({
    windowMs,
    max: maxRequests,
    keyGenerator: (req) => {
      const guildId = req.params.guildId || req.body.guildId;
      const userId = req.user?.id;
      return guildId && userId ? `guild:${guildId}:user:${userId}` : `ip:${req.ip}`;
    },
    message: `Guild rate limit: ${maxRequests} requests per ${Math.ceil(windowMs / 60000)} minutes`
  });
};

export const skipInDevelopment = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  return generalLimiter(req, res, next);
};

export const skipForAuthenticated = (limiter) => {
  return (req, res, next) => {
    if (req.user?.id) {
      return next();
    }
    return limiter(req, res, next);
  };
};

export const bypassForAdmins = (limiter) => {
  return (req, res, next) => {
    if (req.permissions?.isAdministrator) {
      return next();
    }
    return limiter(req, res, next);
  };
};

export default {
  generalLimiter,
  authLimiter,
  loginLimiter,
  apiLimiter,
  dashboardLimiter,
  webhookLimiter,
  discordApiLimiter,
  strictLimiter,
  createCustomLimiter,
  userSpecificLimiter,
  guildSpecificLimiter,
  skipInDevelopment,
  skipForAuthenticated,
  bypassForAdmins
};
