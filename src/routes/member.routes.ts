import { authenticate } from "@/middlewares/auth.middleware.js";
import { requirePermission } from "@/middlewares/authorization.middleware.js";
import { PERMISSIONS } from "@/common/permissions.config.js";
import { MemberController } from "@/modules/member/member.controller.js";
import { Router } from "express";

const router = Router();
const memberController = new MemberController();

// All routes require authentication
router.use(authenticate);

// ============ Member CRUD Routes ============
/**
 * @route   POST /api/members
 * @desc    Create a new member
 * @access  Private (member:create permission - admin, super_admin)
 */
router.post(
  "/",
  requirePermission(PERMISSIONS.MEMBER_CREATE),
  memberController.createMember,
);

/**
 * @route   GET /api/members
 * @desc    Get all members with filters and pagination
 * @access  Private (member:view permission - all roles)
 * @query   ?accountId=xxx&role=xxx&page=1&limit=10&sortBy=createdAt&sortOrder=desc
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.MEMBER_VIEW),
  memberController.getMembers,
);

/**
 * @route   GET /api/members/:id
 * @desc    Get member by ID
 * @access  Private (member:view permission - all roles)
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.MEMBER_VIEW),
  memberController.getMemberById,
);

/**
 * @route   PATCH /api/members/:id
 * @desc    Update member
 * @access  Private (member:update permission - admin, super_admin)
 */
router.patch(
  "/:id",
  requirePermission(PERMISSIONS.MEMBER_UPDATE),
  memberController.updateMember,
);

/**
 * @route   DELETE /api/members/:id
 * @desc    Delete member
 * @access  Private (member:delete permission - super_admin only)
 */
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.MEMBER_DELETE),
  memberController.deleteMember,
);

// ============ Member Role Management ============
/**
 * @route   PATCH /api/members/:id/role
 * @desc    Update member role
 * @access  Private (member:role_update permission - super_admin only)
 */
router.patch(
  "/:id/role",
  requirePermission(PERMISSIONS.MEMBER_ROLE_UPDATE),
  memberController.updateMemberRole,
);

/**
 * @route   GET /api/members/:id/permissions
 * @desc    Get member permissions
 * @access  Private (member:view permission - all roles)
 */
router.get(
  "/:id/permissions",
  requirePermission(PERMISSIONS.MEMBER_VIEW),
  memberController.getMemberPermissions,
);

// ============ Bulk Operations ============
/**
 * @route   POST /api/members/bulk-update-role
 * @desc    Bulk update member roles
 * @access  Private (member:role_update permission - super_admin only)
 */
router.post(
  "/bulk-update-role",
  requirePermission(PERMISSIONS.MEMBER_ROLE_UPDATE),
  memberController.bulkUpdateRole,
);

/**
 * @route   POST /api/members/bulk-delete
 * @desc    Bulk delete members
 * @access  Private (member:delete permission - super_admin only)
 */
router.post(
  "/bulk-delete",
  requirePermission(PERMISSIONS.MEMBER_DELETE),
  memberController.bulkDeleteMembers,
);

// ============ Account-specific Member Routes ============
/**
 * @route   GET /api/accounts/:accountId/members
 * @desc    Get all members of an account
 * @access  Private (member:view permission - all roles)
 */
router.get(
  "/accounts/:accountId/members",
  requirePermission(PERMISSIONS.MEMBER_VIEW),
  memberController.getAccountMembers,
);

/**
 * @route   GET /api/accounts/:accountId/members/internal
 * @desc    Get internal members only
 * @access  Private (member:view permission - all roles)
 */
router.get(
  "/accounts/:accountId/members/internal",
  requirePermission(PERMISSIONS.MEMBER_VIEW),
  memberController.getInternalMembers,
);

/**
 * @route   GET /api/accounts/:accountId/members/registered
 * @desc    Get registered members only
 * @access  Private (member:view permission - all roles)
 */
router.get(
  "/accounts/:accountId/members/registered",
  requirePermission(PERMISSIONS.MEMBER_VIEW),
  memberController.getRegisteredMembers,
);

/**
 * @route   GET /api/accounts/:accountId/members/stats
 * @desc    Get member statistics
 * @access  Private (member:view permission - all roles)
 */
router.get(
  "/accounts/:accountId/members/stats",
  requirePermission(PERMISSIONS.MEMBER_VIEW),
  memberController.getMemberStats,
);

/**
 * @route   POST /api/accounts/:accountId/members/transfer-ownership
 * @desc    Transfer account ownership
 * @access  Private (Super admin / Primary admin only)
 */
router.post(
  "/accounts/:accountId/members/transfer-ownership",
  requirePermission(PERMISSIONS.ACCOUNT_DELETE), // Only super_admin can transfer ownership
  memberController.transferOwnership,
);

export default router;
