import { Response, NextFunction } from "express";
import { IMemberService, MemberService } from "./member.service.js";
import {
  bulkDeleteMembersSchema,
  bulkUpdateRoleSchema,
  createMemberSchema,
  transferOwnershipSchema,
  updateMemberSchema,
} from "./dto/member.dto.js";
import { sendResponse } from "@/utils/response.utils.js";
import { AuthenticatedRequest } from "@/middlewares/auth.middleware.js";
import { AppError } from "@/utils/app-error.utils.js";
import { MemberQueryOptions } from "./types/member.types.js";

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
        throw new AppError("Unauthorized", 401);
      }

      const validatedData = createMemberSchema.parse(req.body);
      const member = await this.memberService.createMember(
        validatedData,
        requesterId,
      );

      return sendResponse(res, member, "Member created successfully", 201);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/members/:id
   * Get member by ID
   */
  getMemberById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        throw new AppError("Unauthorized", 401);
      }

      const { id } = req.params;
      const member = await this.memberService.getMemberById(id, requesterId);

      return sendResponse(res, member, "Member fetched successfully", 200);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/members
   * Get all members with filters and pagination
   */
  getMembers = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user!.id;

      // Manually construct query object or assume service handles partials
      const query: MemberQueryOptions = {
        accountId: req.query.accountId as string,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 10,
        sortBy:
          (req.query.sortBy as "createdAt" | "name" | "role") || "createdAt",
        sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc",
        includeHealthProfile: req.query.includeHealthProfile === "true", // Handle string boolean
      };

      const result = await this.memberService.getMembers(query as any, userId);

      return sendResponse(res, result, "Members fetched successfully", 200);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/accounts/:accountId/members
   * Get all members of an account
   */
  getAccountMembers = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        throw new AppError("Unauthorized", 401);
      }

      const { accountId } = req.params;
      const members = await this.memberService.getAccountMembers(
        accountId,
        requesterId,
      );

      return sendResponse(
        res,
        members,
        "Account members fetched successfully",
        200,
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/accounts/:accountId/members/internal
   * Get internal members only
   */
  getInternalMembers = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        throw new AppError("Unauthorized", 401);
      }

      const { accountId } = req.params;
      const members = await this.memberService.getInternalMembers(
        accountId,
        requesterId,
      );

      return sendResponse(
        res,
        members,
        "Internal members fetched successfully",
        200,
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/accounts/:accountId/members/registered
   * Get registered members only
   */
  getRegisteredMembers = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        throw new AppError("Unauthorized", 401);
      }

      const { accountId } = req.params;
      const members = await this.memberService.getRegisteredMembers(
        accountId,
        requesterId,
      );

      return sendResponse(
        res,
        members,
        "Registered members fetched successfully",
        200,
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/members/:id
   * Update member
   */
  updateMember = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        throw new AppError("Unauthorized", 401);
      }

      const { id } = req.params;
      const validatedData = updateMemberSchema.parse(req.body);
      const member = await this.memberService.updateMember(
        id,
        validatedData,
        requesterId,
      );

      return sendResponse(res, member, "Member updated successfully", 200);
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/members/:id
   * Delete member
   */
  deleteMember = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        throw new AppError("Unauthorized", 401);
      }

      const { id } = req.params;
      await this.memberService.deleteMember(id, requesterId);

      return sendResponse(res, null, "Member deleted successfully", 200);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/accounts/:accountId/members/transfer-ownership
   * Transfer account ownership
   */
  transferOwnership = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        throw new AppError("Unauthorized", 401);
      }

      const { accountId } = req.params;
      const validatedData = transferOwnershipSchema.parse(req.body);
      await this.memberService.transferOwnership(
        accountId,
        validatedData,
        requesterId,
      );

      return sendResponse(res, null, "Ownership transferred successfully", 200);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/members/:id/role
   * Update member role
   */
  updateMemberRole = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        throw new AppError("Unauthorized", 401);
      }

      const { id } = req.params;
      const { role } = req.body;

      if (!role) {
        throw new AppError("Role is required", 400);
      }

      const member = await this.memberService.updateMemberRole(
        id,
        role,
        requesterId,
      );

      return sendResponse(res, member, "Role updated successfully", 200);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/members/bulk-update-role
   * Bulk update member roles
   */
  bulkUpdateRole = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        throw new AppError("Unauthorized", 401);
      }

      const validatedData = bulkUpdateRoleSchema.parse(req.body);
      const result = await this.memberService.bulkUpdateRole(
        validatedData,
        requesterId,
      );

      return sendResponse(
        res,
        result,
        `${result.updated} members updated successfully`,
        200,
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/members/bulk-delete
   * Bulk delete members
   */
  bulkDeleteMembers = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        throw new AppError("Unauthorized", 401);
      }

      const validatedData = bulkDeleteMembersSchema.parse(req.body);
      const result = await this.memberService.bulkDeleteMembers(
        validatedData,
        requesterId,
      );

      return sendResponse(
        res,
        result,
        `${result.deleted} members deleted successfully`,
        200,
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/accounts/:accountId/members/stats
   * Get member statistics
   */
  getMemberStats = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        throw new AppError("Unauthorized", 401);
      }

      const { accountId } = req.params;
      const stats = await this.memberService.getMemberStats(
        accountId,
        requesterId,
      );

      return sendResponse(res, stats, "Stats fetched successfully", 200);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/members/:id/permissions
   * Get member permissions
   */
  getMemberPermissions = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        throw new AppError("Unauthorized", 401);
      }

      const { id } = req.params;
      const permissions = await this.memberService.getMemberPermissions(
        id,
        requesterId,
      );

      return sendResponse(
        res,
        permissions,
        "Permissions fetched successfully",
        200,
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/members/:id/avatar
   * Upload member avatar
   */
  uploadMemberAvatar = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        throw new AppError("Unauthorized", 401);
      }

      const { id } = req.params;

      if (!req.file) {
        throw new AppError("No file uploaded", 400);
      }

      const filename = req.file.filename;
      const avatarUrl = `/uploads/${filename}`;

      const member = await this.memberService.updateMember(
        id,
        { avatar: avatarUrl },
        requesterId,
      );

      return sendResponse(res, member, "Avatar uploaded successfully", 200);
    } catch (error) {
      next(error);
    }
  };
}
