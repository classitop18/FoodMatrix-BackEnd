import {
  eq,
  and,
  sql,
  inArray,
  like,
  or,
  desc,
  asc,
  InferSelectModel,
  isNull,
} from "drizzle-orm";
import { CreateMemberDto, UpdateMemberDto } from "./dto/member.dto.js";
import {
  Member,
  MemberQueryOptions,
  MemberStats,
  MemberWithRelations,
  PaginatedResult,
} from "./types/member.types.js";
import { accounts, members, users } from "../../database/schemas/schema.js";
import { getDb } from "../../database/db.js";

export interface IMemberRepository {
  // Basic CRUD
  create(data: CreateMemberDto): Promise<Member>;
  findById(
    id: string,
    withRelations?: boolean,
  ): Promise<MemberWithRelations | null>;
  findByUserId(userId: string, accountId?: string): Promise<Member[]>;
  findByAccountId(accountId: string): Promise<Member[]>;
  update(id: string, data: UpdateMemberDto): Promise<Member>;
  delete(id: string): Promise<void>;

  // Query & Pagination
  findAll(
    options: MemberQueryOptions,
  ): Promise<PaginatedResult<MemberWithRelations>>;
  findMany(filters: Partial<Member>): Promise<Member[]>;

  // Specialized Queries
  findAccountMembers(
    accountId: string,
    withRelations?: boolean,
  ): Promise<MemberWithRelations[]>;
  findInternalMembers(accountId: string): Promise<Member[]>;
  findRegisteredMembers(accountId: string): Promise<MemberWithRelations[]>;
  findByRole(accountId: string, role: string): Promise<Member[]>;
  findOwner(accountId: string): Promise<Member | null>;

  // Existence Checks
  exists(id: string): Promise<boolean>;
  isUserMember(userId: string, accountId: string): Promise<boolean>;

  // Bulk Operations
  bulkUpdateRole(memberIds: string[], role: string): Promise<number>;
  bulkDelete(memberIds: string[]): Promise<number>;

  // Stats & Analytics
  getStats(accountId: string): Promise<MemberStats>;
  count(accountId: string): Promise<number>;
  countByRole(accountId: string): Promise<Record<string, number>>;
}

export class MemberRepository implements IMemberRepository {
  private _db: any = null;

  private get db() {
    if (!this._db) {
      this._db = getDb();
    }
    return this._db;
  }

  async create(data: CreateMemberDto): Promise<Member> {
    const result = await this.db.insert(members).values(data).returning();

    if (!result.length) {
      throw new Error("Insert failed: no row returned");
    }

    return result[0];
  }

  async findById(
    id: string,
    withRelations = false,
  ): Promise<MemberWithRelations | null> {
    if (!withRelations) {
      const [member] = await this.db
        .select()
        .from(members)
        .where(eq(members.id, id))
        .limit(1);
      return member || null;
    }

    const [member] = await this.db
      .select({
        id: members.id,
        accountId: members.accountId,
        userId: members.userId,
        role: members.role,
        name: members.name,
        age: members.age,
        sex: members.sex,
        createdAt: members.createdAt,
        user: {
          id: users.id,
          email: users.email,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          avatar: users.avatar,
          phone: users.phone,
        },
        account: {
          id: accounts.id,
          accountNumber: accounts.accountNumber,
          accountName: accounts.accountName,
          accountType: accounts.accountType,
          primaryAdminId: accounts.primaryAdminId,
        },
      })
      .from(members)
      .leftJoin(users, eq(members.userId, users.id))
      .leftJoin(accounts, eq(members.accountId, accounts.id))
      .where(eq(members.id, id))
      .limit(1);

    return member || null;
  }

  async findByUserId(userId: string, accountId?: string): Promise<Member[]> {
    const conditions = [eq(members.userId, userId)];
    if (accountId) {
      conditions.push(eq(members.accountId, accountId));
    }

    return await this.db
      .select()
      .from(members)
      .where(and(...conditions));
  }

  async findByAccountId(accountId: string): Promise<Member[]> {
    return await this.db
      .select()
      .from(members)
      .where(eq(members.accountId, accountId));
  }

  async update(id: string, data: UpdateMemberDto): Promise<Member> {
    const [updated] = await this.db
      .update(members)
      .set(data)
      .where(eq(members.id, id))
      .returning();
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(members).where(eq(members.id, id));
  }

