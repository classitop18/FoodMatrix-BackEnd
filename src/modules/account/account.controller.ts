import { Request, Response, NextFunction } from "express";
import { AccountService } from "./account.service.js";
import { sendSuccess } from "../../utils/response.utils.js";
import { AuthenticatedRequest } from "@/middlewares/auth.middleware.js";
import { CreateAccountMemberResponse } from "../shared/account-member/dto/account-member.dto.js";

export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  /* ---------------- CREATE ACCOUNT ---------------- */

  createAccount = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = (req as any).user.id;
      const body = req.body;

      console.log({ accountD: body });

      const primaryAdminId = req.user!.id;

      const result = await this.accountService.createAccount({
        ...body,
        primaryAdminId,
      });

      const response: CreateAccountMemberResponse = {
        accountId: result.accountId,
        memberId: result.memberId,
        healthProfileId: result.healthProfileId,
      };

      res.status(201).json({
        success: true,
        message: "Account created successfully",
        data: response,
      });
    } catch (error) {
      next(error);
    }
  };

  /* ---------------- GET MY ACCOUNTS ---------------- */

  getMyAccounts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.id;

      const accounts = await this.accountService.getAccountsForUser(userId);

      sendSuccess(res, accounts, "", 200);
    } catch (error) {
      next(error);
    }
  };

  /* ---------------- GET ACCOUNT BY ID ---------------- */

  getAccountById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { accountId } = req.params as { accountId: string };
      const userId = (req as any).user.id;

      // await this.accountService.ensureUserIsMember(userId, accountId);

      const account = await this.accountService.getAccountById(
        accountId,
        userId,
      );

      if (!account) {
        return res.status(404).json({
          success: false,
          message: "Account not found",
        });
      }

      res.status(200).json({
        success: true,
        data: account,
      });
    } catch (error) {
      next(error);
    }
  };

  // getAccount = async (
  //     req: Request,
  //     res: Response,
  //     next: NextFunction,
  // ) => {
  //     try {
  //         const { accountId } = req.params as { accountId: string };
  //         const userId = (req as any).user.id;

  //         await this.accountService.ensureUserIsMember(userId, accountId);

  //         const account = await this.accountService.getAccountById(accountId);

  //         if (!account) {
  //             return res.status(404).json({
  //                 success: false,
  //                 message: "Account not found",
  //             });
  //         }

  //         res.status(200).json({
  //             success: true,
  //             data: account,
  //         });
  //     } catch (error) {
  //         next(error);
  //     }
  // };

  /* ---------------- UPDATE ACCOUNT ---------------- */

  updateAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { accountId } = req.params as { accountId: string };
      const userId = (req as any).user.id;
      const body = req.body;
      await this.accountService.ensureUserIsMember(userId, accountId);
      const updatedAccount = await this.accountService.updateAccount(
        accountId,
        body,
      );

      res.status(200).json({
        success: true,
        message: "Account updated successfully",
        data: updatedAccount,
      });
    } catch (error) {
      next(error);
    }
  };

  /* ---------------- DELETE ACCOUNT ---------------- */

  deleteAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { accountId } = req.params as { accountId: string };
      const userId = (req as any).user.id;

      await this.accountService.ensureUserIsMember(userId, accountId);

      await this.accountService.deleteAccount(accountId);

      res.status(200).json({
        success: true,
        message: "Account deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };
}
