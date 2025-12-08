



import { Request, Response, NextFunction } from "express";
import { createUserSchema, paginationSchema, updatePasswordSchema, updateUserSchema, userFiltersSchema, verifyEmailSchema, verifyUserSchema } from "./schema/user.schema";
import { IUserService } from "./user.service";
import { ApiResponse } from "../../types";
import { sendSuccess } from "../../utils/response.utils";
import { addVerificationEmailJob } from "../../queues/jobs/email.jobs";
import { generateJwtToken } from "../../utils/jwt.utils";
import { CONFIG } from "../../utils/env.config";

export class UserController {

    constructor(private userService: IUserService) { }

    createUser = async (req: Request, res: Response, next: NextFunction): Promise<ApiResponse | any> => {
        try {
            const validated = createUserSchema.parse(req.body);
            const user = await this.userService.createUser(validated);

            const token = await generateJwtToken({ userId: user.id }, Number(CONFIG.TOKEN_EXPIRATION_MINUTES || 60), CONFIG.TOKEN_SECRET!);
            await addVerificationEmailJob({
                to: user.email,
                name: user.firstName,
                token: token!,
                expiresIn: Number(CONFIG.TOKEN_EXPIRATION_MINUTES),
            });

            sendSuccess(res, user, "User created successfully. Please verify your email.", 201);

        } catch (error) {
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

    sendVerificationOtp = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email } = req.body;
            await this.userService.sendVerificationOtp(email);

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

            res.status(200).json({
                success: true,
                message: "Email verified successfully",
                data: user,
            });
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

