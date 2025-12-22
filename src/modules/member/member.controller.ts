import { Request, Response, NextFunction } from "express";

import { ZodError } from "zod";
import { IMemberService, MemberService } from "./member.service.js";
import {
  bulkDeleteMembersSchema,
  bulkUpdateRoleSchema,
  createMemberSchema,
  transferOwnershipSchema,
  updateMemberSchema,
} from "./dto/member.dto.js";
import { sendSuccess } from "@/utils/response.utils.js";
import { MemberError } from "./types/member.types.js";
import { AuthenticatedRequest } from "@/middlewares/auth.middleware.js";

export class MemberController {
  constructor(
    private readonly memberService: IMemberService = new MemberService(),
  ) {}
  /**
   * POST /api/members
   * Create a new member
   */
  createMember = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const requesterId = req.user?.id; // Assuming auth middleware sets req.user
      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const validatedData = createMemberSchema.parse(req.body);
      const member = await this.memberService.createMember(
        validatedData,
        requesterId,
      );

      return res.status(201).json({
        success: true,
        data: member,
        message: "Member created successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/members/:id
   * Get member by ID
   */
  getMemberById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const member = await this.memberService.getMemberById(id, requesterId);

      return res.status(200).json({
        success: true,
        data: member,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/members
   * Get all members with filters and pagination
   */
  getMembers = async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req?.user?.id;

      const result = await this.memberService.getMembers(
        {
          accountId: req?.query?.accountId,
          page: req?.query?.page || 1,
          limit: req?.query?.limit || 10,
          sortBy: req?.query?.sortBy || "createdAt",
          sortOrder: req?.query?.sortOrder || "desc",
        },
        userId,
      );

      return sendSuccess(res, result, "Members fetched successfully", 200);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/accounts/:accountId/members
   * Get all members of an account
   */
  getAccountMembers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { accountId } = req.params;
      const members = await this.memberService.getAccountMembers(
        accountId,
        requesterId,
      );

      return res.status(200).json({
        success: true,
        data: members,
        count: members.length,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/accounts/:accountId/members/internal
   * Get internal members only
   */
  getInternalMembers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { accountId } = req.params;
      const members = await this.memberService.getInternalMembers(
        accountId,
        requesterId,
      );

      return res.status(200).json({
        success: true,
        data: members,
        count: members.length,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/accounts/:accountId/members/registered
   * Get registered members only
   */
  getRegisteredMembers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { accountId } = req.params;
      const members = await this.memberService.getRegisteredMembers(
        accountId,
        requesterId,
      );

      return res.status(200).json({
        success: true,
        data: members,
        count: members.length,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/members/:id
   * Update member
   */
  updateMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const validatedData = updateMemberSchema.parse(req.body);
      const member = await this.memberService.updateMember(
        id,
        validatedData,
        requesterId,
      );

      return res.status(200).json({
        success: true,
        data: member,
        message: "Member updated successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/members/:id
   * Delete member
   */
  deleteMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      await this.memberService.deleteMember(id, requesterId);

      return res.status(200).json({
        success: true,
        message: "Member deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/accounts/:accountId/members/transfer-ownership
   * Transfer account ownership
   */
  transferOwnership = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { accountId } = req.params;
      const validatedData = transferOwnershipSchema.parse(req.body);
      await this.memberService.transferOwnership(
        accountId,
        validatedData,
        requesterId,
      );

      return res.status(200).json({
        success: true,
        message: "Ownership transferred successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/members/:id/role
   * Update member role
   */
  updateMemberRole = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({ error: "Role is required" });
      }

      const member = await this.memberService.updateMemberRole(
        id,
        role,
        requesterId,
      );

      return res.status(200).json({
        success: true,
        data: member,
        message: "Role updated successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/members/bulk-update-role
   * Bulk update member roles
   */
  bulkUpdateRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const validatedData = bulkUpdateRoleSchema.parse(req.body);
      const result = await this.memberService.bulkUpdateRole(
        validatedData,
        requesterId,
      );

      return res.status(200).json({
        success: true,
        data: result,
        message: `${result.updated} members updated successfully`,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/members/bulk-delete
   * Bulk delete members
   */
  bulkDeleteMembers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const validatedData = bulkDeleteMembersSchema.parse(req.body);
      const result = await this.memberService.bulkDeleteMembers(
        validatedData,
        requesterId,
      );

      return res.status(200).json({
        success: true,
        data: result,
        message: `${result.deleted} members deleted successfully`,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/accounts/:accountId/members/stats
   * Get member statistics
   */
  getMemberStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { accountId } = req.params;
      const stats = await this.memberService.getMemberStats(
        accountId,
        requesterId,
      );

      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/members/:id/permissions
   * Get member permissions
   */
  getMemberPermissions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const permissions = await this.memberService.getMemberPermissions(
        id,
        requesterId,
      );

      return res.status(200).json({
        success: true,
        data: permissions,
      });
    } catch (error) {
      next(error);
    }
  };
}

// Error handler middleware
export const memberErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error("Member Error:", error);

  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: "Validation error",
      details: error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  }

  if (error instanceof MemberError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code,
    });
  }

  return res.status(500).json({
    success: false,
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
};
