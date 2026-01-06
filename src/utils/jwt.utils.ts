import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { logger } from "./logger.utils.js";
import { CONFIG } from "./env.config.js";

export const generateJwtToken = (
  payload: object,
  // exipires in should be in second
  expiresIn: number,
  secret: string,
): string | null => {
  try {
    const options: SignOptions = { expiresIn };
    return jwt.sign(payload, secret, options);
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error("JWT Token Generation Error:", error.message);
    }
    return null;
  }
};

export const verifyJwtToken = (
  token: string,
  secret: string,
): JwtPayload | null => {
  try {
    return jwt.verify(token, secret) as JwtPayload;
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error("JWT Token Verification Failed:", error.message);
    }
    return null;
  }
};

interface TokenPayload {
  userId: string;
  email: string;
  sessionId: string;
}

export const generateAuthenticationToken = (
  payload: TokenPayload,
): {
  accessToken: string;
  refreshToken: string;
} => {
  try {
    const accessTokenSecret = CONFIG.ACCESS_TOKEN_SECRET;
    const accessTokenExpiry = CONFIG.ACCESS_TOKEN_EXPIRY_MINUTES || 60;

    const refreshTokenSecret = CONFIG.REFRESH_TOKEN_SECRET;
    const refreshTokenExpiry = CONFIG.REFRESH_TOKEN_EXPIRATION_MINUTES || 10080; // 7 days

    const accessToken = jwt.sign(payload, accessTokenSecret!, {
      expiresIn: Number(accessTokenExpiry) * 60, // convert minutes to seconds
    });

    const refreshToken = jwt.sign(payload, refreshTokenSecret!, {
      expiresIn: Number(refreshTokenExpiry) * 60, // convert minutes to seconds
    });

    return { accessToken, refreshToken };
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error("Authentication Token Generation Error:", error.message);
    }
    throw error;
  }
};
