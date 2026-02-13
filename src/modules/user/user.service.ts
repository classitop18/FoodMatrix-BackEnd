import {
  CreateUserDTO,
  PaginatedResponse,
  PaginationParams,
  ResetPasswordDTO,
  UpdatePasswordDTO,
  UpdateUserDTO,
  User,
  UserFilters,
  UserWithoutPassword,
  VerifyEmailDTO,
  VerifyUserDTO,
} from "./types/user.types.js";
import * as bcrypt from "bcrypt";
import { IUserRepository } from "./user.repository.js";
import { compareHash, hashString } from "@/utils/bcrypt.utils.js";
import { CONFIG } from "@/utils/env.config.js";
import { verifyJwtToken } from "@/utils/jwt.utils.js";
import { AppError } from "@/utils/app-error.utils.js";

export interface IUserService {
  createUser(
    data: CreateUserDTO,
  ): Promise<{ user: UserWithoutPassword; isAutoVerified: boolean }>;
  loginUser(data: {
    emailOrUsername: string;
    password: string;
  }): Promise<{ user: UserWithoutPassword }>;
  getUserById(id: string): Promise<UserWithoutPassword>;
  getUserByEmail(email: string): Promise<User | null>;
  updateUser(id: string, data: UpdateUserDTO): Promise<UserWithoutPassword>;
  deleteUser(id: string): Promise<void>;
  changePassword(id: string, data: UpdatePasswordDTO): Promise<void>;
  getVerificationOtp(email: string): Promise<number>;
  verifyUserEmailUsingOtp(data: VerifyUserDTO): Promise<UserWithoutPassword>;
  verifyUserEmailUsingToken(data: VerifyEmailDTO): Promise<UserWithoutPassword>;
  resetPassword(id: string, data: ResetPasswordDTO): Promise<void>;
  getUsers(
    filters?: UserFilters,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<UserWithoutPassword>>;
  enableMfa(id: string): Promise<void>;
  disableMfa(id: string): Promise<void>;
  findUserByField(
    data: { field: string; value: string },
    id?: string,
  ): Promise<User | null>;
}

export class UserService implements IUserService {
  constructor(private userRepository: IUserRepository) {}

  private removePasswordFromUser(user: User): UserWithoutPassword {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, otp, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
  async findUserByField(
    data: { field: "email" | "username"; value: string },
    id?: string,
  ): Promise<User | null> {
    const { field, value } = data;
    if (!field || !value) return null;

    const normalizedValue =
      field === "email" ? value.trim().toLowerCase() : value.trim();

    let user = null;

    switch (field) {
      case "email":
        user = await this.userRepository.findByEmail(normalizedValue);
        break;

      case "username":
        user = await this.userRepository.findByUsername(normalizedValue);
        break;

      default:
        return null;
    }

    if (user && !id) {
      return user;
    }

    if (user && id && user.id !== id) {
      return user;
    }
    return null;
  }

  async createUser(
    data: CreateUserDTO,
  ): Promise<{ user: UserWithoutPassword; isAutoVerified: boolean }> {
    const existingEmail = await this.userRepository.findByEmail(data.email);
    if (existingEmail) {
      throw new Error("Email already exists");
    }

    if (data.username) {
      const existingUsername = await this.userRepository.findByUsername(
        data.username,
      );
      if (existingUsername) {
        throw new Error("Username already exists");
      }
    }

    let isAutoVerified = false;

    // Validate invitation token if present
    if (data.invitationToken) {
      const { InvitationService } =
        await import("../invitation/invitation.service.js");
      const invitationService = new InvitationService();
      try {
        const invitationDetails =
          await invitationService.validateInvitationToken(data.invitationToken);

        if (
          invitationDetails.email.toLowerCase().trim() ===
          data.email.toLowerCase().trim()
        ) {
          isAutoVerified = true;
        } else {
          console.warn(
            `Invitation email mismatch: ${invitationDetails.email} vs ${data.email}`,
          );
          // Make this a critical error so the user knows why auto-verify failed
          throw new Error("Invitation email does not match registration email");
        }
      } catch (error) {
        console.error("Invitation validation failed:", error);
        // If the user explicitly provided a token, and it failed, we SHOULD throw
        // to let them know something is wrong, rather than silently continuing.
        // Or if we continue, we must inform them.
        throw error; // Let's throw to be safe and visible.
      }
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Create user with verified status if invitation was valid
    const user = await this.userRepository.create(
      {
        ...data,
      },
      hashedPassword,
    );

    // If auto-verified, update the user status immediately (or ensure create accepts isVerified)
    // The repository.create method might not accept isVerified in the DTO if it's strict.
    // Let's check repository.create or just update it after.
    // Actually, looking at the schema, isVerified is default false.
    // We can update it immediately if we can't pass it to create.

    if (isAutoVerified) {
      await this.userRepository.verifyUser(user.id);

      // Accept the invitation
      try {
        const { InvitationService } =
          await import("../invitation/invitation.service.js");
        const invitationService = new InvitationService();
        await invitationService.acceptInvitation(
          { token: data.invitationToken! },
          user.email,
        );
        console.log(`Invitation accepted for user ${user.email}`);
      } catch (error) {
        console.error("Failed to accept invitation after creation:", error);
        // We don't throw here to avoid rolling back user creation,
        // but this is a critical failure for the "seamless" flow.
      }
    }

    return {
      user: this.removePasswordFromUser(user),
      isAutoVerified,
    };
  }

  async loginUser(data: {
    emailOrUsername: string;
    password: string;
  }): Promise<{ user: UserWithoutPassword }> {
    let user = null;
    if (data.emailOrUsername.includes("@")) {
      user = await this.userRepository.findByEmail(data.emailOrUsername);
    } else {
      user = await this.userRepository.findByUsername(data.emailOrUsername);
    }
    if (!user) {
      throw new AppError("Invalid email/username or password", 401);
    }
    const isPasswordValid = await compareHash(data.password, user.password);
    if (!isPasswordValid) {
      throw new AppError("Invalid email or password", 401);
    }
    return {
      user: this.removePasswordFromUser(user),
    };
  }

  async getUserById(id: string): Promise<UserWithoutPassword> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error("User not found");
    }
    return this.removePasswordFromUser(user);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = await this.userRepository.findByEmail(email);
    return user;
  }

