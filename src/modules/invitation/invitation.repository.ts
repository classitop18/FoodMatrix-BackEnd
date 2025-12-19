import { eq, and, desc, or, sql } from "drizzle-orm";
import { getDb } from "../../database/db.js";
import { invitations, accounts, users } from "../../database/schemas/schema.js";
import type { GetInvitationsQuery } from "./dto/invitation.dto.js";

export class InvitationRepository {
    private _db: any = null;

    private get db() {
        if (!this._db) {
            this._db = getDb();
        }
        return this._db;
    }
    // ============ CREATE INVITATION ============
    async create(data: {
        accountId: string;
        email: string;
        invitedBy: string;
        token: string;
        expiresAt: Date;
        role?: string;
    }) {
        const [invitation] = await this.db
            .insert(invitations)
            .values(data)
            .returning();

        return invitation;
    }

    // ============ FIND INVITATION BY ID ============
    async findById(id: string) {
        const [invitation] = await this.db
            .select({
                id: invitations.id,
                accountId: invitations.accountId,
                email: invitations.email,
                role: invitations.role,
                invitedBy: invitations.invitedBy,
                token: invitations.token,
                status: invitations.status,
                expiresAt: invitations.expiresAt,
                acceptedAt: invitations.acceptedAt,
                approvedAt: invitations.approvedAt,
                rejectedAt: invitations.rejectedAt,
                createdAt: invitations.createdAt,
                account: {
                    id: accounts.id,
                    accountName: accounts.accountName,
                    accountNumber: accounts.accountNumber,
                },
                inviter: {
                    id: users.id,
                    firstName: users.firstName,
                    lastName: users.lastName,
                    email: users.email,
                },
            })
            .from(invitations)
            .leftJoin(accounts, eq(invitations.accountId, accounts.id))
            .leftJoin(users, eq(invitations.invitedBy, users.id))
            .where(eq(invitations.id, id));

        return invitation;
    }

    // ============ FIND INVITATION BY TOKEN ============
    async findByToken(token: string) {
        const [invitation] = await this.db
            .select({
                id: invitations.id,
                accountId: invitations.accountId,
                email: invitations.email,
                role: invitations.role,
                invitedBy: invitations.invitedBy,
                token: invitations.token,
                status: invitations.status,
                expiresAt: invitations.expiresAt,
                acceptedAt: invitations.acceptedAt,
                approvedAt: invitations.approvedAt,
                rejectedAt: invitations.rejectedAt,
                createdAt: invitations.createdAt,
                account: {
                    id: accounts.id,
                    accountName: accounts.accountName,
                    accountNumber: accounts.accountNumber,
                },
            })
            .from(invitations)
            .leftJoin(accounts, eq(invitations.accountId, accounts.id))
            .where(eq(invitations.token, token));

        return invitation;
    }

    // ============ FIND EXISTING PENDING INVITATION ============
    async findPendingByEmailAndAccount(email: string, accountId: string) {
        const [invitation] = await this.db
            .select()
            .from(invitations)
            .where(
                and(
                    eq(invitations.email, email),
                    eq(invitations.accountId, accountId),
                    or(
                        eq(invitations.status, "pending"),
                        eq(invitations.status, "user_accepted")
                    )
                )
            );

        return invitation;
    }

    // ============ GET ALL INVITATIONS WITH FILTERS ============
    async findAll(query: GetInvitationsQuery) {
        const { accountId, status, page = 1, limit = 10 } = query;
        const offset = (page - 1) * limit;

        let whereConditions = [];

        if (accountId) {
            whereConditions.push(eq(invitations.accountId, accountId));
        }

        if (status) {
            whereConditions.push(eq(invitations.status, status));
        }

        const whereClause =
            whereConditions.length > 0 ? and(...whereConditions) : undefined;

        // Get total count
        const [{ count }] = await this.db
            .select({ count: sql`count(*)` })
            .from(invitations)
            .where(whereClause);

        // Get paginated data
        const data = await this.db
            .select({
                id: invitations.id,
                accountId: invitations.accountId,
                email: invitations.email,
                role: invitations.role,
                invitedBy: invitations.invitedBy,
                status: invitations.status,
                expiresAt: invitations.expiresAt,
                acceptedAt: invitations.acceptedAt,
                approvedAt: invitations.approvedAt,
                rejectedAt: invitations.rejectedAt,
                createdAt: invitations.createdAt,
                account: {
                    id: accounts.id,
                    accountName: accounts.accountName,
                    accountNumber: accounts.accountNumber,
                },
                inviter: {
                    id: users.id,
                    firstName: users.firstName,
                    lastName: users.lastName,
                    email: users.email,
                },
            })
            .from(invitations)
            .leftJoin(accounts, eq(invitations.accountId, accounts.id))
            .leftJoin(users, eq(invitations.invitedBy, users.id))
            .where(whereClause)
            .orderBy(desc(invitations.createdAt))
            .limit(limit)
            .offset(offset);

        return {
            data,
            pagination: {
                page,
                limit,
                total: Number(count),
                totalPages: Math.ceil(Number(count) / limit),
                hasNext: page * limit < Number(count),
                hasPrev: page > 1,
            },
        };
    }

    // ============ UPDATE INVITATION STATUS ============
    async updateStatus(
        id: string,
        status: string,
        additionalData?: {
            acceptedAt?: Date;
            approvedAt?: Date;
            rejectedAt?: Date;
            role?: string;
        }
    ) {
        const [updated] = await this.db
            .update(invitations)
            .set({
                status,
                ...additionalData,
            })
            .where(eq(invitations.id, id))
            .returning();

        return updated;
    }

    // ============ UPDATE TOKEN (FOR RESEND) ============
    async updateToken(id: string, token: string, expiresAt: Date) {
        const [updated] = await this.db
            .update(invitations)
            .set({
                token,
                expiresAt,
                status: "pending", // Reset to pending
                acceptedAt: null,
                approvedAt: null,
                rejectedAt: null,
            })
            .where(eq(invitations.id, id))
            .returning();

        return updated;
    }

    // ============ DELETE INVITATION ============
    async delete(id: string) {
        const [deleted] = await this.db
            .delete(invitations)
            .where(eq(invitations.id, id))
            .returning();

        return deleted;
    }

    // ============ GET INVITATIONS FOR USER BY EMAIL ============
    async findByEmail(email: string) {
        return await this.db
            .select({
                id: invitations.id,
                accountId: invitations.accountId,
                email: invitations.email,
                role: invitations.role,
                status: invitations.status,
                expiresAt: invitations.expiresAt,
                acceptedAt: invitations.acceptedAt,
                approvedAt: invitations.approvedAt,
                createdAt: invitations.createdAt,
                account: {
                    id: accounts.id,
                    accountName: accounts.accountName,
                    accountNumber: accounts.accountNumber,
                },
                inviter: {
                    firstName: users.firstName,
                    lastName: users.lastName,
                },
            })
            .from(invitations)
            .leftJoin(accounts, eq(invitations.accountId, accounts.id))
            .leftJoin(users, eq(invitations.invitedBy, users.id))
            .where(eq(invitations.email, email))
            .orderBy(desc(invitations.createdAt));
    }

    // ============ EXPIRE OLD INVITATIONS ============
    async expireOldInvitations() {
        await this.db
            .update(invitations)
            .set({ status: "expired" })
            .where(
                and(
                    or(
                        eq(invitations.status, "pending"),
                        eq(invitations.status, "user_accepted")
                    ),
                    sql`${invitations.expiresAt} < NOW()`
                )
            );
    }
}
