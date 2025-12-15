import { Router } from "express";
import { AccountRepository } from "../modules/account/account.repository.ts";
import { AccountService } from "../modules/account/account.service.ts";
import { AccountController } from "../modules/account/account.controller.ts";
import { validate } from "../middlewares/validation.middleware.ts";
import { authenticate } from "../middlewares/auth.middleware.ts";
import { accountIdParamSchema, createAccountSchema, updateAccountSchema } from "../modules/account/dto/account.dto.ts";


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
router.get(
    "/",
    authenticate,
    accountController.getMyAccounts,
);

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
