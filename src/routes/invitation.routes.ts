import { Router } from "express";
import { InvitationController } from "../modules/invitation/invitation.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

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
 * @desc    Send invitation to a user (Account owner/admin)
 * @access  Private (Account owner or admin)
 */
router.post("/send", controller.sendInvitation);

/**
 * @route   POST /api/invitations/accept
 * @desc    User accepts an invitation
 * @access  Private (Authenticated user)
 */
router.post("/accept", controller.acceptInvitation);

/**
 * @route   POST /api/invitations/approve
 * @desc    Admin approves a user-accepted invitation
 * @access  Private (Admin only)
 */
router.post("/approve", controller.approveInvitation);

/**
 * @route   POST /api/invitations/reject
 * @desc    Admin rejects an invitation
 * @access  Private (Admin only)
 */
router.post("/reject", controller.rejectInvitation);

/**
 * @route   POST /api/invitations/resend
 * @desc    Resend an invitation
 * @access  Private (Account owner or admin)
 */
router.post("/resend", controller.resendInvitation);

/**
 * @route   DELETE /api/invitations/cancel
 * @desc    Cancel a pending invitation
 * @access  Private (Account owner or admin)
 */
router.delete("/cancel", controller.cancelInvitation);

/**
 * @route   GET /api/invitations
 * @desc    Get all invitations (with filters)
 * @access  Private (Admin only)
 */
router.get("/", controller.getInvitations);

/**
 * @route   GET /api/invitations/my-invitations
 * @desc    Get current user's invitations
 * @access  Private (Authenticated user)
 */
router.get("/my-invitations", controller.getUserInvitations);

/**
 * @route   GET /api/invitations/:id
 * @desc    Get invitation by ID
 * @access  Private
 */
router.get("/:id", controller.getInvitationById);

export default router;
