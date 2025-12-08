import {
  CreateUserDTO,
  PaginatedResponse,
  PaginationParams,
  UpdatePasswordDTO,
  UpdateUserDTO,
  User,
  UserFilters,
  UserWithoutPassword,
  VerifyEmailDTO,
  VerifyUserDTO,
} from "./types/user.types";
import * as bcrypt from "bcrypt";
import { IUserRepository } from "./user.repository";
import { verifyJwtToken } from "../../utils/jwt.utils";
import { CONFIG } from "../../utils/env.config";

export interface IUserService {
  createUser(data: CreateUserDTO): Promise<UserWithoutPassword>;
  getUserById(id: string): Promise<UserWithoutPassword>;
  getUserByEmail(email: string): Promise<User>;
  updateUser(id: string, data: UpdateUserDTO): Promise<UserWithoutPassword>;
  deleteUser(id: string): Promise<void>;
  changePassword(id: string, data: UpdatePasswordDTO): Promise<void>;
  sendVerificationOtp(email: string): Promise<void>;
  verifyUserEmailUsingOtp(data: VerifyUserDTO): Promise<UserWithoutPassword>;
  verifyUserEmailUsingToken(data: VerifyEmailDTO): Promise<UserWithoutPassword>;
  getUsers(
    filters?: UserFilters,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<UserWithoutPassword>>;
  enableMfa(id: string): Promise<void>;
  disableMfa(id: string): Promise<void>;
}

export class UserService implements IUserService {
  constructor(private userRepository: IUserRepository) { }

  private removePasswordFromUser(user: User): UserWithoutPassword {
    const { password, otp, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
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

    await this.sendVerificationOtp(user.email);

    return this.removePasswordFromUser(user);
  }

  async getUserById(id: string): Promise<UserWithoutPassword> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error("User not found");
    }
    return this.removePasswordFromUser(user);
  }

  async getUserByEmail(email: string): Promise<User> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error("User not found");
    }
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

  async sendVerificationOtp(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.isVerified) {
      throw new Error("User already verified");
    }

    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.userRepository.setOtp(user.id, otp, expiresAt);

    // TODO: Send OTP via email service
    console.log(`OTP for ${email}: ${otp}`);
  }

  async verifyUserEmailUsingOtp(data: VerifyUserDTO): Promise<UserWithoutPassword> {
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

  async verifyUserEmailUsingToken(data: VerifyEmailDTO): Promise<UserWithoutPassword> {


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
}
