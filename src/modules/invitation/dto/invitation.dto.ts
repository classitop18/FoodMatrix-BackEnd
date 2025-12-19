import { z } from "zod";

// ============ CREATE INVITATION ============
export const createInvitationSchema = z.object({
    email: z.string().email("Invalid email address"),
    accountId: z.string().uuid("Invalid account ID"),
    proposedRole: z.enum(["admin", "member", "viewer"]).optional(), // Role suggestion (admin decides final role)
});

export type CreateInvitationDTO = z.infer<typeof createInvitationSchema>;

// ============ ACCEPT INVITATION ============
export const acceptInvitationSchema = z.object({
    token: z.string().min(1, "Token is required"),
});

export type AcceptInvitationDTO = z.infer<typeof acceptInvitationSchema>;

// ============ ADMIN APPROVE/REJECT ============
export const approveInvitationSchema = z.object({
    invitationId: z.string().uuid("Invalid invitation ID"),
    role: z.enum(["admin", "member", "viewer", "super_admin"]),
});

export type ApproveInvitationDTO = z.infer<typeof approveInvitationSchema>;

export const rejectInvitationSchema = z.object({
    invitationId: z.string().uuid("Invalid invitation ID"),
    reason: z.string().optional(), // Optional rejection reason
});

export type RejectInvitationDTO = z.infer<typeof rejectInvitationSchema>;

// ============ RESEND INVITATION ============
export const resendInvitationSchema = z.object({
    invitationId: z.string().uuid("Invalid invitation ID"),
});

export type ResendInvitationDTO = z.infer<typeof resendInvitationSchema>;

// ============ CANCEL INVITATION ============
export const cancelInvitationSchema = z.object({
    invitationId: z.string().uuid("Invalid invitation ID"),
});

export type CancelInvitationDTO = z.infer<typeof cancelInvitationSchema>;

// ============ GET INVITATIONS (QUERY PARAMS) ============
export const getInvitationsQuerySchema = z.object({
    accountId: z.string().uuid("Invalid account ID").optional(),
    status: z
        .enum(["pending", "user_accepted", "approved", "rejected", "expired"])
        .optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10),
});

export type GetInvitationsQuery = z.infer<typeof getInvitationsQuerySchema>;
