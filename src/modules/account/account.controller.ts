import { Request, Response, NextFunction } from "express";
import { AccountService } from "./account.service.js";
import { sendResponse } from "../../utils/response.utils.js";
import { AuthenticatedRequest } from "@/middlewares/auth.middleware.js";
import { CreateAccountMemberResponse } from "../shared/account-member/dto/account-member.dto.js";
import { AppError } from "@/utils/app-error.utils.js";

export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  /* ---------------- CREATE ACCOUNT ---------------- */

  createAccount = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      // const userId = req.user!.id;
      const body = req.body;

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

      return sendResponse(res, response, "Account created successfully", 201);
    } catch (error) {
      next(error);
    }
  };

  /* ---------------- GET MY ACCOUNTS ---------------- */

  getMyAccounts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;

      const accounts = await this.accountService.getAccountsForUser(userId);

      return sendResponse(res, accounts, "", 200);
    } catch (error) {
      next(error);
    }
  };

  /* ---------------- GET ACCOUNT BY ID ---------------- */

  getAccountById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { accountId } = req.params as { accountId: string };
      const userId = (req as AuthenticatedRequest).user!.id;

      const account = await this.accountService.getAccountById(
        accountId,
        userId,
      );

      if (!account) {
        throw new AppError("Account not found", 404);
      }

      return sendResponse(res, account, "Success", 200);
    } catch (error) {
      next(error);
    }
  };

  /* ---------------- UPDATE ACCOUNT ---------------- */

  updateAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { accountId } = req.params as { accountId: string };
      const userId = (req as AuthenticatedRequest).user!.id;
      const body = req.body;
      await this.accountService.ensureUserIsMember(userId, accountId);
      const updatedAccount = await this.accountService.updateAccount(
        accountId,
        body,
      );

      return sendResponse(
        res,
        updatedAccount,
        "Account updated successfully",
        200,
      );
    } catch (error) {
      next(error);
    }
  };

  /* ---------------- DELETE ACCOUNT ---------------- */

  deleteAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { accountId } = req.params as { accountId: string };
      const userId = (req as AuthenticatedRequest).user!.id;

      await this.accountService.ensureUserIsMember(userId, accountId);

      await this.accountService.deleteAccount(accountId);

      return sendResponse(res, null, "Account deleted successfully", 200);
    } catch (error) {
      next(error);
    }
  };
}
