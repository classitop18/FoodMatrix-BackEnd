import type { NextFunction, Response, Request } from "express";
import { InvitationService } from "./invitation.service.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { sendResponse } from "../../utils/response.utils.js";
import { AppError } from "@/utils/app-error.utils.js";
import {
  createInvitationSchema,
  acceptInvitationSchema,
  approveInvitationSchema,
  rejectInvitationSchema,
  resendInvitationSchema,
  cancelInvitationSchema,
  getInvitationsQuerySchema,
} from "./dto/invitation.dto.js";

export class InvitationController {
  private service: InvitationService;

  constructor() {
    this.service = new InvitationService();
  }

  // ============ SEND INVITATION ============
  sendInvitation = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const validatedData = createInvitationSchema.parse(req.body);
      const userId = req.user!.id;

      const invitation = await this.service.sendInvitation(
        validatedData,
        userId,
      );

      return sendResponse(res, invitation, "Invitation sent successfully", 201);
    } catch (error) {
      next(error);
    }
  };

  // ============ ACCEPT INVITATION (USER) ============
  acceptInvitation = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const validatedData = acceptInvitationSchema.parse(req.body);
      const userEmail = req.user!.email;

      const invitation = await this.service.acceptInvitation(
        validatedData,
        userEmail,
      );

      return sendResponse(
        res,
        invitation,
        "Invitation accepted successfully. Waiting for admin approval.",
      );
    } catch (error) {
      next(error);
    }
  };

  // ============ APPROVE INVITATION (ADMIN) ============
  approveInvitation = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const validatedData = approveInvitationSchema.parse(req.body);
      const adminId = req.user!.id;

      const invitation = await this.service.approveInvitation(
        validatedData,
        adminId,
      );

      return sendResponse(res, invitation, "Invitation approved successfully");
    } catch (error) {
      next(error);
    }
  };

  // ============ REJECT INVITATION (ADMIN) ============
  rejectInvitation = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const validatedData = rejectInvitationSchema.parse(req.body);
      const adminId = req.user!.id;

      const invitation = await this.service.rejectInvitation(
        validatedData,
        adminId,
      );

      return sendResponse(res, invitation, "Invitation rejected successfully");
    } catch (error) {
      next(error);
    }
  };

  // ============ RESEND INVITATION ============
  resendInvitation = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const validatedData = resendInvitationSchema.parse(req.body);
      const userId = req.user!.id;

      const invitation = await this.service.resendInvitation(
        validatedData,
        userId,
      );

      return sendResponse(res, invitation, "Invitation resent successfully");
    } catch (error) {
      next(error);
    }
  };

  // ============ CANCEL INVITATION ============
  cancelInvitation = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const validatedData = cancelInvitationSchema.parse(req.body);
      const userId = req.user!.id;

      const result = await this.service.cancelInvitation(validatedData, userId);

      return sendResponse(res, result, result.message);
    } catch (error) {
      next(error);
    }
  };

  // ============ GET ALL INVITATIONS (WITH FILTERS) ============
  getInvitations = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const validatedQuery = getInvitationsQuerySchema.parse(req.query);
      const userId = req.user!.id;

      const result = await this.service.getInvitations(validatedQuery, userId);

      return sendResponse(
        res,
        result.data,
        "Invitations retrieved successfully",
        200,
      );
    } catch (error) {
      next(error);
    }
  };

  // ============ GET USER'S INVITATIONS ============
  getUserInvitations = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userEmail = req.user!.email;

      const invitations = await this.service.getUserInvitations(userEmail);

      return sendResponse(
        res,
        invitations,
        "User invitations retrieved successfully",
      );
    } catch (error) {
      next(error);
    }
  };

  // ============ GET INVITATION BY ID ============
  getInvitationById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;

      const invitation = await this.service.getInvitationById(id);

      return sendResponse(res, invitation, "Invitation retrieved successfully");
    } catch (error) {
      next(error);
    }
  };
  // ============ VALIDATE TOKEN (PUBLIC) ============
  validateToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.params;

      if (!token) {
        throw new AppError("Token is required", 400);
      }

      const result = await this.service.validateInvitationToken(token);

      return sendResponse(res, result, "Token validated successfully");
    } catch (error) {
      next(error);
    }
  };
}