  async findAll(
    options: MemberQueryOptions,
  ): Promise<PaginatedResult<MemberWithRelations>> {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      accountId,
      userId,
      role,
      isInternal,
      search,
    } = options;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (accountId) conditions.push(eq(members.accountId, accountId));
    if (userId) conditions.push(eq(members.userId, userId));
    if (role)
      conditions.push(
        eq(members.role, role as "admin" | "super_admin" | "member"),
      );
    if (isInternal !== undefined) {
      conditions.push(
        isInternal
          ? sql`${members.userId} IS NULL`
          : sql`${members.userId} IS NOT NULL`,
      );
    }
    if (search) {
      conditions.push(
        or(
          like(members.name, `%${search}%`),
          like(users.email, `%${search}%`),
          like(users.firstName, `%${search}%`),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const sortColumn =
      sortBy === "name"
        ? members.name
        : sortBy === "role"
          ? members.role
          : members.createdAt;
    const orderBy = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const [data, [{ count }]] = await Promise.all([
      this.db
        .select({
          id: members.id,
          accountId: members.accountId,
          userId: members.userId,
          role: members.role,
          name: members.name,
          age: members.age,
          sex: members.sex,
          createdAt: members.createdAt,
          user: {
            id: users.id,
            email: users.email,
            username: users.username,
            firstName: users.firstName,
            lastName: users.lastName,
            avatar: users.avatar,
            phone: users.phone,
          },
          account: {
            id: accounts.id,
            accountNumber: accounts.accountNumber,
            accountName: accounts.accountName,
            accountType: accounts.accountType,
            primaryAdminId: accounts.primaryAdminId,
          },
        })
        .from(members)
        .leftJoin(users, eq(members.userId, users.id))
        .leftJoin(accounts, eq(members.accountId, accounts.id))
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(members)
        .leftJoin(users, eq(members.userId, users.id))
        .where(whereClause),
    ]);

    const total = Number(count);
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async findMany(filters: Partial<Member>): Promise<Member[]> {
    const conditions = Object.entries(filters)
      .filter(([, value]) => value !== undefined) // optional
      .map(([key, value]) => {
        const column: any = members[key as keyof typeof members];

        if (value === null) {
          return isNull(column);
        }

        return eq(column, value);
      });

    return this.db
      .select()
      .from(members)
      .where(conditions.length ? and(...conditions) : undefined);
  }

  async findAccountMembers(
    accountId: string,
    withRelations = true,
  ): Promise<MemberWithRelations[]> {
    if (!withRelations) {
      return await this.db
        .select()
        .from(members)
        .where(eq(members.accountId, accountId));
    }

    return await this.db
      .select({
        id: members.id,
        accountId: members.accountId,
        userId: members.userId,
        role: members.role,
        name: members.name,
        age: members.age,
        sex: members.sex,
        createdAt: members.createdAt,
        user: {
          id: users.id,
          email: users.email,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          avatar: users.avatar,
          phone: users.phone,
        },
      })
      .from(members)
      .leftJoin(users, eq(members.userId, users.id))
      .where(eq(members.accountId, accountId));
  }

  async findInternalMembers(accountId: string): Promise<Member[]> {
    return await this.db
      .select()
      .from(members)
      .where(
        and(eq(members.accountId, accountId), sql`${members.userId} IS NULL`),
      );
  }

  async findRegisteredMembers(
    accountId: string,
  ): Promise<MemberWithRelations[]> {
    return await this.db
      .select({
        id: members.id,
        accountId: members.accountId,
        userId: members.userId,
        role: members.role,
        name: members.name,
        age: members.age,
        sex: members.sex,
        createdAt: members.createdAt,
        user: {
          id: users.id,
          email: users.email,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          avatar: users.avatar,
          phone: users.phone,
        },
      })
      .from(members)
      .innerJoin(users, eq(members.userId, users.id))
      .where(eq(members.accountId, accountId));
  }

  async findByRole(
    accountId: string,
    role: "admin" | "super_admin" | "member",
  ): Promise<Member[]> {
    return await this.db
      .select()
      .from(members)
      .where(and(eq(members.accountId, accountId), eq(members.role, role)));
  }

  async findOwner(accountId: string): Promise<Member | null> {
    const [owner] = await this.db
      .select()
      .from(members)
      .where(and(eq(members.accountId, accountId), eq(members.role, "admin")))
      .limit(1);
    return owner || null;
  }

  async exists(id: string): Promise<boolean> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(members)
      .where(eq(members.id, id));
    return Number(result.count) > 0;
  }

  async isUserMember(userId: string, accountId: string): Promise<boolean> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.accountId, accountId)));
    return Number(result.count) > 0;
  }

  async bulkUpdateRole(memberIds: string[], role: string): Promise<number> {
    const result = await this.db
      .update(members)
      .set({ role })
      .where(inArray(members.id, memberIds));
    return result.rowCount || 0;
  }

  async bulkDelete(memberIds: string[]): Promise<number> {
    const result = await this.db
      .delete(members)
      .where(inArray(members.id, memberIds));
    return result.rowCount || 0;
  }

  async getStats(accountId: string): Promise<MemberStats> {
    const [stats] = await this.db
      .select({
        total: sql<number>`count(*)`,
        registered: sql<number>`count(*) filter (where ${members.userId} is not null)`,
        internal: sql<number>`count(*) filter (where ${members.userId} is null)`,
      })
      .from(members)
      .where(eq(members.accountId, accountId));

    const roleStats = await this.db
      .select({
        role: members.role,
        count: sql<number>`count(*)`,
      })
      .from(members)
      .where(eq(members.accountId, accountId))
      .groupBy(members.role);

    return {
      totalMembers: Number(stats.total),
      registeredMembers: Number(stats.registered),
      internalMembers: Number(stats.internal),
      membersByRole: Object.fromEntries(
        roleStats.map((r: any) => [r.role, Number(r.count)]),
      ),
    };
  }

  async count(accountId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(members)
      .where(eq(members.accountId, accountId));
    return Number(result.count);
  }

  async countByRole(accountId: string): Promise<Record<string, number>> {
    const results = await this.db
      .select({
        role: members.role,
        count: sql<number>`count(*)`,
      })
      .from(members)
      .where(eq(members.accountId, accountId))
      .groupBy(members.role);

    return Object.fromEntries(
      results.map((r: any) => [r.role, Number(r.count)]),
    );
  }
}
