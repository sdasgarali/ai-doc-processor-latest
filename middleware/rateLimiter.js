/**
 * Enhanced Rate Limiting Middleware
 * Per-endpoint rate limits for enterprise security
 */

const rateLimit = require('express-rate-limit');

// Rate limit configurations by endpoint category
const RATE_LIMITS = {
  // Authentication endpoints - stricter limits to prevent brute force
  auth: {
    login: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts per window
      message: 'Too many login attempts. Please try again after 15 minutes.',
      standardHeaders: true,
      legacyHeaders: false
    },
    register: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10, // 10 registrations per hour
      message: 'Too many registration attempts. Please try again later.'
    },
    passwordChange: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5, // 5 password changes per hour
      message: 'Too many password change attempts. Please try again later.'
    },
    passwordReset: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10, // 10 password resets per hour (admin function)
      message: 'Too many password reset attempts. Please try again later.'
    }
  },

  // Document processing - balanced limits
  documents: {
    upload: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 50, // 50 uploads per hour
      message: 'Upload limit reached. Please try again later.'
    },
    list: {
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 60, // 60 requests per minute
      message: 'Too many requests. Please slow down.'
    },
    download: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 downloads per 15 minutes
      message: 'Download limit reached. Please try again later.'
    }
  },

  // Admin endpoints - moderate limits
  admin: {
    general: {
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 100, // 100 requests per minute
      message: 'Admin rate limit exceeded. Please slow down.'
    },
    bulkOperations: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 20, // 20 bulk operations per hour
      message: 'Bulk operation limit reached. Please try again later.'
    }
  },

  // AI/Processing - limited due to resource intensity
  ai: {
    analysis: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 20, // 20 AI analysis requests per hour
      message: 'AI analysis limit reached. Please try again later.'
    },
    categoryCreation: {
      windowMs: 24 * 60 * 60 * 1000, // 24 hours
      max: 10, // 10 category creations per day
      message: 'Category creation limit reached. Please try again tomorrow.'
    }
  },

  // General API - default limits
  general: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: 'Rate limit exceeded. Please slow down.'
  }
};

// Create rate limiter instances
function createRateLimiter(config) {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: { success: false, message: config.message },
    standardHeaders: config.standardHeaders !== false,
    legacyHeaders: config.legacyHeaders !== false,
    keyGenerator: (req) => {
      // Use combination of IP and user ID if authenticated
      const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      const userId = req.user?.userid || 'anonymous';
      return `${ip}-${userId}`;
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health';
    },
    handler: (req, res, next, options) => {
      console.warn(`Rate limit exceeded: ${req.ip} - ${req.path}`);
      res.status(429).json({
        success: false,
        message: options.message.message || options.message,
        retryAfter: Math.ceil(options.windowMs / 1000)
      });
    }
  });
}

// Pre-built limiters
const limiters = {
  // Auth limiters
  loginLimiter: createRateLimiter(RATE_LIMITS.auth.login),
  registerLimiter: createRateLimiter(RATE_LIMITS.auth.register),
  passwordChangeLimiter: createRateLimiter(RATE_LIMITS.auth.passwordChange),
  passwordResetLimiter: createRateLimiter(RATE_LIMITS.auth.passwordReset),

  // Document limiters
  uploadLimiter: createRateLimiter(RATE_LIMITS.documents.upload),
  documentListLimiter: createRateLimiter(RATE_LIMITS.documents.list),
  downloadLimiter: createRateLimiter(RATE_LIMITS.documents.download),

  // Admin limiters
  adminLimiter: createRateLimiter(RATE_LIMITS.admin.general),
  bulkOperationLimiter: createRateLimiter(RATE_LIMITS.admin.bulkOperations),

  // AI limiters
  aiAnalysisLimiter: createRateLimiter(RATE_LIMITS.ai.analysis),
  categoryCreationLimiter: createRateLimiter(RATE_LIMITS.ai.categoryCreation),

  // General limiter
  generalLimiter: createRateLimiter(RATE_LIMITS.general)
};

/**
 * Stricter rate limiter for sensitive operations
 * Uses sliding window algorithm with Redis (if available)
 */
function strictRateLimiter(options = {}) {
  const {
    windowMs = 60000,
    max = 5,
    message = 'Rate limit exceeded',
    keyPrefix = 'strict'
  } = options;

  // In-memory store for simplicity (use Redis in production)
  const requestCounts = new Map();

  return (req, res, next) => {
    const key = `${keyPrefix}:${req.ip}:${req.user?.userid || 'anon'}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create request history
    let requests = requestCounts.get(key) || [];

    // Remove old requests outside window
    requests = requests.filter(timestamp => timestamp > windowStart);

    if (requests.length >= max) {
      console.warn(`Strict rate limit exceeded: ${key}`);
      return res.status(429).json({
        success: false,
        message,
        retryAfter: Math.ceil((requests[0] + windowMs - now) / 1000)
      });
    }

    // Add current request
    requests.push(now);
    requestCounts.set(key, requests);

    // Cleanup old keys periodically
    if (requestCounts.size > 10000) {
      const keysToDelete = [];
      requestCounts.forEach((reqs, k) => {
        if (reqs.every(t => t < windowStart)) {
          keysToDelete.push(k);
        }
      });
      keysToDelete.forEach(k => requestCounts.delete(k));
    }

    next();
  };
}

/**
 * IP-based rate limiter (ignores user)
 */
function ipRateLimiter(options = {}) {
  return rateLimit({
    windowMs: options.windowMs || 60000,
    max: options.max || 100,
    message: { success: false, message: options.message || 'Too many requests from this IP' },
    keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown',
    standardHeaders: true,
    legacyHeaders: false
  });
}

/**
 * User-based rate limiter (requires authentication)
 */
function userRateLimiter(options = {}) {
  return rateLimit({
    windowMs: options.windowMs || 60000,
    max: options.max || 100,
    message: { success: false, message: options.message || 'Too many requests' },
    keyGenerator: (req) => req.user?.userid?.toString() || req.ip,
    skip: (req) => !req.user,
    standardHeaders: true,
    legacyHeaders: false
  });
}

module.exports = {
  ...limiters,
  createRateLimiter,
  strictRateLimiter,
  ipRateLimiter,
  userRateLimiter,
  RATE_LIMITS
};
