import { UserRepository } from "../modules/user/user.repository.ts";
import { SessionService } from "../modules/session/session.service.ts";
import { generateAuthenticationToken, verifyJwtToken } from "../utils/jwt.utils.ts";
import { compareHash, hashString } from "../utils/bcrypt.utils.ts";
import { logger } from "../utils/logger.utils.ts";
import { CONFIG } from "../utils/env.config.ts";
import { UserWithoutPassword } from "../modules/user/types/user.types.ts";

export interface LoginCredentials {
    emailOrUsername: string;
    password: string;
    userAgent?: string;
    ip?: string;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

export interface AuthResponse {
    user: UserWithoutPassword;
    tokens: AuthTokens;
    sessionId: string;
}

export interface RefreshTokenRequest {
    refreshToken: string;
    userAgent?: string;
    ip?: string;
}

/**
 * Enhanced Authentication Service
 * Handles login, logout, token refresh, and session management
 */
export class AuthService {
    private userRepository: UserRepository;
    private sessionService: SessionService;

    constructor() {
        this.userRepository = new UserRepository();
        this.sessionService = new SessionService();
    }

    /**
     * Authenticate user and create session
     */
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const { emailOrUsername, password, userAgent, ip } = credentials;

        try {
            // Find user by email or username
            let user = null;
            if (emailOrUsername.includes("@")) {
                user = await this.userRepository.findByEmail(emailOrUsername.toLowerCase().trim());
            } else {
                user = await this.userRepository.findByUsername(emailOrUsername.trim());
            }

            if (!user) {
                logger.warn("Login failed: User not found", {
                    emailOrUsername,
                    ip,
                });
                throw new Error("Invalid credentials");
            }

            // Verify password
            const isPasswordValid = await compareHash(password, user.password);
            if (!isPasswordValid) {
                logger.warn("Login failed: Invalid password", {
                    userId: user.id,
                    email: user.email,
                    ip,
                });
                throw new Error("Invalid credentials");
            }

            // Check if email is verified (optional - uncomment if required)
            // if (!user.isVerified) {
            //   throw new Error("Please verify your email before logging in");
            // }

            // Generate tokens
            const tokenPayload = {
                userId: user.id,
                email: user.email,
            };

            const tokens = generateAuthenticationToken(tokenPayload);
            if (!tokens) {
                logger.error("Token generation failed", { userId: user.id });
                throw new Error("Failed to generate authentication tokens");
            }

            // Hash refresh token for storage
            const refreshTokenHash = await hashString(tokens.refreshToken);

            // Calculate session expiration
            const expiresAt = new Date(
                Date.now() + Number(CONFIG.REFRESH_TOKEN_EXPIRATION_MINUTES) * 60 * 1000
            );

            // Create session
            const session = await this.sessionService.createSession({
                userId: user.id,
                refreshTokenHash,
                userAgent: userAgent || null,
                ip: ip || null,
                isValid: true,
                expiresAt,
            });

            // Update last login timestamp
            await this.userRepository.update(user.id, {
                lastLoginAt: new Date(),
            });

            // Generate new tokens with session ID
            const finalTokenPayload = {
                userId: user.id,
                email: user.email,
                sessionId: session.id,
            };-

            const finalTokens = generateAuthenticationToken(finalTokenPayload);
            if (!finalTokens) {
                throw new Error("Failed to generate final tokens");
            }

            logger.info("Login successful", {
                userId: user.id,
                email: user.email,
                sessionId: session.id,
                ip,
            });

            // Remove sensitive data
            const { password: _, otp, ...userWithoutPassword } = user;

            return {
                user: userWithoutPassword,
                tokens: {
                    accessToken: finalTokens.accessToken,
                    refreshToken: finalTokens.refreshToken,
                    expiresIn: Number(CONFIG.ACCESS_TOKEN_EXPIRY_MINUTES) * 60,
                },
                sessionId: session.id,
            };
        } catch (error: any) {
            logger.error("Login error:", {
                error: error.message,
                emailOrUsername,
                ip,
            });
            throw error;
        }
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken(request: RefreshTokenRequest): Promise<AuthTokens> {
        const { refreshToken, userAgent, ip } = request;

        try {
            // Verify refresh token
            const decoded = verifyJwtToken(refreshToken, CONFIG.REFRESH_TOKEN_SECRET!);

            if (!decoded || !decoded.userId || !decoded.sessionId) {
                logger.warn("Token refresh failed: Invalid token", { ip });
                throw new Error("Invalid refresh token");
            }

            // Hash the refresh token to compare with stored hash
            const refreshTokenHash = await hashString(refreshToken);

            // Find valid session with matching refresh token
            const session = await this.sessionService.findValidSessionByRefreshToken(
                decoded.userId,
                refreshTokenHash
            );

            if (!session) {
                logger.warn("Token refresh failed: Session not found or invalid", {
                    userId: decoded.userId,
                    sessionId: decoded.sessionId,
                    ip,
                });
                throw new Error("Invalid or expired session");
            }

            // Check if session has expired
            if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
                logger.warn("Token refresh failed: Session expired", {
                    userId: decoded.userId,
                    sessionId: session.id,
                });

                await this.sessionService.updateSession(session.id, { isValid: false });
                throw new Error("Session has expired. Please login again.");
            }

            // Get user
            const user = await this.userRepository.findById(decoded.userId);
            if (!user) {
                logger.warn("Token refresh failed: User not found", {
                    userId: decoded.userId,
                });
                throw new Error("User not found");
            }

            // Generate new access token (keep same refresh token)
            const newTokenPayload = {
                userId: user.id,
                email: user.email,
                sessionId: session.id,
            };

            const newTokens = generateAuthenticationToken(newTokenPayload);
            if (!newTokens) {
                throw new Error("Failed to generate new tokens");
            }

            // Update session last used timestamp
            await this.sessionService.updateSession(session.id, {
                lastUsedAt: new Date(),
                userAgent: userAgent || session.userAgent,
                ip: ip || session.ip,
            });

            logger.info("Token refresh successful", {
                userId: user.id,
                sessionId: session.id,
                ip,
            });

            return {
                accessToken: newTokens.accessToken,
                refreshToken: newTokens.refreshToken,
                expiresIn: Number(CONFIG.ACCESS_TOKEN_EXPIRY_MINUTES) * 60,
            };
        } catch (error: any) {
            logger.error("Token refresh error:", {
                error: error.message,
                ip,
            });
            throw error;
        }
    }

