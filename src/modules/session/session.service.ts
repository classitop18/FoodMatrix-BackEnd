import {
  ISessionRepository,
  Session,
  SessionInsert,
} from "./session.repository";

export interface ISessionService {
  createSession(data: SessionInsert): Promise<Session>;
  getSessionById(id: string): Promise<Session | null>;
  getSessionsByUserId(userId: string): Promise<Session[]>;
  updateSession(id: string, data: Partial<Session>): Promise<Session | null>;
  deleteSession(id: string): Promise<void>;
  invalidateAllSessions(userId: string): Promise<number>;
  findValidSessionByRefreshToken(
    userId: string,
    refreshTokenHash: string,
  ): Promise<Session | null>;
}

export class SessionService implements ISessionService {
  constructor(private sessionRepo: ISessionRepository) {}

  // Create a new session
  async createSession(data: SessionInsert): Promise<Session> {
    return this.sessionRepo.createSession(data);
  }

  // Get session by ID
  async getSessionById(id: string): Promise<Session | null> {
    return this.sessionRepo.getSessionById(id);
  }

  // Get all sessions of a user
  async getSessionsByUserId(userId: string): Promise<Session[]> {
    return this.sessionRepo.getSessionsByUserId(userId);
  }

  // Update a session (e.g., lastUsedAt, isValid)
  async updateSession(
    id: string,
    data: Partial<Session>,
  ): Promise<Session | null> {
    return this.sessionRepo.updateSession(id, data);
  }

  // Delete session
  async deleteSession(id: string): Promise<void> {
    await this.sessionRepo.deleteSession(id);
  }

  // Invalidate all sessions for a user
  async invalidateAllSessions(userId: string): Promise<number> {
    return this.sessionRepo.invalidateAllUserSessions(userId);
  }

  // Find a valid session by refresh token
  async findValidSessionByRefreshToken(
    userId: string,
    refreshTokenHash: string,
  ): Promise<Session | null> {
    return this.sessionRepo.findValidSessionByRefreshToken(
      userId,
      refreshTokenHash,
    );
  }
}
