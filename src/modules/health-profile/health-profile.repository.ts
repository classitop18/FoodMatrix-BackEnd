// src/modules/health-profiles/repositories/health-profile.repository.ts
import { eq, and, sql } from "drizzle-orm";
import { IHealthProfileRepository } from "./types/health-profile.types.js";
import {
  CreateHealthProfileDto,
  HealthProfileResponseDto,
  QueryHealthProfileDto,
  UpdateHealthProfileDto,
} from "./dto/health-profile.dto.js";
import { healthProfiles, members } from "@/database/schemas/schema.js";
import { getDb } from "@/database/db.js";

export class HealthProfileRepository implements IHealthProfileRepository {
  private _db: any = null;

  private get db() {
    if (!this._db) {
      this._db = getDb();
    }
    return this._db;
  }

  /**
   * Create a new health profile
   * @param data - The health profile data to create
   * @returns The created health profile
   */
  async create(data: CreateHealthProfileDto): Promise<any> {
    // Check if member exists
    const member = await this.db.query.members.findFirst({
      where: eq(members.id, data.memberId),
    });

    if (!member) {
      throw new Error("Member not found");
    }

    // Check if health profile already exists for this member
    const existing = await this.findByMemberId(data.memberId);
    if (existing) {
      throw new Error("Health profile already exists for this member");
    }

    const [profile] = await this.db
      .insert(healthProfiles)
      .values({
        ...data,
        conditions: data.conditions || [],
        allergies: data.allergies || [],
        dietaryRestrictions: data.dietaryRestrictions || [],
        goals: data.goals || [],
        preferredCuisines: data.preferredCuisines || [],
        excludedFoods: data.excludedFoods || [],
        includedFoods: data.includedFoods || [],
        customExclusions: data.customExclusions || [],
        customInclusions: data.customInclusions || [],
        preferenceSets: data.preferenceSets || [],
      })
      .returning();

    return this.mapToDto(profile);
  }

  async findById(id: string): Promise<HealthProfileResponseDto | null> {
    const profile = await this.db.query.healthProfiles.findFirst({
      where: eq(healthProfiles.id, id),
    });

    return profile ? this.mapToDto(profile) : null;
  }

  async findByMemberId(
    memberId: string,
  ): Promise<HealthProfileResponseDto | null> {
    const profile = await this.db.query.healthProfiles.findFirst({
      where: eq(healthProfiles.memberId, memberId),
    });

    return profile ? this.mapToDto(profile) : null;
  }

  async findAll(query: QueryHealthProfileDto): Promise<{
    data: HealthProfileResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 10,
      memberId,
      privacyLevel,
      hasConditions,
      hasAllergies,
    } = query;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [];

    if (memberId) {
      conditions.push(eq(healthProfiles.memberId, memberId));
    }

    if (privacyLevel) {
      conditions.push(eq(healthProfiles.privacyLevel, privacyLevel));
    }

    if (hasConditions !== undefined) {
      conditions.push(
        hasConditions
          ? sql`array_length(${healthProfiles.conditions}, 1) > 0`
          : sql`array_length(${healthProfiles.conditions}, 1) IS NULL OR array_length(${healthProfiles.conditions}, 1) = 0`,
      );
    }

    if (hasAllergies !== undefined) {
      conditions.push(
        hasAllergies
          ? sql`array_length(${healthProfiles.allergies}, 1) > 0`
          : sql`array_length(${healthProfiles.allergies}, 1) IS NULL OR array_length(${healthProfiles.allergies}, 1) = 0`,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(healthProfiles)
      .where(whereClause);

    // Get paginated data
    const profiles = await this.db.query.healthProfiles.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: (hp: any, { desc }: any) => [desc(hp.updatedAt)],
    });

    return {
      data: profiles.map((p: any) => this.mapToDto(p)),
      total: count,
      page,
      limit,
    };
  }

  async update(
    id: string,
    data: UpdateHealthProfileDto,
  ): Promise<HealthProfileResponseDto> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error("Health profile not found");
    }

    try {
      const [updated] = await this.db
        .update(healthProfiles)
        .set({
          ...data,
          updatedAt: sql`now()`,
        })
        .where(eq(healthProfiles.id, id))
        .returning();

      return this.mapToDto(updated);
    } catch (error: any) {
      console.error("Database update error:", error);
      console.error("Update data:", JSON.stringify(data, null, 2));
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error("Health profile not found");
    }
    await this.db.delete(healthProfiles).where(eq(healthProfiles.id, id));
  }

  async exists(memberId: string): Promise<boolean> {
    const profile = await this.findByMemberId(memberId);
    return profile !== null;
  }

  private mapToDto(profile: any): HealthProfileResponseDto {
    return {
      id: profile.id,
      memberId: profile.memberId,
      height: profile.height,
      weight: profile.weight,
      activityLevel: profile.activityLevel,
      sex: profile.sex,
      conditions: profile.conditions || [],
      allergies: profile.allergies || [],
      dietaryRestrictions: profile.dietaryRestrictions || [],
      organicPreference: profile.organicPreference,
      goals: profile.goals || [],
      targetWeight: profile.targetWeight,
      cookingSkill: profile.cookingSkill,
      cookingFrequency: profile.cookingFrequency,
      preferredCuisines: profile.preferredCuisines || [],
      budgetFlexibility: profile.budgetFlexibility,
      excludedFoods: profile.excludedFoods || [],
      includedFoods: profile.includedFoods || [],
      customExclusions: profile.customExclusions || [],
      customInclusions: profile.customInclusions || [],
      preferenceSets: profile.preferenceSets || [],
      autoLearn: profile.autoLearn ?? true,
      autoSwap: profile.autoSwap ?? true,
      hasDeepFreezer: profile.hasDeepFreezer ?? false,
      shopsDaily: profile.shopsDaily ?? false,
      privacyLevel: profile.privacyLevel,
      healthScore: profile.healthScore ?? 50,
      bmi: profile.bmi,
      dailySodiumLimitMg: profile.dailySodiumLimitMg ?? 2300,
      dailyCarbLimitG: profile.dailyCarbLimitG,
      dailyCalorieTarget: profile.dailyCalorieTarget,
      dailyFiberTargetG: profile.dailyFiberTargetG ?? 25,
      lastHealthAssessment: profile.lastHealthAssessment,
      conditionSpecificMetrics: profile.conditionSpecificMetrics || {},
      wearableConnected: profile.wearableConnected ?? false,
      wearableType: profile.wearableType,
      updatedAt: profile.updatedAt,
    };
  }
}