  async updateUser(
    id: string,
    data: UpdateUserDTO,
  ): Promise<UserWithoutPassword> {
    if (data.email) {
      const existing = await this.userRepository.findByEmail(data.email);
      if (existing && existing.id !== id) {
        throw new Error("Email already exists");
      }
    }

    if (data.username) {
      const existing = await this.userRepository.findByUsername(data.username);
      if (existing && existing.id !== id) {
        throw new Error("Username already exists");
      }
    }

    const updated = await this.userRepository.update(id, data);
    return this.removePasswordFromUser(updated);
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error("User not found");
    }
    await this.userRepository.delete(id);
  }

  async changePassword(id: string, data: UpdatePasswordDTO): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error("User not found");
    }

    const isValid = await bcrypt.compare(data.currentPassword, user.password);
    if (!isValid) {
      throw new Error("Current password is incorrect");
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 12);
    await this.userRepository.updatePassword(id, hashedPassword);
  }

  async getVerificationOtp(emailOrUsername: string): Promise<number> {
    let user = null;
    if (emailOrUsername.includes("@")) {
      user = await this.userRepository.findByEmail(emailOrUsername);
    } else {
      user = await this.userRepository.findByUsername(emailOrUsername);
    }
    if (!user) {
      throw new Error("User not found");
    }
    const otp = this.generateOtp();
    const expiresAt = new Date(
      Date.now() + Number(CONFIG.OTP_EXPIRATION_MINUTES) * 60 * 1000,
    );
    await this.userRepository.setOtp(user.id, otp, expiresAt);
    return Number(otp);
  }

  async verifyUserEmailUsingOtp(
    data: VerifyUserDTO,
  ): Promise<UserWithoutPassword> {
    const user = await this.userRepository.findByEmail(data.email);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.isVerified) {
      throw new Error("User already verified");
    }

    if (!user.otp || !user.otpExpiresAt) {
      throw new Error("No OTP found. Please request a new one");
    }

    if (new Date() > user.otpExpiresAt) {
      throw new Error("OTP expired. Please request a new one");
    }

    if (user.otp !== data.otp) {
      throw new Error("Invalid OTP");
    }

    await this.userRepository.verifyUser(user.id);

    const updatedUser = await this.userRepository.findById(user.id);
    return this.removePasswordFromUser(updatedUser!);
  }

  async verifyUserEmailUsingToken(
    data: VerifyEmailDTO,
  ): Promise<UserWithoutPassword> {
    const isVerifiedToken = verifyJwtToken(data.token, CONFIG.TOKEN_SECRET!);

    if (!isVerifiedToken || !isVerifiedToken.userId) {
      throw new Error("Invalid or expired token");
    }

    const user = await this.userRepository.findById(isVerifiedToken.userId);

    if (!user) {
      throw new Error("User not found");
    }

    if (user.isVerified) {
      throw new Error("User already verified");
    }
    await this.userRepository.verifyUser(user.id);

    const updatedUser = await this.userRepository.findById(user.id);

    return this.removePasswordFromUser(updatedUser!);
  }

  async getUsers(
    filters?: UserFilters,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<UserWithoutPassword>> {
    return await this.userRepository.findAll(filters, pagination);
  }

  async enableMfa(id: string): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error("User not found");
    }
    await this.userRepository.enableMfa(id);
  }

  async disableMfa(id: string): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error("User not found");
    }
    await this.userRepository.disableMfa(id);
  }

  async resetPassword(id: string, data: ResetPasswordDTO): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error("User not found");
    }

    const hashedPassword = await hashString(data.newPassword);
    await this.userRepository.updatePassword(id, hashedPassword);
  }
}
