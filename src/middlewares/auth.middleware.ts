import { Request, Response, NextFunction } from "express";
import { verifyJwtToken } from "../utils/jwt.utils.ts";
import { CONFIG } from "../utils/env.config.ts";
import { SessionService } from "../modules/session/session.service.ts";
import { UserRepository } from "../modules/user/user.repository.ts";
import { logger } from "../utils/logger.utils.ts";
import { sendError } from "../utils/response.utils.ts";
import { SessionRepository } from "../modules/session/session.repository.ts";
import { compareHash } from "../utils/bcrypt.utils.ts";
import { OTP_PURPOSES } from "../modules/user-otps/constant/user-otp.constant.ts";

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
  next: NextFunction,
): Promise<any> => {
  const sessionRepository = new SessionRepository();
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
        401,
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
        401,
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
          401,
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
          401,
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
        401,
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
      500,
    );
  }
};

export interface ResetRequest extends Request {
  reset?: {
    userId: string;
    sessionId: string;
    session: any;
  };
}

export interface MFARequest extends Request {
  user?: {
    userId: string;
    purpose: string;
  };
}

export const verifyResetToken = async (
  req: ResetRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { token } = req.params;

    console.log(
      { token },
      "verifying with secret",
      CONFIG.PASSWORD_RESET_SECRET,
    );

    if (!token) {
      return sendError(res, "Reset token missing.", null, 400);
    }

    // Decode JWT
    const decoded: any = await verifyJwtToken(
      token,
      CONFIG.PASSWORD_RESET_SECRET,
    );

    console.log(decoded, "decodeddecodeddecoded");

    if (!decoded?.userId || !decoded?.sessionId) {
      return sendError(res, "Invalid or expired reset token.", null, 400);
    }

    const { userId, sessionId } = decoded;

    const sessionService = new SessionService(new SessionRepository());

    // Fetch password-reset session
    const session = await sessionService.getSessionById(sessionId);

    if (!session || session.userId !== userId) {
      return sendError(res, "Reset token session not found.", null, 400);
    }

    // Expired session?
    if (
      !session.isValid ||
      (session.expiresAt && new Date(session.expiresAt) < new Date())
    ) {
      return sendError(res, "Reset token has expired.", null, 400);
    }

    // Ensure token matches stored hash
    const match = await compareHash(token, session.refreshTokenHash);

    if (!match) {
      return sendError(res, "Invalid or already-used reset token.", null, 400);
    }

    // Attach reset details to request
    req.reset = {
      userId,
      sessionId,
      session,
    };
    next();
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      return sendError(res, "Reset token expired.", null, 400);
    }
    return sendError(res, "Invalid reset token.", null, 400);
  }
};

export const authenticateForChangePassword = async (
  req: ResetRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    console.log(req?.cookies, "kkkkkkkkkkkkkkkkkkkkkk");
    const { reset_password_token } = req?.cookies;

    if (!reset_password_token) {
      return sendError(res, "Reset token missing.", null, 400);
    }

    // Decode JWT
    const decoded: any = await verifyJwtToken(
      reset_password_token,
      CONFIG.PASSWORD_RESET_SECRET,
    );

    console.log({ decoded }, "decodeddecodeddecodeddecodeddecoded");
    console.log(decoded.userId, decoded.sessionId);
    if (!decoded?.userId || !decoded?.sessionId) {
      return sendError(res, "Invalid or expired token.", null, 400);
    }

    const { userId, sessionId } = decoded;

    console.log("yha nhi aa oa rha u");

    const sessionService = new SessionService(new SessionRepository());

    // Fetch password-reset session
    const session = await sessionService.getSessionById(sessionId);

    console.log(session, "sessionsessionsession");

    if (!session || session.userId !== userId) {
      return sendError(res, "Reset token session not found.", null, 400);
    }

    // Expired session?
    if (
      !session.isValid ||
      (session.expiresAt && new Date(session.expiresAt) < new Date())
    ) {
      return sendError(res, "Reset token has expired.", null, 400);
    }

    // Attach reset details to request
    req.reset = {
      userId,
      sessionId,
      session,
    };
    next();
  } catch (error: any) {
    console.log(error, "sdsdsd");
    if (error.name === "TokenExpiredError") {
      return sendError(res, "Reset token expired.", null, 400);
    }
    return sendError(res, "Invalid reset token.", null, 400);
  }
};

export const authenticateMFA = async (
  req: MFARequest,
  res: Response,
  next: NextFunction,
) => {
  try {

    const { mfa_temp_session } = req?.cookies;

    if (!mfa_temp_session) {
      return sendError(res, "Reset token missing.", null, 400);
    }
    // Decode JWT
    const decoded: any = await verifyJwtToken(
      mfa_temp_session,
      CONFIG.TOKEN_SECRET,
    );


    if (!decoded?.userId || decoded?.purpose !== OTP_PURPOSES.LOGIN_MFA) {
      return sendError(res, "Invalid or expired token.", null, 400);
    }

    const { userId, purpose } = decoded;



    // Attach reset details to request
    req.user = {
      userId,
      purpose
    };
    next();
  } catch (error: any) {
    console.log(error, "sdsdsd");
    if (error.name === "TokenExpiredError") {
      return sendError(res, "Reset token expired.", null, 400);
    }
    return sendError(res, "Invalid reset token.", null, 400);
  }
};
