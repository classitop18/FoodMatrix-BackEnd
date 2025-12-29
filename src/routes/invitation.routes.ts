import { Router } from "express";
import { InvitationController } from "../modules/invitation/invitation.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requirePermission } from "../middlewares/authorization.middleware.js";
import { PERMISSIONS } from "../common/permissions.config.js";

const router = Router();
const controller = new InvitationController();

/**
 * @route   GET /api/invitations/validate-token/:token
 * @desc    Validate invitation token and check user existence (Public)
 * @access  Public
 */
router.get("/validate-token/:token", controller.validateToken);

// ============ AUTHENTICATED USER ROUTES ============
router.use(authenticate); // All routes below require authentication

/**
 * @route   POST /api/invitations/send
 * @desc    Send invitation to a user
 * @access  Private (invite:send permission - admin, super_admin)
 */
router.post(
  "/send",
  requirePermission(PERMISSIONS.INVITE_SEND),
  controller.sendInvitation,
);

/**
 * @route   POST /api/invitations/accept
 * @desc    User accepts an invitation
 * @access  Private (Authenticated user - no permission check needed)
 */
router.post("/accept", controller.acceptInvitation);

/**
 * @route   POST /api/invitations/approve
 * @desc    Admin approves a user-accepted invitation
 * @access  Private (invite:approve permission - super_admin only)
 */
router.post(
  "/approve",
  requirePermission(PERMISSIONS.INVITE_APPROVE),
  controller.approveInvitation,
);

/**
 * @route   POST /api/invitations/reject
 * @desc    Admin rejects an invitation
 * @access  Private (invite:reject permission - super_admin only)
 */
router.post(
  "/reject",
  requirePermission(PERMISSIONS.INVITE_REJECT),
  controller.rejectInvitation,
);

/**
 * @route   POST /api/invitations/resend
 * @desc    Resend an invitation
 * @access  Private (invite:send permission - admin, super_admin)
 */
router.post(
  "/resend",
  requirePermission(PERMISSIONS.INVITE_SEND),
  controller.resendInvitation,
);

/**
 * @route   DELETE /api/invitations/cancel
 * @desc    Cancel a pending invitation
 * @access  Private (invite:send permission - admin, super_admin)
 */
router.delete(
  "/cancel",
  requirePermission(PERMISSIONS.INVITE_SEND),
  controller.cancelInvitation,
);

/**
 * @route   GET /api/invitations
 * @desc    Get all invitations (with filters)
 * @access  Private (invite:view permission - all roles)
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.INVITE_VIEW),
  controller.getInvitations,
);

/**
 * @route   GET /api/invitations/my-invitations
 * @desc    Get current user's invitations
 * @access  Private (Authenticated user - no permission check needed)
 */
router.get("/my-invitations", controller.getUserInvitations);

/**
 * @route   GET /api/invitations/:id
 * @desc    Get invitation by ID
 * @access  Private (invite:view permission - all roles)
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.INVITE_VIEW),
  controller.getInvitationById,
);

export default router;
