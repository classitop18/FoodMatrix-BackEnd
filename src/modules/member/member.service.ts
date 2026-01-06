import {
  BulkDeleteMembersDto,
  BulkUpdateRoleDto,
  CreateMemberDto,
  GetMembersQueryDto,
  MemberResponseDto,
  PaginatedMembersResponseDto,
  TransferOwnershipDto,
  UpdateMemberDto,
} from "./dto/member.dto.js";
import { IMemberRepository, MemberRepository } from "./member.repository.js";
import {
  DuplicateMemberError,
  InvalidMemberDataError,
  MemberNotFoundError,
  MemberPermissions,
  MemberStats,
  UnauthorizedMemberActionError,
} from "./types/member.types.js";

export interface IMemberService {
  // CRUD Operations
  createMember(
    data: CreateMemberDto,
    requesterId: string,
  ): Promise<MemberResponseDto>;
  getMemberById(id: string, requesterId: string): Promise<MemberResponseDto>;
  updateMember(
    id: string,
    data: UpdateMemberDto,
    requesterId: string,
  ): Promise<MemberResponseDto>;
  deleteMember(id: string, requesterId: string): Promise<void>;

  // Query Operations
  getMembers(
    query: GetMembersQueryDto,
    requesterId: string,
  ): Promise<PaginatedMembersResponseDto>;
  getAccountMembers(
    accountId: string,
    requesterId: string,
  ): Promise<MemberResponseDto[]>;
  getInternalMembers(
    accountId: string,
    requesterId: string,
  ): Promise<MemberResponseDto[]>;
  getRegisteredMembers(
    accountId: string,
    requesterId: string,
  ): Promise<MemberResponseDto[]>;

  // Ownership & Role Management
  transferOwnership(
    accountId: string,
    data: TransferOwnershipDto,
    requesterId: string,
  ): Promise<void>;
  updateMemberRole(
    memberId: string,
    role: "admin" | "super_admin" | "member",
    requesterId: string,
  ): Promise<MemberResponseDto>;

  // Bulk Operations
  bulkUpdateRole(
    data: BulkUpdateRoleDto,
    requesterId: string,
  ): Promise<{ updated: number }>;
  bulkDeleteMembers(
    data: BulkDeleteMembersDto,
    requesterId: string,
  ): Promise<{ deleted: number }>;

  // Stats & Permissions
  getMemberStats(accountId: string, requesterId: string): Promise<MemberStats>;
  getMemberPermissions(
    memberId: string,
    requesterId: string,
  ): Promise<MemberPermissions>;

  // Validation
  canUserAccessAccount(userId: string, accountId: string): Promise<boolean>;
  isAccountOwner(userId: string, accountId: string): Promise<boolean>;
  hasPermission(
    requesterId: string,
    accountId: string,
    permission: string,
  ): Promise<boolean>;
}

export class MemberService implements IMemberService {
  constructor(
    private readonly memberRepo: IMemberRepository = new MemberRepository(),
  ) {}

  async createMember(
    data: CreateMemberDto,
    requesterId: string,
  ): Promise<MemberResponseDto> {
    // Check if requester has permission to add members
    await this.validateAccountAccess(
      requesterId,
      data.accountId,
      "add members",
    );

    // Check if user is already a member (if userId provided)
    if (data.userId) {
      const existing = await this.memberRepo.isUserMember(
        data.userId,
        data.accountId,
      );
      if (existing) {
        throw new DuplicateMemberError(data.userId, data.accountId);
      }
    }

    // Validate internal member data
    if (!data.userId && !data.name) {
      throw new InvalidMemberDataError("Name is required for internal members");
    }

    const member = await this.memberRepo.create(data);
    const fullMember = await this.memberRepo.findById(member.id, true);

    if (!fullMember) {
      throw new MemberNotFoundError(member.id);
    }

    return this.mapToResponseDto(fullMember);
  }

  async getMemberById(
    id: string,
    requesterId: string,
  ): Promise<MemberResponseDto> {
    const member = await this.memberRepo.findById(id, true);

    if (!member) {
      throw new MemberNotFoundError(id);
    }

    // Check if requester has access to this account
    await this.validateAccountAccess(
      requesterId,
      member.accountId,
      "view members",
    );

    return this.mapToResponseDto(member);
  }

