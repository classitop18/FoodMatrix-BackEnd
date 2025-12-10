import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { logger } from "./logger.utils.ts";
import { CONFIG } from "./env.config.ts";

export const generateJwtToken = (
  payload: object,
  expiresIn: number,
  secret: string,
): string | null => {
  try {
    const options: SignOptions = { expiresIn };
    return jwt.sign(payload, secret, options);
  } catch (error: any) {
    logger.error("JWT Token Generation Error:", error.message);
    return null;
  }
};

export const verifyJwtToken = (
  token: string,
  secret: string,
): JwtPayload | null => {
  try {
    return jwt.verify(token, secret) as JwtPayload;
  } catch (error: any) {
    logger.error("JWT Token Verification Failed:", error.message);
    return null;
  }
};

export const generateAuthenticationToken = (
  payload: any,
): {
  accessToken: string;
  refreshToken: string;
}  => {
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
  } catch (error: any) {
    logger.error("Authentication Token Generation Error:", error.message);
    throw error;
  }
};
