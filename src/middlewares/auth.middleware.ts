import { Request, Response, NextFunction } from "express";
import { verifyJwtToken } from "../utils/jwt.utils.ts";
import { CONFIG } from "../utils/env.config.ts";
import { SessionService } from "../modules/session/session.service.ts";
import { UserRepository } from "../modules/user/user.repository.ts";
import { logger } from "../utils/logger.utils.ts";
import { sendError } from "../utils/response.utils.ts";
import { SessionRepository } from "../modules/session/session.repository.ts";

// Extend Express Request to include user data
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        role?: string;
        sessionId?: string;
    };
    session?: {
        id: string;
        userId: string;
        isValid: boolean;
    };
}

/**
 * Authentication Middleware
 * Verifies JWT access token and validates active session
 * Attaches user and session data to request object
 */
export const authenticate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<any> => {

    const sessionRepository = new SessionRepository()
    const sessionService = new SessionService(sessionRepository);

    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            logger.warn("Authentication failed: No token provided", {
                ip: req.ip,
                path: req.path,
            });
            return sendError(
                res,
                "Authentication required. Please provide a valid token.",
                null,
                401
            );
        }

        const token = authHeader.substring(7);

        // Verify JWT token
        const decoded = verifyJwtToken(token, CONFIG.ACCESS_TOKEN_SECRET!);

        if (!decoded || !decoded.userId) {
            logger.warn("Authentication failed: Invalid token", {
                ip: req.ip,
                path: req.path,
            });
            return sendError(
                res,
                "Invalid or expired token. Please login again.",
                null,
                401
            );
        }

        // Validate session if sessionId is present in token
        if (decoded.sessionId) {

            const session = await sessionService.getSessionById(decoded.sessionId);

            if (!session || !session.isValid) {
                logger.warn("Authentication failed: Invalid session", {
                    userId: decoded.userId,
                    sessionId: decoded.sessionId,
                    ip: req.ip,
                });
                return sendError(
                    res,
                    "Session expired or invalid. Please login again.",
                    null,
                    401
                );
            }

            // Check if session has expired
            if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
                logger.warn("Authentication failed: Session expired", {
                    userId: decoded.userId,
                    sessionId: decoded.sessionId,
                });

                // Invalidate expired session
                await sessionService.updateSession(session.id, { isValid: false });

                return sendError(
                    res,
                    "Session has expired. Please login again.",
                    null,
                    401
                );
            }

            // Update session last used timestamp
            await sessionService.updateSession(session.id, {
                lastUsedAt: new Date(),
            });

            req.session = {
                id: session.id,
                userId: session.userId,
                isValid: session.isValid!,
            };
        }

        // Verify user still exists and is active
        const userRepository = new UserRepository();
        const user = await userRepository.findById(decoded.userId);

        if (!user) {
            logger.warn("Authentication failed: User not found", {
                userId: decoded.userId,
                ip: req.ip,
            });
            return sendError(
                res,
                "User account not found. Please contact support.",
                null,
                401
            );
        }

        // Attach user data to request
        req.user = {
            id: user.id,
            email: user.email,
            sessionId: decoded.sessionId,
        };

        logger.info("Authentication successful", {
            userId: user.id,
            email: user.email,
            path: req.path,
        });

        next();
    } catch (error: any) {
        logger.error("Authentication middleware error:", {
            error: error.message,
            stack: error.stack,
            ip: req.ip,
            path: req.path,
        });

        return sendError(
            res,
            "Authentication failed. Please try again.",
            null,
            500
        );
    }
};
