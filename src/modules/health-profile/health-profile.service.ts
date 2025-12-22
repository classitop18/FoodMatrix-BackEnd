import { members } from "@/database/schemas/schema.js";
import {
  CreateHealthProfileDto,
  HealthAssessmentDto,
  HealthProfileResponseDto,
  QueryHealthProfileDto,
  UpdateHealthProfileDto,
} from "./dto/health-profile.dto.js";
import {
  IHealthCalculator,
  IHealthProfileRepository,
  IHealthProfileService,
} from "./types/health-profile.types.js";

export class HealthProfileService {
  constructor(
    private readonly repository: IHealthProfileRepository,
    private readonly healthCalculator: IHealthCalculator,
  ) {}

  async createHealthProfile(
    data: CreateHealthProfileDto,
  ): Promise<HealthProfileResponseDto> {
    // Calculate BMI if height and weight provided
    let calculatedData = { ...data };
    if (data.height && data.weight) {
      const bmi = this.healthCalculator.calculateBMI(data.weight, data.height);
      calculatedData = {
        ...calculatedData,
        bmi: bmi.toFixed(1),
      } as any;
    }

    const profile = await this.repository.create(calculatedData);

    // Calculate initial health score
    const healthScore = this.healthCalculator.calculateHealthScore(profile);
    return this.repository.update(profile.id, { healthScore } as any);
  }

  async getHealthProfile(
    id: string,
    userId: string,
  ): Promise<HealthProfileResponseDto | null> {
    const profile = await this.repository.findByMemberId(id);
    if (!profile) {
      return null;
    }
    return profile;
  }

  // async getHealthProfileByMember(
  //     memberId: string,
  //     userId: string
  // ): Promise<HealthProfileResponseDto> {
  //     await this.verifyMemberAccess(memberId, userId);

  //     const profile = await this.repository.findByMemberId(memberId);
  //     if (!profile) { }

  //     return profile;
  // }

  // async updateHealthProfile(
  //     id: string,
  //     data: UpdateHealthProfileDto,
  //     userId: string
  // ): Promise<HealthProfileResponseDto> {
  //     const existing = await this.repository.findById(id);
  //     if (!existing) {

  //     }

  //     await this.verifyMemberAccess(existing.memberId, userId);

  //     // Recalculate BMI if height or weight changed
  //     let updateData = { ...data };
  //     const newWeight = data.weight ?? existing.weight;
  //     const newHeight = data.height ?? existing.height;

  //     if (newWeight && newHeight && (data.weight || data.height)) {
  //         const bmi = this.healthCalculator.calculateBMI(newWeight, newHeight);
  //         updateData = {
  //             ...updateData,
  //             bmi: bmi.toFixed(1),
  //         } as any;
  //     }

  //     const updated = await this.repository.update(id, updateData);

  //     // Recalculate health score
  //     const healthScore = this.healthCalculator.calculateHealthScore(updated);
  //     return this.repository.update(id, { healthScore });
  // }

  // async deleteHealthProfile(id: string, userId: string): Promise<void> {
  //     const profile = await this.repository.findById(id);
  //     if (!profile) {

  //     }

  //     await this.verifyMemberAccess(profile.memberId, userId);
  //     await this.repository.delete(id);
  // }

  // async getAllHealthProfiles(
  //     query: QueryHealthProfileDto,
  //     userId: string
  // ): Promise<{
  //     data: HealthProfileResponseDto[];
  //     total: number;
  //     page: number;
  //     limit: number;
  // }> {
  //     // If accountId is provided, verify user has access to that account
  //     if (query.accountId) {
  //         await this.verifyAccountAccess(query.accountId, userId);
  //     }

  //     // Filter profiles by user's accessible accounts
  //     const accessibleAccounts = await this.getUserAccessibleAccounts(userId);

  //     // Get all profiles and filter by accessible accounts
  //     const result = await this.repository.findAll(query);

  //     // Filter profiles where member belongs to accessible accounts
  //     const filteredData = await this.filterByAccessibleMembers(
  //         result.data,
  //         accessibleAccounts
  //     );

  //     return {
  //         ...result,
  //         data: filteredData,
  //         total: filteredData.length,
  //     };
  // }

