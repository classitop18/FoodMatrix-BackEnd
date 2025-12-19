import { and, eq, InferSelectModel } from "drizzle-orm";
import { accounts, members } from "../../database/schemas/schema.js";
import { getDb } from "../../database/db.js";

// ================== TYPES ==================
export type Account = InferSelectModel<typeof accounts>;
export type AccountInsert = Omit<Account, "id" | "createdAt" | "accountNumber">;

// ================== INTERFACE ==================
export interface IAccountRepository {
  createAccount(data: AccountInsert): Promise<Account>;
  getAccountById(id: string, primaryAdminId: string): Promise<Account | null>;
  getAccountsByPrimaryAdmin(userId: string): Promise<Account[]>;
  updateAccount(id: string, data: Partial<Account>): Promise<Account | null>;
  deleteAccount(id: string): Promise<void>;
  // Membership related
  getAccountsByUserId(userId: string): Promise<any[]>;
  isUserMemberOfAccount(userId: string, accountId: string): Promise<boolean>;
}

// ================== REPOSITORY ==================
export class AccountRepository implements IAccountRepository {
  private _db: any = null;

  private get db() {
    if (!this._db) {
      this._db = getDb();
    }
    return this._db;
  }

  // Create account
  async createAccount(data: AccountInsert): Promise<Account> {
    const [account] = await this.db.insert(accounts).values(data).returning();
    return account;
  }

  async getAccountData(payload: {
    id?: string;
    accountNumber?: string;
    primaryAdminId?: string;
  }): Promise<Account | null> {
    const conditions = [];

    if (payload.id) {
      conditions.push(eq(accounts.id, payload.id));
    }

    if (payload.accountNumber) {
      conditions.push(eq(accounts.accountNumber, payload.accountNumber));
    }

    if (payload.primaryAdminId) {
      conditions.push(eq(accounts.primaryAdminId, payload.primaryAdminId));
    }

    if (conditions.length === 0) {
      throw new Error("At least one filter is required");
    }

    const result = await this.db
      .select()
      .from(accounts)
      .where(and(...conditions))
      .limit(1);

    return result[0] ?? null;
  }

  async getAccountById(
    id: string,
    primaryAdminId: string,
  ): Promise<Account | null> {
    const result = await this.db
      .select()
      .from(accounts)
      .where(
        and(eq(accounts.id, id), eq(accounts.primaryAdminId, primaryAdminId)),
      )
      .limit(1);

    return result[0] ?? null;
  }

  // Get accounts where user is primary admin
  async getAccountsByPrimaryAdmin(userId: string): Promise<Account[]> {
    return this.db
      .select()
      .from(accounts)
      .where(eq(accounts.primaryAdminId, userId));
  }

  // Update account
  async updateAccount(
    id: string,
    data: Partial<Account>,
  ): Promise<Account | null> {
    const [updated] = await this.db
      .update(accounts)
      .set(data)
      .where(eq(accounts.id, id))
      .returning();

    return updated ?? null;
  }

  // Delete account with cascade
  async deleteAccount(id: string): Promise<void> {
    // Import health profiles table
    const { healthProfiles } = await import("../../database/schemas/schema.js");

    // Step 1: Get all members of this account
    const accountMembers = await this.db
      .select()
      .from(members)
      .where(eq(members.accountId, id));

    // Step 2: Delete all health profiles for these members
    if (accountMembers.length > 0) {
      const memberIds = accountMembers.map((m: any) => m.id);

      for (const memberId of memberIds) {
        await this.db
          .delete(healthProfiles)
          .where(eq(healthProfiles.memberId, memberId));
      }
    }

    // Step 3: Delete all members of this account
    await this.db.delete(members).where(eq(members.accountId, id));

    // Step 4: Finally delete the account
    await this.db.delete(accounts).where(eq(accounts.id, id));
  }

  // ================== MEMBERSHIP HELPERS ==================

  // Get all accounts where user is a member
  async getAccountsByUserId(userId: string): Promise<
    {
      id: string;
      accountName: string | null;
      description: string | null;
      accountNumber: string;
    }[]
  > {
    if (!userId) {
      throw new Error("userId is required");
    }

    console.log("Fetching accounts for user:", userId);

    return await this.db
      .select({
        id: accounts.id,
        accountName: accounts.accountName,
        description: accounts.description,
        accountNumber: accounts.accountNumber,
      })
      .from(accounts)
      .where(eq(accounts.primaryAdminId, userId));
  }

  // Check if user belongs to account
  async isUserMemberOfAccount(
    userId: string,
    accountId: string,
  ): Promise<boolean> {
    const result = await this.db
      .select()
      .from(members)
      .where(eq(members.userId, userId), eq(members.accountId, accountId))
      .limit(1);

    return result.length > 0;
  }
}