  async updateMember(
    id: string,
    data: UpdateMemberDto,
    requesterId: string,
  ): Promise<MemberResponseDto> {
    const member = await this.memberRepo.findById(id, false);

    if (!member) {
      throw new MemberNotFoundError(id);
    }

    // Check permissions
    await this.validateAccountAccess(
      requesterId,
      member.accountId,
      "update members",
    );

    // Prevent changing owner role through regular update
    if (
      member.role === "super_admin" &&
      data.role &&
      data.role !== "super_admin"
    ) {
      throw new UnauthorizedMemberActionError(
        "change owner role. Use transfer ownership instead",
      );
    }

    const updated = await this.memberRepo.update(id, data);
    const fullMember = await this.memberRepo.findById(updated.id, true);

    if (!fullMember) {
      throw new MemberNotFoundError(updated.id);
    }

    return this.mapToResponseDto(fullMember);
  }

  async deleteMember(id: string, requesterId: string): Promise<void> {
    const member = await this.memberRepo.findById(id, false);

    if (!member) {
      throw new MemberNotFoundError(id);
    }

    // Check permissions
    await this.validateAccountAccess(
      requesterId,
      member.accountId,
      "delete members",
    );

    // Prevent deleting owner
    if (member.role === "super_admin") {
      throw new UnauthorizedMemberActionError("delete the account owner");
    }

    // Prevent self-deletion
    const requesterMember = await this.memberRepo.findByUserId(
      requesterId,
      member.accountId,
    );
    if (requesterMember.length > 0 && requesterMember[0].id === id) {
      throw new UnauthorizedMemberActionError("delete yourself");
    }

    await this.memberRepo.delete(id);
  }

  async getMembers(
    query: GetMembersQueryDto,
    requesterId: string,
  ): Promise<PaginatedMembersResponseDto> {
    // If accountId is provided, validate access
    if (query.accountId) {
      await this.validateAccountAccess(
        requesterId,
        query.accountId,
        "view members",
      );
    }

    const result = await this.memberRepo.findAll(query);

    return {
      data: result.data.map((m) => this.mapToResponseDto(m)),
      pagination: result.pagination,
    };
  }

  async getAccountMembers(
    accountId: string,
    requesterId: string,
  ): Promise<MemberResponseDto[]> {
    await this.validateAccountAccess(requesterId, accountId, "view members");
    const members = await this.memberRepo.findAccountMembers(accountId, true);
    return members.map((m) => this.mapToResponseDto(m));
  }

  async getInternalMembers(
    accountId: string,
    requesterId: string,
  ): Promise<MemberResponseDto[]> {
    await this.validateAccountAccess(requesterId, accountId, "view members");
    const members = await this.memberRepo.findInternalMembers(accountId);
    return members.map((m) => this.mapToResponseDto(m));
  }

  async getRegisteredMembers(
    accountId: string,
    requesterId: string,
  ): Promise<MemberResponseDto[]> {
    await this.validateAccountAccess(requesterId, accountId, "view members");
    const members = await this.memberRepo.findRegisteredMembers(accountId);
    return members.map((m) => this.mapToResponseDto(m));
  }

  async transferOwnership(
    accountId: string,
    data: TransferOwnershipDto,
    requesterId: string,
  ): Promise<void> {
    // Only current owner can transfer ownership
    const isOwner = await this.isAccountOwner(requesterId, accountId);
    if (!isOwner) {
      throw new UnauthorizedMemberActionError(
        "transfer ownership. Only the current owner can do this",
      );
    }

    const newOwner = await this.memberRepo.findById(data.newOwnerId, false);
    if (!newOwner || newOwner.accountId !== accountId) {
      throw new InvalidMemberDataError(
        "New owner must be a member of this account",
      );
    }

    // Get current owner
    const currentOwner = await this.memberRepo.findOwner(accountId);
    if (!currentOwner) {
      throw new InvalidMemberDataError("Current owner not found");
    }

    // Swap roles
    await this.memberRepo.update(currentOwner.id, { role: "admin" });
    await this.memberRepo.update(data.newOwnerId, { role: "super_admin" });
  }

  async updateMemberRole(
    memberId: string,
    role: "admin" | "super_admin" | "member",
    requesterId: string,
  ): Promise<MemberResponseDto> {
    const member = await this.memberRepo.findById(memberId, false);

    if (!member) {
      throw new MemberNotFoundError(memberId);
    }

    await this.validateAccountAccess(
      requesterId,
      member.accountId,
      "update member roles",
    );

    if (member.role === "super_admin") {
      throw new UnauthorizedMemberActionError(
        "change owner role. Use transfer ownership instead",
      );
    }

    const updated = await this.memberRepo.update(memberId, { role });
    const fullMember = await this.memberRepo.findById(updated.id, true);

    if (!fullMember) {
      throw new MemberNotFoundError(updated.id);
    }

    return this.mapToResponseDto(fullMember);
  }

