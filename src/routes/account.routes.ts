import { authenticate } from "@/middlewares/auth.middleware.js";
import { validate } from "@/middlewares/validation.middleware.js";
import { AccountController } from "@/modules/account/account.controller.js";
import { AccountRepository } from "@/modules/account/account.repository.js";
import { AccountService } from "@/modules/account/account.service.js";
import { accountIdParamSchema, createAccountSchema, updateAccountSchema } from "@/modules/account/dto/account.dto.js";
import { Router } from "express";


const router = Router();

/* ---------------- INIT DEPENDENCIES ---------------- */

const accountRepository = new AccountRepository();
const accountService = new AccountService(accountRepository);
const accountController = new AccountController(accountService);

/* ---------------- ROUTES ---------------- */

/**
 * Create new account
 */
router.post(
  "/",
  authenticate,
  validate(createAccountSchema, "body"),
  accountController.createAccount,
);

/**
 * Get all accounts of logged-in user
 */
router.get("/", authenticate, accountController.getMyAccounts);

/**
 * Get account by id
 */
router.get(
  "/:accountId",
  authenticate,
  validate(accountIdParamSchema, "params"),
  accountController.getAccountById,
);

/**
 * Update account
 */
router.put(
  "/:accountId",
  authenticate,
  validate(accountIdParamSchema, "params"),
  validate(updateAccountSchema, "body"),
  accountController.updateAccount,
);

/**
 * Delete account
 */
router.delete(
  "/:accountId",
  authenticate,
  validate(accountIdParamSchema, "params"),
  accountController.deleteAccount,
);

export default router;
