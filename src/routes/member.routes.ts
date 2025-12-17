import { authenticate } from "@/middlewares/auth.middleware.js";
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
 * @access  Private (Admin/Owner)
 */
router.post("/", memberController.createMember);

/**
 * @route   GET /api/members
 * @desc    Get all members with filters and pagination
 * @access  Private
 * @query   ?accountId=xxx&role=xxx&page=1&limit=10&sortBy=createdAt&sortOrder=desc
 */
router.get("/", memberController.getMembers);

/**
 * @route   GET /api/members/:id
 * @desc    Get member by ID
 * @access  Private
 */
router.get("/:id", memberController.getMemberById);

/**
 * @route   PATCH /api/members/:id
 * @desc    Update member
 * @access  Private (Admin/Owner)
 */
router.patch("/:id", memberController.updateMember);

/**
 * @route   DELETE /api/members/:id
 * @desc    Delete member
 * @access  Private (Admin/Owner)
 */
router.delete("/:id", memberController.deleteMember);

// ============ Member Role Management ============
/**
 * @route   PATCH /api/members/:id/role
 * @desc    Update member role
 * @access  Private (Admin/Owner)
 */
router.patch("/:id/role", memberController.updateMemberRole);

/**
 * @route   GET /api/members/:id/permissions
 * @desc    Get member permissions
 * @access  Private
 */
router.get("/:id/permissions", memberController.getMemberPermissions);

// ============ Bulk Operations ============
/**
 * @route   POST /api/members/bulk-update-role
 * @desc    Bulk update member roles
 * @access  Private (Admin/Owner)
 */
router.post("/bulk-update-role", memberController.bulkUpdateRole);

/**
 * @route   POST /api/members/bulk-delete
 * @desc    Bulk delete members
 * @access  Private (Admin/Owner)
 */
router.post("/bulk-delete", memberController.bulkDeleteMembers);

// ============ Account-specific Member Routes ============
/**
 * @route   GET /api/accounts/:accountId/members
 * @desc    Get all members of an account
 * @access  Private
 */
router.get("/accounts/:accountId/members", memberController.getAccountMembers);

/**
 * @route   GET /api/accounts/:accountId/members/internal
 * @desc    Get internal members only
 * @access  Private
 */
router.get(
  "/accounts/:accountId/members/internal",
  memberController.getInternalMembers,
);

/**
 * @route   GET /api/accounts/:accountId/members/registered
 * @desc    Get registered members only
 * @access  Private
 */
router.get(
  "/accounts/:accountId/members/registered",
  memberController.getRegisteredMembers,
);

/**
 * @route   GET /api/accounts/:accountId/members/stats
 * @desc    Get member statistics
 * @access  Private
 */
router.get(
  "/accounts/:accountId/members/stats",
  memberController.getMemberStats,
);

/**
 * @route   POST /api/accounts/:accountId/members/transfer-ownership
 * @desc    Transfer account ownership
 * @access  Private (Owner only)
 */
router.post(
  "/accounts/:accountId/members/transfer-ownership",
  memberController.transferOwnership,
);

// Error handler (should be last)
// router.use(memberErrorHandler);

export default router;

// ============ Alternative route structure (if you prefer nested routes) ============
// src/modules/members/routes/index.ts

/*
import { Router } from "express";
import memberRoutes from "./member.routes";
import accountMemberRoutes from "./account-member.routes";

const router = Router();

// Base member routes: /api/members
router.use("/members", memberRoutes);

// Account-specific routes: /api/accounts/:accountId/members
router.use("/accounts/:accountId/members", accountMemberRoutes);

export default router;
*/

// ============ Usage in main app ============
/*
// src/app.ts or src/server.ts
import express from "express";
import memberRoutes from "@/modules/members/routes/member.routes";

const app = express();

app.use(express.json());
app.use("/api", memberRoutes);

// OR if using the alternative structure:
// import routes from "@/modules/members/routes";
// app.use("/api", routes);
*/
