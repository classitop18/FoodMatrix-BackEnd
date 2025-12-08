import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { logger } from "./logger.utils";

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
