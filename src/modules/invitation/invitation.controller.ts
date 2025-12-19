import type { Response } from "express";
import { InvitationService } from "./invitation.service.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { sendSuccess, sendError } from "../../utils/response.utils.js";
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
    sendInvitation = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const validatedData = createInvitationSchema.parse(req.body);
            const userId = req.user!.id;

            const invitation = await this.service.sendInvitation(
                validatedData,
                userId
            );

            return sendSuccess(
                res,
                invitation,
                "Invitation sent successfully",
                201,
            );
        } catch (error: any) {
            return sendError(
                res,
                error.message || "Failed to send invitation",
                error,
                error.statusCode || 500
            );
        }
    };

    // ============ ACCEPT INVITATION (USER) ============
    acceptInvitation = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const validatedData = acceptInvitationSchema.parse(req.body);
            const userEmail = req.user!.email;

            const invitation = await this.service.acceptInvitation(
                validatedData,
                userEmail
            );

            return sendSuccess(
                res,
                invitation,
                "Invitation accepted successfully. Waiting for admin approval.",
            );
        } catch (error: any) {
            return sendError(
                res,
                error.message || "Failed to accept invitation",
                error,
                error.statusCode || 500
            );
        }
    };

    // ============ APPROVE INVITATION (ADMIN) ============
    approveInvitation = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const validatedData = approveInvitationSchema.parse(req.body);
            const adminId = req.user!.id;

            const invitation = await this.service.approveInvitation(
                validatedData,
                adminId
            );

            return sendSuccess(
                res,
                invitation,
                "Invitation approved successfully",
            );
        } catch (error: any) {
            return sendError(
                res,
                error.message || "Failed to approve invitation",
                error,
                error.statusCode || 500
            );
        }
    };

    // ============ REJECT INVITATION (ADMIN) ============
    rejectInvitation = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const validatedData = rejectInvitationSchema.parse(req.body);
            const adminId = req.user!.id;

            const invitation = await this.service.rejectInvitation(
                validatedData,
                adminId
            );

            return sendSuccess(
                res,
                invitation,
                "Invitation rejected successfully",
            );
        } catch (error: any) {
            return sendError(
                res,
                error.message || "Failed to reject invitation",
                error,
                error.statusCode || 500
            );
        }
    };

    // ============ RESEND INVITATION ============
    resendInvitation = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const validatedData = resendInvitationSchema.parse(req.body);
            const userId = req.user!.id;

            const invitation = await this.service.resendInvitation(
                validatedData,
                userId
            );

            return sendSuccess(
                res,
                invitation,
                "Invitation resent successfully",
            );
        } catch (error: any) {
            return sendError(
                res,
                error.message || "Failed to resend invitation",
                error,
                error.statusCode || 500
            );
        }
    };

    // ============ CANCEL INVITATION ============
    cancelInvitation = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const validatedData = cancelInvitationSchema.parse(req.body);
            const userId = req.user!.id;

            const result = await this.service.cancelInvitation(validatedData, userId);

            return sendSuccess(
                res,
                result,
                result.message,
            );
        } catch (error: any) {
            return sendError(
                res,
                error.message || "Failed to cancel invitation",
                error,
                error.statusCode || 500
            );
        }
    };

    // ============ GET ALL INVITATIONS (WITH FILTERS) ============
    getInvitations = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const validatedQuery = getInvitationsQuerySchema.parse(req.query);
            const userId = req.user!.id;

            const result = await this.service.getInvitations(validatedQuery, userId);

            return sendSuccess(
                res,
                result.data,
                "Invitations retrieved successfully",
                200
            );
        } catch (error: any) {
            return sendError(
                res,
                error.message || "Failed to get invitations",
                error,
                error.statusCode || 500
            );
        }
    };

    // ============ GET USER'S INVITATIONS ============
    getUserInvitations = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userEmail = req.user!.email;

            const invitations = await this.service.getUserInvitations(userEmail);

            return sendSuccess(
                res,
                invitations,
                "User invitations retrieved successfully",
            );
        } catch (error: any) {
            return sendError(
                res,
                error.message || "Failed to get user invitations",
                error,
                error.statusCode || 500
            );
        }
    };

    // ============ GET INVITATION BY ID ============
    getInvitationById = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const { id } = req.params;

            const invitation = await this.service.getInvitationById(id);

            return sendSuccess(
                res,
                invitation,
                "Invitation retrieved successfully",
            );
        } catch (error: any) {
            return sendError(
                res,
                error.message || "Failed to get invitation",
                error,
                error.statusCode || 500
            );
        }
    };
}