  // calculateBMI(weight: number, height: number): number {
  //     return this.healthCalculator.calculateBMI(weight, height);
  // }

  // calculateHealthScore(profile: HealthProfileResponseDto): number {
  //     return this.healthCalculator.calculateHealthScore(profile);
  // }

  // async performHealthAssessment(
  //     memberId: string,
  //     assessment: HealthAssessmentDto,
  //     userId: string
  // ): Promise<{
  //     bmi: number;
  //     healthScore: number;
  //     recommendations: string[];
  //     risks: string[];
  // }> {
  //     // await this.verifyMemberAccess(memberId, userId);

  //     const profile = await this.repository.findByMemberId(memberId);
  //     if (!profile) {

  //     }

  //     // Calculate BMI
  //     const bmi = this.healthCalculator.calculateBMI(
  //         assessment.weight,
  //         assessment.height
  //     );

  //     // Update profile with assessment data
  //     const updatedProfile = await this.repository.update(profile.id, {
  //         weight: assessment.weight,
  //         height: assessment.height,
  //         activityLevel: assessment.activityLevel,
  //         conditions: assessment.conditions,
  //         allergies: assessment.allergies,
  //         goals: assessment.goals,
  //         bmi: bmi.toFixed(1),
  //         lastHealthAssessment: new Date(),
  //     } as any);

  //     // Calculate health score
  //     const healthScore = this.healthCalculator.calculateHealthScore(updatedProfile);
  //     await this.repository.update(profile.id, { healthScore });

  //     // Generate recommendations and assess risks
  //     const recommendations = this.healthCalculator.generateRecommendations(updatedProfile);
  //     const risks = this.healthCalculator.assessHealthRisks(updatedProfile);

  //     return {
  //         bmi,
  //         healthScore,
  //         recommendations,
  //         risks,
  //     };
  // }

  // async syncWearableData(memberId: string, userId: string): Promise<void> {
  //     // await this.verifyMemberAccess(memberId, userId);

  //     const profile = await this.repository.findByMemberId(memberId);
  //     if (!profile) {

  //     }

  //     if (!profile.wearableConnected) {

  //     }

  //     // TODO: Implement actual wearable sync logic
  //     // This would integrate with services like Fitbit, Apple Health, etc.
  //     throw new Error("Wearable sync not yet implemented");
  // }

  //   // Private helper methods
  //   private async verifyMemberAccess(memberId: string, userId: string): Promise<void> {
  //     const member = await db.query.members.findFirst({
  //       where: eq(members.id, memberId),
  //       with: {
  //         account: true,
  //       },
  //     });

  //     if (!member) {

  //     }

  //     // Check if user is part of the member's account
  //     const userMembership = await db.query.members.findFirst({
  //       where: and(
  //         eq(members.accountId, member.accountId),
  //         eq(members.userId, userId)
  //       ),
  //     });

  //     if (!userMembership) {
  //       throw new ForbiddenError("You don't have access to this member's data");
  //     }
  //   }

  //   private async verifyAccountAccess(accountId: string, userId: string): Promise<void> {
  //     const membership = await db.query.members.findFirst({
  //       where: and(
  //         eq(members.accountId, accountId),
  //         eq(members.userId, userId)
  //       ),
  //     });

  //     if (!membership) {
  //       throw new ForbiddenError("You don't have access to this account");
  //     }
  //   }

  //   private async getUserAccessibleAccounts(userId: string): Promise<string[]> {
  //     const memberships = await db.query.members.findMany({
  //       where: eq(members.userId, userId),
  //     });

  //     return memberships.map((m) => m.accountId);
  //   }

  // private async filterByAccessibleMembers(
  //     profiles: HealthProfileResponseDto[],
  //     accessibleAccounts: string[]
  // ): Promise<HealthProfileResponseDto[]> {
  //     const memberIds = profiles.map((p) => p.memberId);

  //     const accessibleMembers = await db.query.members.findMany({
  //         where: (members, { inArray }) => inArray(members.id, memberIds),
  //     });

  //     const accessibleMemberIds = accessibleMembers
  //         .filter((m) => accessibleAccounts.includes(m.accountId))
  //         .map((m) => m.id);

  //     return profiles.filter((p) => accessibleMemberIds.includes(p.memberId));
  // }
}
