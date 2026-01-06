import crypto from "crypto";
import { InvitationRepository } from "./invitation.repository.js";
import { EmailService } from "../../email/email.service.js";
import { UserRepository } from "../user/user.repository.js";
import { MemberRepository } from "../member/member.repository.js";
import type {
  CreateInvitationDTO,
  AcceptInvitationDTO,
  ApproveInvitationDTO,
  RejectInvitationDTO,
  ResendInvitationDTO,
  CancelInvitationDTO,
  GetInvitationsQuery,
} from "./dto/invitation.dto.js";
import { CONFIG } from "@/utils/env.config.js";

export class InvitationService {
  private repository: InvitationRepository;
  private emailService: EmailService;
  private userRepository: UserRepository;
  private memberRepository: MemberRepository;

  constructor() {
    this.repository = new InvitationRepository();
    this.emailService = new EmailService();
    this.userRepository = new UserRepository();
    this.memberRepository = new MemberRepository();
  }

  // ============ SEND INVITATION ============
  async sendInvitation(data: CreateInvitationDTO, invitedBy: string) {
    // Check if user already is a member of this account
    // (We'll check by email since we might not have a userId yet)
    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      const isMember = await this.memberRepository.isUserMember(
        existingUser.id,
        data.accountId,
      );
      if (isMember) {
        throw Object.assign(
          new Error("User is already a member of this account"),
          { statusCode: 400 },
        );
      }
    }

    // Check if an active invitation already exists for this email and account
    const existingInvitation =
      await this.repository.findPendingByEmailAndAccount(
        data.email,
        data.accountId,
      );

    if (existingInvitation) {
      throw Object.assign(
        new Error("An active invitation already exists for this email"),
        { statusCode: 409 },
      );
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");

    // Set expiration (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invitation
    const invitation = await this.repository.create({
      accountId: data.accountId,
      email: data.email,
      invitedBy,
      token,
      expiresAt,
      role: data.proposedRole || "member", // Default to member
    });

    // Fetch account and inviter details for email
    const { AccountRepository } =
      await import("../account/account.repository.js");
    const accountRepo = new AccountRepository();
    const account = await accountRepo.getAccountData({ id: data.accountId });

    const inviter = await this.userRepository.findById(invitedBy);

    // Send invitation email
    const invitationLink = `${CONFIG.FRONTEND_BASE_URL || "http://localhost:3001"}/accept-invitation?token=${token}`;

    await this.emailService.sendInvitationEmail({
      to: data.email,
      invitationLink,
      expiresAt,
      inviterName: inviter
        ? `${inviter.firstName} ${inviter.lastName}`
        : undefined,
      accountName: account?.accountName || undefined,
    });

    return invitation;
  }

  // ============ USER ACCEPTS INVITATION ============
  async acceptInvitation(data: AcceptInvitationDTO, userEmail: string) {
    // Find invitation by token
    const invitation = await this.repository.findByToken(data.token);

    if (!invitation) {
      throw Object.assign(new Error("Invitation not found"), {
        statusCode: 404,
      });
    }

    // Check if invitation is valid
    if (invitation.status !== "pending") {
      throw Object.assign(
        new Error(`Invitation has already been ${invitation.status}`),
        { statusCode: 400 },
      );
    }

    // Check if expired
    if (new Date() > new Date(invitation.expiresAt)) {
      await this.repository.updateStatus(invitation.id, "expired");
      throw Object.assign(new Error("Invitation has expired"), {
        statusCode: 400,
      });
    }

    // Check if email matches
    if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw Object.assign(
        new Error("This invitation was sent to a different email address"),
        { statusCode: 403 },
      );
    }

    // Update status to "user_accepted"
    const updated = await this.repository.updateStatus(
      invitation.id,
      "user_accepted",
      {
        acceptedAt: new Date(),
      },
    );

    // Notify admin that user has accepted
    await this.emailService.sendInvitationAcceptedNotification({
      accountId: invitation.accountId,
      userEmail: invitation.email,
    });

