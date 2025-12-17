import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.middleware.js";
import { logger } from "../utils/logger.utils.js";
import { sendError } from "../utils/response.utils.js";
import { getDb } from "../database/db.js";
import { members, accounts } from "../database/schema.js";
import { eq, and } from "drizzle-orm";

/**
 * Role hierarchy for permission checking
 * Higher number = more permissions
 */
const ROLE_HIERARCHY = {
  viewer: 1,
  creator: 2,
  admin: 3,
  super_admin: 4,
} as const;

type RoleType = keyof typeof ROLE_HIERARCHY;

/**
 * Get user's role in a specific account
 */
async function getUserAccountRole(
  userId: string,
  accountId: string,
): Promise<RoleType | null> {
  try {
    const db = getDb();

    const [member] = await db
      .select()
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.accountId, accountId)))
      .limit(1);

    return (member?.role as RoleType) || null;
  } catch (error: any) {
    logger.error("Failed to get user account role:", {
      error: error.message,
      userId,
      accountId,
    });
    return null;
  }
}

/**
 * Check if user is the primary admin of an account
 */
async function isPrimaryAdmin(
  userId: string,
  accountId: string,
): Promise<boolean> {
  try {
    const db = getDb();

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    return account?.primaryAdminId === userId;
  } catch (error: any) {
    logger.error("Failed to check primary admin status:", {
      error: error.message,
      userId,
      accountId,
    });
    return false;
  }
}

/**
 * Role-Based Access Control Middleware Factory
 * Checks if user has required role or higher in the account
 *
 * @param requiredRole - Minimum role required to access the resource
 * @param accountIdParam - Name of the route parameter containing accountId (default: 'accountId')
 *
 * @example
 * router.get('/accounts/:accountId/settings',
 *   authenticate,
 *   requireRole('admin'),
 *   controller.getSettings
 * );
 */
export const requireRole = (
  requiredRole: RoleType,
  accountIdParam: string = "accountId",
) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        return sendError(res, "Authentication required.", null, 401);
      }

      // Get accountId from route params, query, or body
      const accountId =
        req.params[accountIdParam] ||
        req.query[accountIdParam] ||
        (req.body && req.body[accountIdParam]);

      if (!accountId) {
        logger.warn("Authorization failed: No account ID provided", {
          userId: req.user.id,
          path: req.path,
          requiredRole,
        });

        return sendError(res, "Account ID is required.", null, 400);
      }

      // Get user's role in this account
      const userRole = await getUserAccountRole(
        req.user.id,
        accountId as string,
      );

      if (!userRole) {
        logger.warn("Authorization failed: User not a member of account", {
          userId: req.user.id,
          accountId,
          requiredRole,
        });

        return sendError(
          res,
          "You do not have access to this account.",
          null,
          403,
        );
      }

      // Check if user's role meets the requirement
      const userRoleLevel = ROLE_HIERARCHY[userRole];
      const requiredRoleLevel = ROLE_HIERARCHY[requiredRole];

      if (userRoleLevel < requiredRoleLevel) {
        logger.warn("Authorization failed: Insufficient permissions", {
          userId: req.user.id,
          accountId,
          userRole,
          requiredRole,
        });

        return sendError(
          res,
          `This action requires ${requiredRole} role or higher.`,
          {
            userRole,
            requiredRole,
          },
          403,
        );
      }

      // Attach role to request for use in controllers
      req.user.role = userRole;

      logger.info("Authorization successful", {
        userId: req.user.id,
        accountId,
        userRole,
        requiredRole,
        path: req.path,
      });

      next();
    } catch (error: any) {
      logger.error("Authorization middleware error:", {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
      });

      return sendError(res, "Authorization check failed.", null, 500);
    }
  };
};

/**
 * Require Primary Admin Access
 * Only allows the primary admin of an account to access the resource
 *
 * @param accountIdParam - Name of the route parameter containing accountId
 *
 * @example
 * router.delete('/accounts/:accountId',
 *   authenticate,
 *   requirePrimaryAdmin(),
 *   controller.deleteAccount
 * );
 */
export const requirePrimaryAdmin = (accountIdParam: string = "accountId") => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        return sendError(res, "Authentication required.", null, 401);
      }

      const accountId =
        req.params[accountIdParam] ||
        req.query[accountIdParam] ||
        (req.body && req.body[accountIdParam]);

      if (!accountId) {
        return sendError(res, "Account ID is required.", null, 400);
      }

      const isAdmin = await isPrimaryAdmin(req.user.id, accountId as string);

      if (!isAdmin) {
        logger.warn("Authorization failed: Not primary admin", {
          userId: req.user.id,
          accountId,
        });

        return sendError(
          res,
          "This action can only be performed by the primary account admin.",
          null,
          403,
        );
      }

      logger.info("Primary admin authorization successful", {
        userId: req.user.id,
        accountId,
        path: req.path,
      });

      next();
    } catch (error: any) {
      logger.error("Primary admin check error:", {
        error: error.message,
        userId: req.user?.id,
      });

      return sendError(res, "Authorization check failed.", null, 500);
    }
  };
};

/**
 * Require Account Membership
 * Checks if user is a member of the account (any role)
 *
 * @param accountIdParam - Name of the route parameter containing accountId
 */
export const requireAccountMembership = (
  accountIdParam: string = "accountId",
) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        return sendError(res, "Authentication required.", null, 401);
      }

      const accountId =
        req.params[accountIdParam] ||
        req.query[accountIdParam] ||
        (req.body && req.body[accountIdParam]);

      if (!accountId) {
        return sendError(res, "Account ID is required.", null, 400);
      }

      const userRole = await getUserAccountRole(
        req.user.id,
        accountId as string,
      );

      if (!userRole) {
        logger.warn("Authorization failed: Not a member", {
          userId: req.user.id,
          accountId,
        });

        return sendError(
          res,
          "You are not a member of this account.",
          null,
          403,
        );
      }

      req.user.role = userRole;

      logger.info("Account membership verified", {
        userId: req.user.id,
        accountId,
        userRole,
      });

      next();
    } catch (error: any) {
      logger.error("Account membership check error:", {
        error: error.message,
        userId: req.user?.id,
      });

      return sendError(res, "Membership check failed.", null, 500);
    }
  };
};

/**
 * Require Resource Ownership
 * Checks if the authenticated user owns the resource
 *
 * @param userIdParam - Name of the route parameter containing userId
 *
 * @example
 * router.patch('/users/:userId/profile',
 *   authenticate,
 *   requireOwnership('userId'),
 *   controller.updateProfile
 * );
 */
export const requireOwnership = (userIdParam: string = "userId") => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        return sendError(res, "Authentication required.", null, 401);
      }

      const resourceUserId =
        req.params[userIdParam] ||
        req.query[userIdParam] ||
        (req.body && req.body[userIdParam]);

      if (!resourceUserId) {
        return sendError(res, "User ID is required.", null, 400);
      }

      if (req.user.id !== resourceUserId) {
        logger.warn("Authorization failed: Not resource owner", {
          userId: req.user.id,
          resourceUserId,
          path: req.path,
        });

        return sendError(
          res,
          "You can only access your own resources.",
          null,
          403,
        );
      }

      next();
    } catch (error: any) {
      logger.error("Ownership check error:", {
        error: error.message,
        userId: req.user?.id,
      });

      return sendError(res, "Ownership check failed.", null, 500);
    }
  };
};
