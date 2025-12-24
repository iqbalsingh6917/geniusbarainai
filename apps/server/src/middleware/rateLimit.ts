import { Request, Response, NextFunction } from 'express';
import { fail } from '../utils/apiResponse';

// In-memory store for rate limiting
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

// Rate limiting configuration
const rateLimits = {
  '/api/auth/login': {
    max: 10,
    windowMs: 10 * 60 * 1000 // 10 minutes
  },
  '/api/auth/forgot-password': {
    max: 5,
    windowMs: 15 * 60 * 1000 // 15 minutes
  },
  '/api/auth/reset-password': {
    max: 10,
    windowMs: 10 * 60 * 1000 // 10 minutes
  },
  '/api/superadmin/users': {
    max: 20,
    windowMs: 10 * 60 * 1000 // 10 minutes
  }
};

// Rate limiting middleware
export const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  // Get client IP
  const ip = req.ip || req.connection.remoteAddress || '';
  
  // Normalize the path
  const path = req.path.toLowerCase();
  
  // Check if this path has rate limiting configured
  let limitConfig = null;
  let matchedPath = '';
  
  // Exact match first
  if (rateLimits[path as keyof typeof rateLimits]) {
    limitConfig = rateLimits[path as keyof typeof rateLimits];
    matchedPath = path;
  } else {
    // Prefix match for routes like /api/superadmin/users/*
    for (const [configPath, config] of Object.entries(rateLimits)) {
      if (path.startsWith(configPath)) {
        limitConfig = config;
        matchedPath = configPath;
        break;
      }
    }
  }
  
  // If no rate limit is configured for this path, continue
  if (!limitConfig) {
    return next();
  }
  
  // Create a unique key for this IP and path
  const key = `${ip}:${matchedPath}`;
  const now = Date.now();
  
  // Get or create the rate limit entry
  let entry = rateLimitStore.get(key);
  
  if (!entry) {
    entry = {
      count: 0,
      resetTime: now + limitConfig.windowMs
    };
    rateLimitStore.set(key, entry);
  }
  
  // Reset counter if the window has passed
  if (entry.resetTime < now) {
    entry.count = 0;
    entry.resetTime = now + limitConfig.windowMs;
  }
  
  // Increment the counter
  entry.count++;
  
  // Check if the limit has been exceeded
  if (entry.count > limitConfig.max) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    res.setHeader('Retry-After', retryAfter.toString());
    
    return fail(
      res,
      429,
      'RATE_LIMIT_EXCEEDED',
      'Too many requests, please try again later'
    );
  }
  
  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', limitConfig.max.toString());
  res.setHeader('X-RateLimit-Remaining', (limitConfig.max - entry.count).toString());
  res.setHeader('X-RateLimit-Reset', entry.resetTime.toString());
  
  next();
};