    return updated;
  }

  // ============ ADMIN APPROVES INVITATION ============
  async approveInvitation(data: ApproveInvitationDTO) {
    const invitation = await this.repository.findById(data.invitationId);

    if (!invitation) {
      throw Object.assign(new Error("Invitation not found"), {
        statusCode: 404,
      });
    }

    // Verify status
    if (invitation.status !== "user_accepted") {
      throw Object.assign(
        new Error("Invitation must be accepted by user before approval"),
        { statusCode: 400 },
      );
    }

    // Find the user by email
    const user = await this.userRepository.findByEmail(invitation.email);
    if (!user) {
      throw Object.assign(
        new Error(
          "User account not found. User must register before approval.",
        ),
        { statusCode: 404 },
      );
    }

    // Update status to "approved" and set final role
    const updated = await this.repository.updateStatus(
      invitation.id,
      "approved",
      {
        approvedAt: new Date(),
        role: data.role,
      },
    );

    // Automatically create member entry
    await this.memberRepository.create({
      accountId: invitation.accountId,
      userId: user.id,
      role: data.role as any,
    });

    // Send approval email to user
    await this.emailService.sendInvitationApprovedEmail({
      to: invitation.email,
      accountName: (invitation as any).account?.accountName || "Account",
      role: data.role,
    });

    return updated;
  }

  // ============ ADMIN REJECTS INVITATION ============
  async rejectInvitation(data: RejectInvitationDTO) {
    const invitation = await this.repository.findById(data.invitationId);

    if (!invitation) {
      throw Object.assign(new Error("Invitation not found"), {
        statusCode: 404,
      });
    }

    // Verify status - can reject if pending or user_accepted
    if (!["pending", "user_accepted"].includes(invitation.status)) {
      throw Object.assign(new Error("Cannot reject this invitation"), {
        statusCode: 400,
      });
    }

    // Update status to "rejected"
    const updated = await this.repository.updateStatus(
      invitation.id,
      "rejected",
      {
        rejectedAt: new Date(),
      },
    );

    // Send rejection email to user
    await this.emailService.sendInvitationRejectedEmail({
      to: invitation.email,
      accountName: (invitation as any).account?.accountName || "Account",
      reason: data.reason,
    });

    return updated;
  }

  // ============ RESEND INVITATION ============
  async resendInvitation(data: ResendInvitationDTO) {
    const invitation = await this.repository.findById(data.invitationId);

    if (!invitation) {
      throw Object.assign(new Error("Invitation not found"), {
        statusCode: 404,
      });
    }

    // Only resend if pending or expired
    if (!["pending", "expired"].includes(invitation.status)) {
      throw Object.assign(new Error("Cannot resend this invitation"), {
        statusCode: 400,
      });
    }

    // Generate new token
    const token = crypto.randomBytes(32).toString("hex");

    // Set new expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Update invitation
    const updated = await this.repository.updateToken(
      invitation.id,
      token,
      expiresAt,
    );

    // Fetch account and inviter details for email
    const { AccountRepository } =
      await import("../account/account.repository.js");
    const accountRepo = new AccountRepository();
    const account = await accountRepo.getAccountData({
      id: invitation.accountId,
    });

    const inviter = await this.userRepository.findById(invitation.invitedBy);

    // Resend email
    const invitationLink = `${CONFIG.FRONTEND_BASE_URL || "http://localhost:3001"}/accept-invitation?token=${token}`;

    await this.emailService.sendInvitationEmail({
      to: invitation.email,
      invitationLink,
      expiresAt,
      inviterName: inviter
        ? `${inviter.firstName} ${inviter.lastName}`
        : undefined,
      accountName: account?.accountName || undefined,
    });

    return updated;
  }

  // ============ CANCEL INVITATION ============
  async cancelInvitation(data: CancelInvitationDTO) {
    const invitation = await this.repository.findById(data.invitationId);

    if (!invitation) {
      throw Object.assign(new Error("Invitation not found"), {
        statusCode: 404,
      });
    }

    // Can only cancel pending invitations
    if (invitation.status !== "pending") {
      throw Object.assign(new Error("Can only cancel pending invitations"), {
        statusCode: 400,
      });
    }

    // Delete invitation
    await this.repository.delete(invitation.id);

    return { message: "Invitation cancelled successfully" };
  }

  // ============ GET ALL INVITATIONS ============
  async getInvitations(query: GetInvitationsQuery) {
    return await this.repository.findAll(query);
  }

  // ============ GET USER'S INVITATIONS ============
  async getUserInvitations(userEmail: string) {
    return await this.repository.findByEmail(userEmail);
  }

  // ============ GET SINGLE INVITATION ============
  async getInvitationById(id: string) {
    const invitation = await this.repository.findById(id);

    if (!invitation) {
      throw Object.assign(new Error("Invitation not found"), {
        statusCode: 404,
      });
    }

    return invitation;
  }

  // ============ VALIDATE INVITATION TOKEN (PUBLIC) ============
  async validateInvitationToken(token: string) {
    const invitation = await this.repository.findByToken(token);

    if (!invitation) {
      throw Object.assign(new Error("Invitation not found"), {
        statusCode: 404,
      });
    }

    // Check if invitation is valid
    if (invitation.status !== "pending") {
      throw Object.assign(
        new Error(`Invitation has already been ${invitation.status}`),
        { statusCode: 400 },
      );
    }

    // Check if expired
    if (new Date() > new Date(invitation.expiresAt)) {
      await this.repository.updateStatus(invitation.id, "expired");
      throw Object.assign(new Error("Invitation has expired"), {
        statusCode: 400,
      });
    }

    // Check if user exists
    const user = await this.userRepository.findByEmail(invitation.email);

    return {
      email: invitation.email,
      exists: !!user,
      invitationId: invitation.id,
      accountId: invitation.accountId,
      role: invitation.role,
    };
  }
}
