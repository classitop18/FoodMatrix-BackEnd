import { eq, InferSelectModel } from "drizzle-orm";
import { sessions } from "../../database/schema.ts";
import { getDb } from "../../database/db.ts";

// ================== TYPES ==================
export type Session = InferSelectModel<typeof sessions>;
export type SessionInsert = Omit<Session, "id" | "createdAt" | "lastUsedAt">;

// ================== INTERFACE ==================
export interface ISessionRepository {
  createSession(session: SessionInsert): Promise<Session>;
  getSessionById(id: string): Promise<Session | null>;
  getSessionsByUserId(userId: string): Promise<Session[]>;
  updateSession(id: string, data: Partial<Session>): Promise<Session | null>;
  deleteSession(id: string): Promise<void>;
  invalidateAllUserSessions(userId: string): Promise<number>; // Returns count of updated rows
  findValidSessionByRefreshToken(
    userId: string,
    refreshTokenHash: string,
  ): Promise<Session | null>;
}

// ================== REPOSITORY ==================
export class SessionRepository implements ISessionRepository {
  private _db: any = null;

  private get db() {
    if (!this._db) {
      this._db = getDb();
    }
    return this._db;
  }

  // Create a new session
  async createSession(session: SessionInsert): Promise<Session> {
    const [newSession] = await this.db
      .insert(sessions)
      .values(session)
      .returning();
    return newSession;
  }

  // Get session by ID
  async getSessionById(id: string): Promise<Session | null> {
    const session = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);
    return session[0] ?? null;
  }

  // Get all sessions for a user
  async getSessionsByUserId(userId: string): Promise<Session[]> {
    return this.db.select().from(sessions).where(eq(sessions.userId, userId));
  }

  // Update session fields (e.g., lastUsedAt, isValid)
  async updateSession(
    id: string,
    data: Partial<Session>,
  ): Promise<Session | null> {
    const [updated] = await this.db
      .update(sessions)
      .set(data)
      .where(eq(sessions.id, id))
      .returning();
    return updated ?? null;
  }

  // Delete a session
  async deleteSession(id: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, id));
  }

  // Invalidate all sessions for a user
  async invalidateAllUserSessions(userId: string): Promise<number> {
    const updated = await this.db
      .update(sessions)
      .set({ isValid: false })
      .where(eq(sessions.userId, userId));
    return updated.rowCount || 0; // Drizzle may provide rowCount
  }

  // Find a valid session by refresh token hash
  async findValidSessionByRefreshToken(
    userId: string,
    refreshTokenHash: string,
  ): Promise<Session | null> {
    const session = await this.db
      .select()
      .from(sessions)
      .where(
        eq(sessions.userId, userId),
        eq(sessions.refreshTokenHash, refreshTokenHash),
        eq(sessions.isValid, true),
      )
      .limit(1);
    return session[0] ?? null;
  }
}
