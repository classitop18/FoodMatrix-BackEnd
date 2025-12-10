import { Request, Response, NextFunction } from "express";
import {
    checkPropertyExistSchema,
    createUserSchema,
    paginationSchema,
    updatePasswordSchema,
    updateUserSchema,
    userFiltersSchema,
    userLoginSchema,
    verifyEmailSchema,
    verifyUserSchema,
} from "./schema/user.schema.ts";
import { IUserService } from "./user.service.ts";
import { ApiResponse } from "../../types/index.ts";
import { sendSuccess } from "../../utils/response.utils.ts";
import {
    addOtpVerificationEmailJob,
    addVerificationEmailJob,
} from "../../queues/jobs/email.jobs.ts";
import {
    generateAuthenticationToken,
    generateJwtToken,
} from "../../utils/jwt.utils.ts";
import { CONFIG } from "../../utils/env.config.ts";
import { ISessionService } from "../session/session.service.ts";
import { hashString } from "../../utils/bcrypt.utils.ts";


export class UserController {
    constructor(private userService: IUserService, private sessionService: ISessionService) { }

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
                    Number(CONFIG.TOKEN_EXPIRATION_MINUTES || 60),
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
                    { userId: user.id, mfaPending: true },
                    10, // 10 minutes to complete MFA
                    CONFIG.TOKEN_SECRET!,
                );
                const otp = await this.userService.getVerificationOtp(user?.email);
                await addOtpVerificationEmailJob({
                    to: user.email,
                    otp,
                    name: user.firstName,
                    expiresMins: Number(CONFIG.OTP_EXPIRATION_MINUTES),
                });
                return sendSuccess(
                    res,
                    { mfaRequired: true, tempSessionId },
                    "MFA required. Please verify.",
                    200,
                );
            }

            // Create session first
            const tempRefreshToken = await generateJwtToken(
                { userId: user.id, sessionId: "temp" }, // Temporary
                Number(CONFIG.REFRESH_TOKEN_EXPIRATION_MINUTES),
                CONFIG.REFRESH_TOKEN_SECRET!,
            ) || "";

            // Hash refresh token for storage
            const refreshTokenHash = await hashString(tempRefreshToken);

            // Calculate session expiration
            const expiresAt = new Date(
                Date.now() + Number(CONFIG.REFRESH_TOKEN_EXPIRATION_MINUTES) * 60 * 1000
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
            })

            const newRefreshTokenHash = await hashString(refreshToken);

            await this.sessionService.updateSession(session.id, {
                refreshTokenHash: newRefreshTokenHash,
            });

            res.cookie("refreshToken", refreshToken, {
                httpOnly: true, // JavaScript cannot access
                secure: CONFIG.NODE_ENV === "production", // HTTPS only in production
                sameSite: "strict", // CSRF protection
                maxAge:
                    Number(CONFIG.REFRESH_TOKEN_EXPIRATION_MINUTES || 10080) *
                    60 *
                    1000, // 7 days in milliseconds
            });

            const userResponse = {
                ...user,
                accessToken, // Client stores this
                sessionId: session.id, // Optional: for reference only
            };

            return sendSuccess(res, { ...userResponse }, "User logged in successfully", 200);
        } catch (error) {
            next(error);
        }
    };




    checkIsPropertytExist = async (req: Request, res: Response, next: NextFunction) => {
        try {

            const user = await this.userService.findUserByField(req.body);

            return sendSuccess(
                res,
                { exists: !!user },
                user
                    ? `User already exists with this ${req.body.field}.`
                    : `No user found with this ${req.body.field}.`,
                200
            );
        } catch (error: any) {
            next(error)

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

    updateUser = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const validated = updateUserSchema.parse(req.body);
            const user = await this.userService.updateUser(id, validated);

            res.status(200).json({
                success: true,
                message: "User updated successfully",
                data: user,
            });
        } catch (error) {
            next(error);
        }
    };

    deleteUser = async (req: Request, res: Response, next: NextFunction) => {
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

    changePassword = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const validated = updatePasswordSchema.parse(req.body);
            await this.userService.changePassword(id, validated);

            res.status(200).json({
                success: true,
                message: "Password changed successfully",
            });
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

    verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const token = req.query?.token;
            if (typeof token !== "string") {
                throw new Error("Invalid or missing token");
            }
            const user = await this.userService.verifyUserEmailUsingToken({ token });
            res.redirect(CONFIG.FRONTEND_BASE_URL + "/login")
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
    }

}
