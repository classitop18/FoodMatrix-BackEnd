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
} from "./types/user.types.ts";
import * as bcrypt from "bcrypt";
import { IUserRepository } from "./user.repository.ts";
import { generateJwtToken, verifyJwtToken } from "../../utils/jwt.utils.ts";
import { CONFIG } from "../../utils/env.config.ts";
import { compareHash, hashString } from "../../utils/bcrypt.utils.ts";

export interface IUserService {
  createUser(data: CreateUserDTO): Promise<UserWithoutPassword>;
  loginUser(data: {
    emailOrUsername: string;
    password: string;
  }): Promise<{ user: UserWithoutPassword }>;
  getUserById(id: string): Promise<UserWithoutPassword>;
  getUserByEmail(email: string): Promise<User|null>;
  updateUser(id: string, data: UpdateUserDTO): Promise<UserWithoutPassword>;
  deleteUser(id: string): Promise<void>;
  changePassword(id: string, data: UpdatePasswordDTO): Promise<void>;
  getVerificationOtp(email: string): Promise<number>;
  verifyUserEmailUsingOtp(data: VerifyUserDTO): Promise<UserWithoutPassword>;
  verifyUserEmailUsingToken(data: VerifyEmailDTO): Promise<UserWithoutPassword>;
  resetPassword(id: string, data: ResetPasswordDTO): Promise<any>;
  getUsers(
    filters?: UserFilters,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<UserWithoutPassword>>;
  enableMfa(id: string): Promise<void>;
  disableMfa(id: string): Promise<void>;
  findUserByField(data: { field: string; value: string }): Promise<any>;
}

export class UserService implements IUserService {
  constructor(private userRepository: IUserRepository) {}

  private removePasswordFromUser(user: User): UserWithoutPassword {
    const { password, otp, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async findUserByField(data: { field: string; value: string }) {
    const { field, value } = data;
    if (!field || !value) return null;

    switch (field) {
      case "email": {
        return await this.userRepository.findByEmail(
          value.trim().toLowerCase(),
        );
      }
      case "username": {
        return await this.userRepository.findByUsername(value.trim());
      }

      default: {
        console.warn(`Unsupported field: ${field}`);
        return null; // prevent undefined return
      }
    }
  }

  async createUser(data: CreateUserDTO): Promise<UserWithoutPassword> {
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

    const hashedPassword = await bcrypt.hash(data.password, 12);
    const user = await this.userRepository.create(data, hashedPassword);
    return this.removePasswordFromUser(user);
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
      throw new Error("Invalid email/username or password");
    }
    const isPasswordValid = await compareHash(data.password, user.password);
    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
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

  async resetPassword(id: string, data: ResetPasswordDTO): Promise<any> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error("User not found");
    }

    console.log("yha tk to aa gya hu", data)
    const hashedPassword = await hashString(data.newPassword);
    await this.userRepository.updatePassword(id, hashedPassword);
  }
}
