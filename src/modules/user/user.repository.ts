import { eq, and, count } from "drizzle-orm";
import {
  CreateUserDTO,
  PaginatedResponse,
  PaginationParams,
  UpdateUserDTO,
  User,
  UserFilters,
  UserWithoutPassword,
} from "./types/user.types.js";
import { getDb } from "@/database/db.js";
import { users } from "@/database/schemas/schema.js";

export interface IUserRepository {
  create(data: CreateUserDTO, hashedPassword: string): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  update(id: string, data: UpdateUserDTO): Promise<User>;
  delete(id: string): Promise<void>;
  updatePassword(id: string, hashedPassword: string): Promise<void>;
  setOtp(id: string, otp: string, expiresAt: Date): Promise<void>;
  verifyUser(id: string): Promise<void>;
  updateLastLogin(id: string): Promise<void>;
  enableMfa(id: string): Promise<void>;
  disableMfa(id: string): Promise<void>;
  findAll(
    filters?: UserFilters,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<UserWithoutPassword>>;
  countUsers(filters?: UserFilters): Promise<number>;
}

export class UserRepository implements IUserRepository {
   
  private _db: any = null;

  private get db() {
    if (!this._db) {
      this._db = getDb();
    }
    return this._db;
  }

  async create(data: CreateUserDTO, hashedPassword: string): Promise<User> {
    const [user] = await this.db
      .insert(users)
      .values({
        ...data,
        password: hashedPassword,
      })
      .returning();

    if (!user) {
      throw new Error("Failed to create user");
    }

    return user;
  }

  async findById(id: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user || null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    return user || null;
  }

  async update(id: string, data: UpdateUserDTO): Promise<User> {
    const [updated] = await this.db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    if (!updated) {
      throw new Error("User not found");
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id));
  }

  async updatePassword(id: string, hashedPassword: string): Promise<void> {
    await this.db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async setOtp(id: string, otp: string, expiresAt: Date): Promise<void> {
    await this.db
      .update(users)
      .set({ otp, otpExpiresAt: expiresAt, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async verifyUser(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        isVerified: true,
        otp: null,
        otpExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, id));
  }

  async enableMfa(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({ isMfaEnabled: true, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async disableMfa(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({ isMfaEnabled: false, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async findAll(
    filters?: UserFilters,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<UserWithoutPassword>> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (filters?.isVerified !== undefined) {
      conditions.push(eq(users.isVerified, filters.isVerified));
    }
    if (filters?.isMfaEnabled !== undefined) {
      conditions.push(eq(users.isMfaEnabled, filters.isMfaEnabled));
    }
    if (filters?.country) {
      conditions.push(eq(users.country, filters.country));
    }
    if (filters?.state) {
      conditions.push(eq(users.state, filters.state));
    }
    if (filters?.city) {
      conditions.push(eq(users.city, filters.city));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: users.id,
          email: users.email,
          username: users.username,
          isVerified: users.isVerified,
          avatar: users.avatar,
          isMfaEnabled: users.isMfaEnabled,
          firstName: users.firstName,
          lastName: users.lastName,
          phone: users.phone,
          addressLine1: users.addressLine1,
          addressLine2: users.addressLine2,
          city: users.city,
          state: users.state,
          country: users.country,
          zipCode: users.zipCode,
          formattedAddress: users.formattedAddress,
          latitude: users.latitude,
          longitude: users.longitude,
          placeId: users.placeId,
          otpExpiresAt: users.otpExpiresAt,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          lastLoginAt: users.lastLoginAt,
        })
        .from(users)
        .where(whereClause)
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(users).where(whereClause),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limit),
      },
    };
  }

  async countUsers(filters?: UserFilters): Promise<number> {
    const conditions = [];
    if (filters?.isVerified !== undefined) {
      conditions.push(eq(users.isVerified, filters.isVerified));
    }
    if (filters?.isMfaEnabled !== undefined) {
      conditions.push(eq(users.isMfaEnabled, filters.isMfaEnabled));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [result] = await this.db
      .select({ count: count() })
      .from(users)
      .where(whereClause);

    return Number(result.count);
  }
}