  async bulkUpdateRole(
    data: BulkUpdateRoleDto,
    requesterId: string,
  ): Promise<{ updated: number }> {
    // Validate permissions for all members
    const members = await this.memberRepo.findMany({ id: data.memberIds[0] });
    if (members.length > 0) {
      await this.validateAccountAccess(
        requesterId,
        members[0].accountId,
        "bulk update roles",
      );
    }

    // Prevent bulk updating owner role
    const owners = await Promise.all(
      data.memberIds.map((id) => this.memberRepo.findById(id, false)),
    );
    const hasOwner = owners.some((m) => m?.role === "super_admin");
    if (hasOwner) {
      throw new UnauthorizedMemberActionError("bulk update owner roles");
    }

    const updated = await this.memberRepo.bulkUpdateRole(
      data.memberIds,
      data.role,
    );
    return { updated };
  }

  async bulkDeleteMembers(
    data: BulkDeleteMembersDto,
    requesterId: string,
  ): Promise<{ deleted: number }> {
    // Validate permissions
    const members = await this.memberRepo.findMany({ id: data.memberIds[0] });
    if (members.length > 0) {
      await this.validateAccountAccess(
        requesterId,
        members[0].accountId,
        "bulk delete members",
      );
    }

    // Prevent bulk deleting owner
    const owners = await Promise.all(
      data.memberIds.map((id) => this.memberRepo.findById(id, false)),
    );
    const hasOwner = owners.some((m) => m?.role === "super_admin");
    if (hasOwner) {
      throw new UnauthorizedMemberActionError("bulk delete the owner");
    }

    const deleted = await this.memberRepo.bulkDelete(data.memberIds);
    return { deleted };
  }

  async getMemberStats(
    accountId: string,
    requesterId: string,
  ): Promise<MemberStats> {
    await this.validateAccountAccess(
      requesterId,
      accountId,
      "view member stats",
    );
    return await this.memberRepo.getStats(accountId);
  }

  async getMemberPermissions(
    memberId: string,
    requesterId: string,
  ): Promise<MemberPermissions> {
    const member = await this.memberRepo.findById(memberId, false);

    if (!member) {
      throw new MemberNotFoundError(memberId);
    }

    const requesterMember = await this.memberRepo.findByUserId(
      requesterId,
      member.accountId,
    );

    if (requesterMember.length === 0) {
      throw new UnauthorizedMemberActionError(
        "view permissions for this member",
      );
    }

    const requesterRole = requesterMember[0].role;

    return {
      canEdit: ["super_admin", "admin"].includes(requesterRole),
      canDelete:
        ["super_admin", "admin"].includes(requesterRole) &&
        member.role !== "super_admin",
      canViewHealthProfile: ["super_admin", "admin", "member"].includes(
        requesterRole,
      ),
      canManageMembers: ["super_admin", "admin"].includes(requesterRole),
      canTransferOwnership: requesterRole === "super_admin",
    };
  }

  async canUserAccessAccount(
    userId: string,
    accountId: string,
  ): Promise<boolean> {
    return await this.memberRepo.isUserMember(userId, accountId);
  }

  async isAccountOwner(userId: string, accountId: string): Promise<boolean> {
    const owner = await this.memberRepo.findOwner(accountId);
    if (!owner || !owner.userId) return false;
    return owner.userId === userId;
  }

  async hasPermission(
    requesterId: string,
    accountId: string,
    permission: string,
  ): Promise<boolean> {
    const members = await this.memberRepo.findByUserId(requesterId, accountId);
    if (members.length === 0) return false;

    const role = members[0].role;
    const adminRoles = ["super_admin", "admin"];

    switch (permission) {
      case "manage_members":
      case "manage_budget":
      case "manage_settings":
        return adminRoles.includes(role);
      case "view_members":
      case "view_health_profiles":
        return true; // All members can view
      default:
        return false;
    }
  }

  // Private helper methods
  private async validateAccountAccess(
    requesterId: string,
    accountId: string,
    action: string,
  ): Promise<void> {
    const hasAccess = await this.canUserAccessAccount(requesterId, accountId);
    if (!hasAccess) {
      throw new UnauthorizedMemberActionError(action);
    }
  }

   
  private mapToResponseDto(member: any): MemberResponseDto {
    return {
      id: member.id,
      accountId: member.accountId,
      userId: member.userId,
      role: member.role,
      name: member.name,
      age: member.age,
      sex: member.sex,
      createdAt: member.createdAt,
      user: member.user
        ? {
            id: member.user.id,
            email: member.user.email,
            username: member.user.username,
            firstName: member.user.firstName,
            lastName: member.user.lastName,
            avatar: member.user.avatar,
          }
        : undefined,
      account: member.account
        ? {
            id: member.account.id,
            accountNumber: member.account.accountNumber,
            accountName: member.account.accountName,
            accountType: member.account.accountType,
          }
        : undefined,
    };
  }
}
