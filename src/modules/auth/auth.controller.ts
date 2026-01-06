import { Request, Response, NextFunction } from "express";
import { ISessionService } from "../session/session.service.js";
import { IUserService } from "../user/user.service.js";
import {
  verifyJwtToken,
  generateAuthenticationToken,
} from "@/utils/jwt.utils.js";
import { CONFIG } from "@/utils/env.config.js";
import { compareHash } from "@/utils/bcrypt.utils.js";
import { sendResponse } from "@/utils/response.utils.js";
import { AppError } from "@/utils/app-error.utils.js";

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
  ): Promise<any> => {
    try {
      const refreshToken = req.cookies?.refreshToken;

      if (!refreshToken) {
        throw new AppError("Refresh token not found", 401);
      }

      // Verify refresh token
      const decoded = await verifyJwtToken(
        refreshToken,
        CONFIG.REFRESH_TOKEN_SECRET!,
      );

      if (!decoded || !decoded.userId || !decoded.sessionId) {
        throw new AppError("Invalid refresh token", 401);
      }

      // Get session from database
      const session = await this.sessionService.getSessionById(
        decoded.sessionId,
      );

      if (!session || !session.isValid) {
        throw new AppError("Session expired or invalid", 401);
      }

      // Verify refresh token hash matches
      const isValidToken = await compareHash(
        refreshToken,
        session.refreshTokenHash,
      );

      if (!isValidToken) {
        throw new AppError("Invalid refresh token", 401);
      }

      // Check if session is expired
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        // Mark session as invalid
        await this.sessionService.updateSession(session.id, {
          isValid: false,
        });

        throw new AppError("Session expired", 401);
      }

      // Get user
      const user = await this.userService.getUserById(decoded.userId);

      if (!user) {
        throw new AppError("User not found", 404);
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

      return sendResponse(
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
