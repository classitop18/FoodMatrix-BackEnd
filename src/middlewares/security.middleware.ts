// import { Request, Response, NextFunction } from "express";
// import { logger } from "../utils/logger.utils.ts";
// import { sendError } from "../utils/response.utils.ts";
// import { AuthenticatedRequest } from "./auth.middleware.ts";

// /**
//  * In-memory rate limiter store
//  * In production, use Redis for distributed rate limiting
//  */
// interface RateLimitStore {
//     [key: string]: {
//         count: number;
//         resetTime: number;
//     };
// }

// const rateLimitStore: RateLimitStore = {};

// /**
//  * Clean up expired rate limit entries every 5 minutes
//  */
// setInterval(() => {
//     const now = Date.now();
//     Object.keys(rateLimitStore).forEach((key) => {
//         if (rateLimitStore[key].resetTime < now) {
//             delete rateLimitStore[key];
//         }
//     });
// }, 5 * 60 * 1000);

// /**
//  * Rate Limiting Middleware Factory
//  * Limits the number of requests from a single IP or user
//  *
//  * @param options - Rate limit configuration
//  * @param options.windowMs - Time window in milliseconds
//  * @param options.maxRequests - Maximum number of requests per window
//  * @param options.message - Custom error message
//  * @param options.skipSuccessfulRequests - Don't count successful requests
//  * @param options.keyGenerator - Custom key generator function
//  *
//  * @example
//  * // Limit login attempts
//  * router.post('/login',
//  *   rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 5 }),
//  *   controller.login
//  * );
//  */
// export const rateLimit = (options: {
//     windowMs?: number;
//     maxRequests?: number;
//     message?: string;
//     skipSuccessfulRequests?: boolean;
//     keyGenerator?: (req: Request) => string;
// }) => {
//     const {
//         windowMs = 15 * 60 * 1000, // 15 minutes default
//         maxRequests = 100,
//         message = "Too many requests, please try again later.",
//         skipSuccessfulRequests = false,
//         keyGenerator = (req: Request) => req.ip || "unknown",
//     } = options;

//     return async (
//         req: Request,
//         res: Response,
//         next: NextFunction
//     ): Promise<void> => {
//         try {
//             const key = keyGenerator(req);
//             const now = Date.now();

//             // Initialize or get existing rate limit data
//             if (!rateLimitStore[key] || rateLimitStore[key].resetTime < now) {
//                 rateLimitStore[key] = {
//                     count: 0,
//                     resetTime: now + windowMs,
//                 };
//             }

//             const rateLimit = rateLimitStore[key];

//             // Check if limit exceeded
//             if (rateLimit.count >= maxRequests) {
//                 const retryAfter = Math.ceil((rateLimit.resetTime - now) / 1000);

//                 logger.warn("Rate limit exceeded", {
//                     key,
//                     ip: req.ip,
//                     path: req.path,
//                     count: rateLimit.count,
//                     maxRequests,
//                 });

//                 res.setHeader("Retry-After", retryAfter.toString());
//                 res.setHeader("X-RateLimit-Limit", maxRequests.toString());
//                 res.setHeader("X-RateLimit-Remaining", "0");
//                 res.setHeader("X-RateLimit-Reset", new Date(rateLimit.resetTime).toISOString());

//                 return sendError(res, message, null, 429);
//             }

//             // Increment counter
//             rateLimit.count++;

//             // Set rate limit headers
//             res.setHeader("X-RateLimit-Limit", maxRequests.toString());
//             res.setHeader("X-RateLimit-Remaining", (maxRequests - rateLimit.count).toString());
//             res.setHeader("X-RateLimit-Reset", new Date(rateLimit.resetTime).toISOString());

//             // If skipSuccessfulRequests is true, decrement on successful response
//             if (skipSuccessfulRequests) {
//                 const originalSend = res.send;
//                 res.send = function (data: any) {
//                     if (res.statusCode < 400) {
//                         rateLimit.count--;
//                     }
//                     return originalSend.call(this, data);
//                 };
//             }

//             next();
//         } catch (error: any) {
//             logger.error("Rate limit middleware error:", {
//                 error: error.message,
//                 ip: req.ip,
//             });
//             next(); // Don't block request on rate limiter error
//         }
//     };
// };

// /**
//  * Strict rate limiter for sensitive endpoints
//  * Uses user ID if authenticated, otherwise IP address
//  */
// export const strictRateLimit = (options: {
//     windowMs?: number;
//     maxRequests?: number;
//     message?: string;
// }) => {
//     return rateLimit({
//         ...options,
//         keyGenerator: (req: Request) => {
//             const authReq = req as AuthenticatedRequest;
//             return authReq.user?.id || req.ip || "unknown";
//         },
//     });
// };

// /**
//  * Request Size Limiter
//  * Prevents large payload attacks
//  */
// export const limitRequestSize = (maxSizeInMB: number = 10) => {
//     const maxBytes = maxSizeInMB * 1024 * 1024;

