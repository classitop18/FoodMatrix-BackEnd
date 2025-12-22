import { Request, Response, NextFunction } from "express";
import { ISessionService } from "../session/session.service.js";
import { IUserService } from "../user/user.service.js";
import {
  verifyJwtToken,
  generateAuthenticationToken,
} from "@/utils/jwt.utils.js";
import { CONFIG } from "@/utils/env.config.js";
import { hashString, compareHash } from "@/utils/bcrypt.utils.js";
import { sendSuccess } from "@/utils/response.utils.js";

export class AuthController {
  constructor(
    private sessionService: ISessionService,
    private userService: IUserService,
  ) {}

  /**
   * @route   POST /api/v1/auth/refresh-token
   * @desc    Refresh access token using refresh token from cookie
   * @access  Public (but requires valid refresh token in cookie)
   */
  refreshToken = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const refreshToken = req.cookies?.refreshToken;

      if (!refreshToken) {
        res.status(401).json({
          success: false,
          message: "Refresh token not found",
          errorCode: "REFRESH_TOKEN_MISSING",
        });
        return;
      }

      // Verify refresh token
      const decoded = await verifyJwtToken(
        refreshToken,
        CONFIG.REFRESH_TOKEN_SECRET!,
      );

      if (!decoded || !decoded.userId || !decoded.sessionId) {
        res.status(401).json({
          success: false,
          message: "Invalid refresh token",
          errorCode: "INVALID_REFRESH_TOKEN",
        });
        return;
      }

      // Get session from database
      const session = await this.sessionService.getSessionById(
        decoded.sessionId,
      );

      if (!session || !session.isValid) {
        res.status(401).json({
          success: false,
          message: "Session expired or invalid",
          errorCode: "SESSION_INVALID",
        });
        return;
      }

      // Verify refresh token hash matches
      const isValidToken = await compareHash(
        refreshToken,
        session.refreshTokenHash,
      );

      if (!isValidToken) {
        res.status(401).json({
          success: false,
          message: "Invalid refresh token",
          errorCode: "INVALID_REFRESH_TOKEN",
        });
        return;
      }

      // Check if session is expired
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        // Mark session as invalid
        await this.sessionService.updateSession(session.id, {
          isValid: false,
        });

        res.status(401).json({
          success: false,
          message: "Session expired",
          errorCode: "SESSION_EXPIRED",
        });
        return;
      }

      // Get user
      const user = await this.userService.getUserById(decoded.userId);

      if (!user) {
        res.status(401).json({
          success: false,
          message: "User not found",
          errorCode: "USER_NOT_FOUND",
        });
        return;
      }

      // Generate new access token (keep same refresh token)
      const { accessToken } = generateAuthenticationToken({
        userId: user.id,
        email: user.email,
        sessionId: session.id,
      });

      // Update session last used time
      await this.sessionService.updateSession(session.id, {
        lastUsedAt: new Date(),
      });

      return sendSuccess(
        res,
        {
          accessToken,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
        },
        "Token refreshed successfully",
        200,
      );
    } catch (error) {
      next(error);
    }
  };
}
