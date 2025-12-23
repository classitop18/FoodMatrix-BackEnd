import { Request, Response, NextFunction } from "express";
import { IUserService } from "./user.service.js";
import { IUserOtpService } from "../user-otps/user-otp.service.js";
import { ApiResponse } from "@/types/index.js";
import {
  generateAuthenticationToken,
  generateJwtToken,
  verifyJwtToken,
} from "@/utils/jwt.utils.js";
import { CONFIG } from "@/utils/env.config.js";
import {
  addOtpVerificationEmailJob,
  addVerificationEmailJob,
  addPasswordResetEmailJob,
} from "@/queues/jobs/email.jobs.js";
import { sendSuccess } from "@/utils/response.utils.js";
import { OTP_PURPOSES } from "../user-otps/constant/user-otp.constant.js";
import { hashString } from "@/utils/bcrypt.utils.js";
import {
  paginationSchema,
  updatePasswordSchema,
  updateUserSchema,
  userFiltersSchema,
} from "./schema/user.schema.js";
import { ISessionService } from "../session/session.service.js";
import { AuthenticatedRequest } from "@/middlewares/auth.middleware.js";

export class UserController {
  constructor(
    private userService: IUserService,
    private sessionService: ISessionService,
    private otpService: IUserOtpService,
  ) { }

  createUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<ApiResponse | any> => {
    try {
      const user = await this.userService.createUser(req.body);

      const token = await generateJwtToken(
        { userId: user.id },
        Number(CONFIG.TOKEN_EXPIRATION_MINUTES || 60),
        CONFIG.TOKEN_SECRET!,
      );
      await addVerificationEmailJob({
        to: user.email,
        name: user.firstName,
        token: token!,
        expiresIn: Number(CONFIG.TOKEN_EXPIRATION_MINUTES),
      });

      sendSuccess(
        res,
        { id: user?.id },
        "User created successfully. Please verify your email.",
        201,
      );
    } catch (error) {
      next(error);
    }
  };

  loginUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<ApiResponse | any> => {
    try {
      const { user } = await this.userService.loginUser(req.body);
      const userAgent = req.headers["user-agent"];
      const ip = req.ip;

      // Case 1: Check if user is verified
      if (!user.isVerified) {
        const token = await generateJwtToken(
          { userId: user.id },
          Number(CONFIG.TOKEN_EXPIRATION_MINUTES || 60) * 60,
          CONFIG.TOKEN_SECRET!,
        );

        await addVerificationEmailJob({
          to: user.email,
          name: user.firstName,
          token: token!,
          expiresIn: Number(CONFIG.TOKEN_EXPIRATION_MINUTES),
        });

        return sendSuccess(
          res,
          null,
          "Please verify your email to login. A new verification email has been sent.",
          401,
        );
      }

      // Case 2: Check if MFA is enabled
      if (user.isMfaEnabled) {
        const tempSessionId = generateJwtToken(
          {
            userId: user.id,
            mfaPending: true,
            purpose: OTP_PURPOSES.LOGIN_MFA,
          },
          10 * 60,
          CONFIG.TOKEN_SECRET!,
        );
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const expiresAt = new Date(
          Date.now() + Number(CONFIG.OTP_EXPIRATION_MINUTES) * 60 * 1000,
        );

        await this.otpService.createOtp({
          userId: user.id,
          otp,
          purpose: OTP_PURPOSES.LOGIN_MFA,
          tempSessionToken: tempSessionId,
          expiresAt,
        });

        await addOtpVerificationEmailJob({
          to: user.email,
          otp,
          name: user.firstName,
          expiresMins: Number(CONFIG.OTP_EXPIRATION_MINUTES),
        });

        res.cookie("mfa_temp_session", tempSessionId, {
          httpOnly: true,
          secure: CONFIG.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 10 * 60 * 1000,
          path: "/",
        });

        return sendSuccess(
          res,
          { mfaRequired: true },
          "MFA required. Please verify.",
          200,
        );
      }

      // Create session first
      const tempRefreshToken =
        (await generateJwtToken(
          { userId: user.id, sessionId: "temp" }, // Temporary
          Number(CONFIG.REFRESH_TOKEN_EXPIRATION_MINUTES),
          CONFIG.REFRESH_TOKEN_SECRET!,
        )) || "";

      // Hash refresh token for storage
      const refreshTokenHash = await hashString(tempRefreshToken);

      // Calculate session expiration
      const expiresAt = new Date(
        Date.now() +
        Number(CONFIG.REFRESH_TOKEN_EXPIRATION_MINUTES) * 60 * 1000,
      );

      // Create session in database
      const session = await this.sessionService.createSession({
        userId: user.id,
        refreshTokenHash,
        userAgent: userAgent || null,
        ip: ip || null,
        isValid: true,
        expiresAt,
      });

      const { accessToken, refreshToken } = generateAuthenticationToken({
        userId: user.id,
        email: user.email,
        sessionId: session.id,
      });

      const newRefreshTokenHash = await hashString(refreshToken);

      await this.sessionService.updateSession(session.id, {
        refreshTokenHash: newRefreshTokenHash,
      });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true, // JavaScript cannot access
        secure: CONFIG.NODE_ENV === "production", // HTTPS only in production
        sameSite: "strict", // CSRF protection
        maxAge:
          Number(CONFIG.REFRESH_TOKEN_EXPIRATION_MINUTES || 10080) * 60 * 1000, // 7 days in milliseconds
      });