//     return (req: Request, res: Response, next: NextFunction): void => {
//         const contentLength = req.headers["content-length"];

//         if (contentLength && parseInt(contentLength) > maxBytes) {
//             logger.warn("Request size limit exceeded", {
//                 ip: req.ip,
//                 path: req.path,
//                 contentLength,
//                 maxBytes,
//             });

//             return sendError(
//                 res,
//                 `Request size exceeds maximum allowed size of ${maxSizeInMB}MB.`,
//                 null,
//                 413
//             );
//         }

//         next();
//     };
// };

// /**
//  * Sanitize Input Middleware
//  * Removes potentially dangerous characters from request data
//  */
// export const sanitizeInput = (
//     req: Request,
//     res: Response,
//     next: NextFunction
// ): void => {
//     try {
//         // Sanitize query parameters
//         if (req.query) {
//             Object.keys(req.query).forEach((key) => {
//                 if (typeof req.query[key] === "string") {
//                     req.query[key] = sanitizeString(req.query[key] as string);
//                 }
//             });
//         }

//         // Sanitize body
//         if (req.body && typeof req.body === "object") {
//             req.body = sanitizeObject(req.body);
//         }

//         next();
//     } catch (error: any) {
//         logger.error("Input sanitization error:", {
//             error: error.message,
//             ip: req.ip,
//         });
//         next(); // Continue even if sanitization fails
//     }
// };

// /**
//  * Sanitize a string by removing dangerous characters
//  */
// function sanitizeString(str: string): string {
//     return str
//         .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Remove script tags
//         .replace(/javascript:/gi, "") // Remove javascript: protocol
//         .replace(/on\w+\s*=/gi, "") // Remove event handlers
//         .trim();
// }

// /**
//  * Recursively sanitize an object
//  */
// function sanitizeObject(obj: any): any {
//     if (typeof obj !== "object" || obj === null) {
//         return obj;
//     }

//     if (Array.isArray(obj)) {
//         return obj.map((item) => sanitizeObject(item));
//     }

//     const sanitized: any = {};
//     Object.keys(obj).forEach((key) => {
//         const value = obj[key];
//         if (typeof value === "string") {
//             sanitized[key] = sanitizeString(value);
//         } else if (typeof value === "object") {
//             sanitized[key] = sanitizeObject(value);
//         } else {
//             sanitized[key] = value;
//         }
//     });

//     return sanitized;
// }

// /**
//  * IP Whitelist Middleware
//  * Only allows requests from whitelisted IP addresses
//  */
// export const ipWhitelist = (allowedIPs: string[]) => {
//     return (req: Request, res: Response, next: NextFunction): void => {
//         const clientIP = req.ip;

//         if (!clientIP || !allowedIPs.includes(clientIP)) {
//             logger.warn("IP not whitelisted", {
//                 ip: clientIP,
//                 path: req.path,
//             });

//             return sendError(
//                 res,
//                 "Access denied from this IP address.",
//                 null,
//                 403
//             );
//         }

//         next();
//     };
// };

// /**
//  * Prevent Parameter Pollution
//  * Ensures query parameters are not arrays when they shouldn't be
//  */
// export const preventParameterPollution = (
//     allowedArrayParams: string[] = []
// ) => {
//     return (req: Request, res: Response, next: NextFunction): void => {
//         try {
//             if (req.query) {
//                 Object.keys(req.query).forEach((key) => {
//                     if (
//                         Array.isArray(req.query[key]) &&
//                         !allowedArrayParams.includes(key)
//                     ) {
//                         // Take only the first value
//                         req.query[key] = (req.query[key] as string[])[0];

//                         logger.warn("Parameter pollution detected", {
//                             parameter: key,
//                             ip: req.ip,
//                             path: req.path,
//                         });
//                     }
//                 });
//             }

//             next();
//         } catch (error: any) {
//             logger.error("Parameter pollution prevention error:", {
//                 error: error.message,
//                 ip: req.ip,
//             });
//             next();
//         }
//     };
// };

// /**
//  * CORS Security Headers
//  * Adds additional security headers to responses
//  */
// export const securityHeaders = (
//     req: Request,
//     res: Response,
//     next: NextFunction
// ): void => {
//     // Prevent clickjacking
//     res.setHeader("X-Frame-Options", "DENY");

//     // Prevent MIME type sniffing
//     res.setHeader("X-Content-Type-Options", "nosniff");

//     // Enable XSS protection
//     res.setHeader("X-XSS-Protection", "1; mode=block");

//     // Referrer policy
//     res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

//     // Content Security Policy
//     res.setHeader(
//         "Content-Security-Policy",
//         "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"
//     );

//     next();
// };

// /**
//  * Request ID Middleware
//  * Adds a unique ID to each request for tracking
//  */
// export const requestId = (
//     req: Request,
//     res: Response,
//     next: NextFunction
// ): void => {
//     const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
//     (req as any).id = id;
//     res.setHeader("X-Request-ID", id);
//     next();
// };
