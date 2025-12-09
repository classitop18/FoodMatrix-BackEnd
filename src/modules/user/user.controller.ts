import { Request, Response, NextFunction } from "express";
import {
    CheckPropertyExistSchema,
    createUserSchema,
    paginationSchema,
    updatePasswordSchema,
    updateUserSchema,
    userFiltersSchema,
    userLoginSchema,
    verifyEmailSchema,
    verifyUserSchema,
} from "./schema/user.schema";
import { IUserService } from "./user.service";
import { ApiResponse } from "../../types";
import { sendSuccess } from "../../utils/response.utils";
import {
    addOtpVerificationEmailJob,
    addVerificationEmailJob,
} from "../../queues/jobs/email.jobs";
import {
    generateAuthenticationToken,
    generateJwtToken,
} from "../../utils/jwt.utils";
import { CONFIG } from "../../utils/env.config";
import { exists } from "drizzle-orm";

export class UserController {
    constructor(private userService: IUserService) { }

    createUser = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<ApiResponse | any> => {
        try {
            const validated = createUserSchema.parse(req.body);
            const user = await this.userService.createUser(validated);

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
            const validated = userLoginSchema.parse(req.body);
            const { user } = await this.userService.loginUser(validated);

            //  Case:1 =>  check if user is verified
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

            // Case:2 => check if MFA is enabled

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
            const authTokens = await generateAuthenticationToken(user);
            if (!authTokens) {
                return sendSuccess(
                    res,
                    null,
                    "Failed to generate authentication tokens",
                    500,
                );
            }
            const { refreshToken, accessToken } = authTokens;

            res.cookie("refreshToken", refreshToken, {
                httpOnly: true,
                secure: CONFIG.NODE_ENV === "production",
                sameSite: "strict",
                maxAge:
                    Number(CONFIG.REFRESH_TOKEN_EXPIRATION_MINUTES || 7) *
                    24 *
                    60 *
                    60 *
                    1000,
            });

            const userResponse = {
                ...user,
                accessToken,
            };

            sendSuccess(res, userResponse, "User logged in successfully", 200);
        } catch (error) {

            next(error);
        }
    };




    checkIsPropertytExist = async (req: Request, res: Response, next: NextFunction) => {
        try {

            const validated = CheckPropertyExistSchema.parse(req?.body)
            const user = await this.userService.findUserByField(validated);

            return sendSuccess(
                res,
                { exists: !!user },
                user
                    ? `User already exists with this ${validated.field}.`
                    : `No user found with this ${validated.field}.`,
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
            const validated = verifyEmailSchema.parse(req.body);
            const user = await this.userService.verifyUserEmailUsingToken(validated);
            sendSuccess(res, user, "Email verified successfully");
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
}
