import { getDb } from "@/database/db.js";
import { CreateActivityDTO, IActivity } from "./types/activity.types.js";
import { activity } from "@/database/schemas/schema.js";
import { desc, eq } from "drizzle-orm";

export interface IActivityRepository {
  create(data: CreateActivityDTO): Promise<IActivity>;

  findByAccount(accountId: string): Promise<IActivity[]>;

  findByMember(memberId: string): Promise<IActivity[]>;

  getRecent(accountId: string, limit?: number): Promise<IActivity[]>;
}

export class ActivityRepository implements IActivityRepository {
  private _db: any = null;

  private get db() {
    if (!this._db) {
      this._db = getDb();
    }
    return this._db;
  }

  async create(data: CreateActivityDTO): Promise<IActivity> {
    const [result] = await this.db.insert(activity).values(data).returning();

    return result;
  }

  async findByAccount(accountId: string): Promise<IActivity[]> {
    return this.db
      .select()
      .from(activity)
      .where(eq(activity.accountId, accountId))
      .orderBy(desc(activity.createdAt));
  }

  async findByMember(memberId: string): Promise<IActivity[]> {
    return this.db
      .select()
      .from(activity)
      .where(eq(activity.memberId, memberId))
      .orderBy(desc(activity.createdAt));
  }

  async getRecent(accountId: string, limit: number = 20): Promise<IActivity[]> {
    return this.db
      .select()
      .from(activity)
      .where(eq(activity.accountId, accountId))
      .orderBy(desc(activity.createdAt))
      .limit(limit);
  }
}