      const userResponse = {
        ...user,
        accessToken, // Client stores this
        sessionId: session.id, // Optional: for reference only
      };

      return sendSuccess(
        res,
        { ...userResponse },
        "User logged in successfully",
        200,
      );
    } catch (error) {
      next(error);
    }
  };

  checkIsPropertytExist = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const id = req?.user?.id;
      const user = await this.userService.findUserByField(req.body, id);

      return sendSuccess(
        res,
        { exists: !!user },
        user
          ? `User already exists with this ${req.body.field}.`
          : `No user found with this ${req.body.field}.`,
        200,
      );
    } catch (error: any) {
      next(error);
    }
  };

  getUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await this.userService.getUserById(id);

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  getUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = userFiltersSchema.parse(req.query);
      const pagination = paginationSchema.parse(req.query);

      const result = await this.userService.getUsers(filters, pagination);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  updateUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = req?.user?.id;
      const validated = updateUserSchema.parse(req.body);
      const user = await this.userService.updateUser(id!, validated);

      res.status(200).json({
        success: true,
        message: "User updated successfully",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await this.userService.deleteUser(id);

      res.status(200).json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = req.user?.id;


      await this.userService.changePassword(id!, req?.body);

      sendSuccess(res, {}, "Password changed successfully", 200);
    } catch (error) {
      next(error);
    }
  };

  sendVerificationOtp = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { email } = req.body;
      // await this.userService.sendVerificationOtp(email);

      res.status(200).json({
        success: true,
        message: "Verification OTP sent successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  verifyOtp = async (req: any, res: Response, next: NextFunction) => {
    try {
      const userAgent = req.headers["user-agent"];
      const ip = req.ip;
      const { otp } = req.body;
      const { userId, purpose } = req.user;

      // Verify OTP through service
      const userOtp = await this.otpService.verifyOtp({
        userId,
        otp,
        purpose,
      });

      if (!userOtp) {
        return sendSuccess(res, null, "Inavlid or Expired otp.", 400);
      }

      const user = await this.userService.getUserById(userId);

      // Create session first
      const tempRefreshToken =
        (await generateJwtToken(
          { userId: user.id, sessionId: "temp" }, // Temporary
          Number(CONFIG.REFRESH_TOKEN_EXPIRATION_MINUTES),
          CONFIG.REFRESH_TOKEN_SECRET!,
        )) || "";

      // Hash refresh token for storage
      const refreshTokenHash = await hashString(tempRefreshToken);

      // Calculate session expiration
      const expiresAt = new Date(
        Date.now() +
        Number(CONFIG.REFRESH_TOKEN_EXPIRATION_MINUTES) * 60 * 1000,
      );

      // Create session in database
      const session = await this.sessionService.createSession({
        userId: user.id,
        refreshTokenHash,
        userAgent: userAgent || null,
        ip: ip || null,
        isValid: true,
        expiresAt,
      });

      const { accessToken, refreshToken } = generateAuthenticationToken({
        userId: user.id,
        email: user.email,
        sessionId: session.id,
      });

      const newRefreshTokenHash = await hashString(refreshToken);

      await this.sessionService.updateSession(session.id, {
        refreshTokenHash: newRefreshTokenHash,
      });

      res.clearCookie("mfa_temp_session");

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true, // JavaScript cannot access
        secure: CONFIG.NODE_ENV === "production", // HTTPS only in production
        sameSite: "strict", // CSRF protection
        maxAge:
          Number(CONFIG.REFRESH_TOKEN_EXPIRATION_MINUTES || 10080) * 60 * 1000, // 7 days in milliseconds
      });

      const userResponse = {
        ...user,
        accessToken, // Client stores this
        sessionId: session.id, // Optional: for reference only
      };

      return sendSuccess(
        res,
        { ...userResponse },
        "User logged in successfully",
        200,
      );
    } catch (error) {
      next(error);
    }
  };

  verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log("aya mai yha pr");
      const token = req.query?.token;
      if (typeof token !== "string") {
        throw new Error("Invalid or missing token");
      }
      const user = await this.userService.verifyUserEmailUsingToken({ token });
      res.redirect(CONFIG.FRONTEND_BASE_URL + "/login");
    } catch (error) {
      next(error);
    }
  };

  enableMfa = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await this.userService.enableMfa(id);

      res.status(200).json({
        success: true,
        message: "MFA enabled successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  disableMfa = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await this.userService.disableMfa(id);

      res.status(200).json({
        success: true,
        message: "MFA disabled successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  getActiveUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = (req as any).user?.id;
      const user = await this.userService.getUserById(id);
      return sendSuccess(res, { ...user }, "User Fetched Successfully.", 200);
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, sessionId } = (req as any).user;
      // Mark the session as invalid
      await this.sessionService.updateSession(sessionId, {
        isValid: false,
      });

      // Clear refresh token
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: CONFIG.NODE_ENV === "production",
        sameSite: "strict",
      });

      return sendSuccess(res, null, "Logged out successfully.", 200);
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;

      const user = await this.userService.getUserByEmail(email);
      if (!user) {
        return sendSuccess(
          res,
          null,
          "If this email exists, reset instructions have been sent.",
          200,
        );
      }
      const userAgent = req.headers["user-agent"];
      const ip = req.ip;

      const expiresAt = new Date(
        Date.now() +
        Number(CONFIG.PASSWORD_RESET_EXPIRATION_MINUTES) * 60 * 1000,
      );
      // Create session first
      const tempRefreshToken =
        (await generateJwtToken(
          { userId: user.id, sessionId: "temp" }, // Temporary
          Number(CONFIG.PASSWORD_RESET_EXPIRATION_MINUTES),
          CONFIG.PASSWORD_RESET_SECRET!,
        )) || "";

      // Hash refresh token for storage
      const refreshTokenHash = await hashString(tempRefreshToken);
      // Create session in database
      const session = await this.sessionService.createSession({
        userId: user.id,
        refreshTokenHash,
        userAgent: userAgent || null,
        ip: ip || null,
        isValid: true,
        expiresAt,
      });

      // Generate reset token
      const token = await generateJwtToken(
        { userId: user.id, sessionId: session?.id },
        Number(CONFIG.PASSWORD_RESET_EXPIRATION_MINUTES || 30) * 60,
        CONFIG.PASSWORD_RESET_SECRET!,
      );
      console.log(
        { generateToken: token },
        "with secret",
        CONFIG.PASSWORD_RESET_SECRET,
      );
      // Add email job (you can modify template)

      await addPasswordResetEmailJob({
        to: user.email,
        name: user.firstName,
        resetToken: token!,
        expiresIn: Number(CONFIG.PASSWORD_RESET_EXPIRATION_MINUTES),
      });

      const newResetToken = await hashString(token!);

      await this.sessionService.updateSession(session.id, {
        refreshTokenHash: newResetToken,
      });

      return sendSuccess(
        res,
        null,
        "Password reset link has been sent to your email.",
        200,
      );
    } catch (error) {
      next(error);
    }
  };

  verifyToken = async (req: any, res: Response, next: NextFunction) => {
    try {
      const token = generateJwtToken(
        {
          ...req.reset,
        },
        Number(CONFIG.PASSWORD_RESET_EXPIRATION_MINUTES) * 60,
        CONFIG.PASSWORD_RESET_SECRET,
      );

      res.cookie("reset_password_token", token, {
        httpOnly: true, // JavaScript cannot access
        secure: CONFIG.NODE_ENV === "production", // HTTPS only in production
        sameSite: "strict", // CSRF protection
        maxAge: Number(CONFIG.PASSWORD_RESET_EXPIRATION_MINUTES) * 60 * 1000, // 7 days in milliseconds
      });

      res.redirect(CONFIG.FRONTEND_BASE_URL + "/reset-password");
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: any, res: Response, next: NextFunction) => {
    try {
      const { newPassword } = req.body;
      // Verify reset token payload
      const { sessionId, userId } = req?.reset || {};
      if (!sessionId || !userId) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired reset token",
        });
      }
      // Update password
      await this.userService.resetPassword(userId, { newPassword });
      // Mark reset session as used (one-time token)
      await this.sessionService.updateSession(sessionId, {
        isValid: false,
      });
      // Remove reset cookie
      res.clearCookie("reset_password_token");

      sendSuccess(res, {}, "Password has been changed.", 200);
    } catch (error) {
      next(error);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.cookies?.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: "Refresh token not found",
          errorCode: "REFRESH_TOKEN_MISSING",
        });
      }

      // Verify refresh token
      const decoded = await verifyJwtToken(
        refreshToken,
        CONFIG.REFRESH_TOKEN_SECRET!,
      );

      if (!decoded || !decoded.userId || !decoded.sessionId) {
        return res.status(401).json({
          success: false,
          message: "Invalid refresh token",
          errorCode: "INVALID_REFRESH_TOKEN",
        });
      }

      // Get session from database
      const session = await this.sessionService.getSessionById(
        decoded.sessionId,
      );

      if (!session || !session.isValid) {
        return res.status(401).json({
          success: false,
          message: "Session expired or invalid",
          errorCode: "SESSION_INVALID",
        });
      }

      // Verify refresh token hash matches
      const { compareHash } = await import("@/utils/bcrypt.utils.js");
      const isValidToken = await compareHash(
        refreshToken,
        session.refreshTokenHash,
      );

      if (!isValidToken) {
        return res.status(401).json({
          success: false,
          message: "Invalid refresh token",
          errorCode: "INVALID_REFRESH_TOKEN",
        });
      }

      // Check if session is expired
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        // Mark session as invalid
        await this.sessionService.updateSession(session.id, {
          isValid: false,
        });

        return res.status(401).json({
          success: false,
          message: "Session expired",
          errorCode: "SESSION_EXPIRED",
        });
      }

      // Get user
      const user = await this.userService.getUserById(decoded.userId);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
          errorCode: "USER_NOT_FOUND",
        });
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