    /**
     * Logout user and invalidate session
     */
    async logout(sessionId: string, userId: string): Promise<void> {
        try {
            const session = await this.sessionService.getSessionById(sessionId);

            if (!session) {
                logger.warn("Logout failed: Session not found", {
                    sessionId,
                    userId,
                });
                throw new Error("Session not found");
            }

            if (session.userId !== userId) {
                logger.warn("Logout failed: Session user mismatch", {
                    sessionId,
                    userId,
                    sessionUserId: session.userId,
                });
                throw new Error("Unauthorized");
            }

            // Invalidate session
            await this.sessionService.updateSession(sessionId, {
                isValid: false,
            });

            logger.info("Logout successful", {
                userId,
                sessionId,
            });
        } catch (error: any) {
            logger.error("Logout error:", {
                error: error.message,
                sessionId,
                userId,
            });
            throw error;
        }
    }

    /**
     * Logout from all devices (invalidate all sessions)
     */
    async logoutAllDevices(userId: string): Promise<number> {
        try {
            const count = await this.sessionService.invalidateAllSessions(userId);

            logger.info("Logout from all devices successful", {
                userId,
                sessionsInvalidated: count,
            });

            return count;
        } catch (error: any) {
            logger.error("Logout all devices error:", {
                error: error.message,
                userId,
            });
            throw error;
        }
    }

    /**
     * Get all active sessions for a user
     */
    async getActiveSessions(userId: string) {
        try {
            const sessions = await this.sessionService.getSessionsByUserId(userId);

            // Filter and format active sessions
            const activeSessions = sessions
                .filter((session) => {
                    if (!session.isValid) return false;
                    if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
                        return false;
                    }
                    return true;
                })
                .map((session) => ({
                    id: session.id,
                    userAgent: session.userAgent,
                    ip: session.ip,
                    createdAt: session.createdAt,
                    lastUsedAt: session.lastUsedAt,
                    expiresAt: session.expiresAt,
                }));

            return activeSessions;
        } catch (error: any) {
            logger.error("Get active sessions error:", {
                error: error.message,
                userId,
            });
            throw error;
        }
    }

    /**
     * Revoke a specific session
     */
    async revokeSession(sessionId: string, userId: string): Promise<void> {
        try {
            const session = await this.sessionService.getSessionById(sessionId);

            if (!session) {
                throw new Error("Session not found");
            }

            if (session.userId !== userId) {
                throw new Error("Unauthorized");
            }

            await this.sessionService.updateSession(sessionId, {
                isValid: false,
            });

            logger.info("Session revoked", {
                userId,
                sessionId,
            });
        } catch (error: any) {
            logger.error("Revoke session error:", {
                error: error.message,
                sessionId,
                userId,
            });
            throw error;
        }
    }

    /**
     * Verify if a session is valid
     */
    async verifySession(sessionId: string): Promise<boolean> {
        try {
            const session = await this.sessionService.getSessionById(sessionId);

            if (!session || !session.isValid) {
                return false;
            }

            if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
                await this.sessionService.updateSession(sessionId, { isValid: false });
                return false;
            }

            return true;
        } catch (error: any) {
            logger.error("Verify session error:", {
                error: error.message,
                sessionId,
            });
            return false;
        }
    }
}
