import { UserOtp, UserOtpInsert } from "./types/user-otp.types";


import { eq, and, gt, desc } from "drizzle-orm";
import { userOtps } from "../../database/schema.ts";
import { getDb } from "../../database/db.ts";



export interface IUserOtpRepository {
    createOtp(data: UserOtpInsert): Promise<UserOtp>;
    getLatestValidOtp(userId: string, purpose: string): Promise<UserOtp | null>;
    verifyOtp(userId: string, otp: string, purpose: string): Promise<UserOtp | null>;
    markOtpUsed(id: string): Promise<UserOtp | null>;
    deleteExpiredOtps(): Promise<number>;
}


// user-otp.repository.ts

export class UserOtpRepository implements IUserOtpRepository {
    private _db: any = null;

    private get db() {
        if (!this._db) this._db = getDb();
        return this._db;
    }

    async createOtp(data: UserOtpInsert): Promise<UserOtp> {
        const [otp] = await this.db.insert(userOtps).values(data).returning();
        return otp;
    }

    async getLatestValidOtp(userId: string, purpose: string): Promise<UserOtp | null> {
        const rows = await this.db
            .select()
            .from(userOtps)
            .where(
                and(
                    eq(userOtps.userId, userId),
                    eq(userOtps.purpose, purpose),
                    eq(userOtps.used, false),
                    gt(userOtps.expiresAt, new Date())
                )
            )
            .orderBy(desc(userOtps.createdAt))
            .limit(1);

        return rows[0] ?? null;
    }

    async verifyOtp(
        userId: string,
        otp: string,
        purpose: string
    ): Promise<UserOtp | null> {
        const rows = await this.db
            .select()
            .from(userOtps)
            .where(
                and(
                    eq(userOtps.userId, userId),
                    eq(userOtps.otp, otp),
                    eq(userOtps.purpose, purpose),
                    eq(userOtps.used, false),
                    gt(userOtps.expiresAt, new Date())
                )
            )
            .limit(1);

        return rows[0] ?? null;
    }

    async markOtpUsed(id: string): Promise<UserOtp | null> {
        const [updated] = await this.db
            .update(userOtps)
            .set({ used: true, usedAt: new Date() })
            .where(eq(userOtps.id, id))
            .returning();

        return updated ?? null;
    }

    async deleteExpiredOtps(): Promise<number> {
        const result = await this.db
            .delete(userOtps)
            .where(gt(userOtps.expiresAt, new Date()));

        return result.rowCount ?? 0;
    }
}
