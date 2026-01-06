import { IHealthCalculator } from "@/modules/health-profile/types/health-profile.types.js";
import { CreateAccountMemberPayload } from "./dto/account-member.dto.js";
import { IAccountMemberRepository } from "./account-member.respository.js";

export interface IAccountMemberService {
  createAccount(
    payload: CreateAccountMemberPayload,
    primaryAdminId: string,
  ): Promise<{
    accountId: string;
    memberId: string;
    healthProfileId?: string;
  }>;
}

export class AccountMemberService implements IAccountMemberService {
  constructor(
    private readonly accountMemberRepo: IAccountMemberRepository,
    private readonly healthCalculator: IHealthCalculator,
  ) {}

  async createAccount(
    payload: CreateAccountMemberPayload,
    primaryAdminId: string,
  ) {
    // If health profile data is provided, calculate BMI and health score
    if (payload.healthProfile) {
      const { height, weight } = payload.healthProfile;

      // Calculate BMI if both height and weight are provided
      if (height && weight) {
        const bmi = this.healthCalculator.calculateBMI(weight, height);
        payload.healthProfile.bmi = bmi.toFixed(1);
      }

      // Calculate initial health score based on the profile data
      // We'll use a simplified version since we don't have the full profile yet
      const healthScore = this.calculateInitialHealthScore(
        payload.healthProfile,
      );
      payload.healthProfile.healthScore = healthScore;
    }

    return this.accountMemberRepo.createAccountWithMemberAndHealthProfile(
      payload,
      primaryAdminId,
    );
  }

  /**
   * Calculate an initial health score during account creation
   * This is a simplified version since we don't have the complete HealthProfileResponseDto yet
   */
   
  private calculateInitialHealthScore(healthProfile: any): number {
    let score = 50; // Base score

    // BMI Assessment (±20 points)
    if (healthProfile.bmi) {
      const bmi = parseFloat(healthProfile.bmi);
      if (bmi >= 18.5 && bmi < 25) {
        score += 20; // Normal
      } else if (bmi >= 25 && bmi < 30) {
        score += 5; // Overweight
      } else if (bmi < 18.5) {
        score -= 5; // Underweight
      } else {
        score -= 15; // Obese
      }
    }

    // Activity Level (±15 points)
    if (healthProfile.activityLevel) {
      const activityScores: Record<string, number> = {
        sedentary: -10,
        light: 0,
        moderate: 10,
        active: 15,
        very_active: 15,
      };
      score += activityScores[healthProfile.activityLevel] || 0;
    }

    // Health Conditions (±20 points)
    const conditionCount = healthProfile.conditions?.length || 0;
    if (conditionCount === 0) {
      score += 20;
    } else if (conditionCount === 1) {
      score += 5;
    } else if (conditionCount === 2) {
      score -= 5;
    } else {
      score -= 15;
    }

    // Dietary Restrictions managed properly (+10 points)
    if (healthProfile.dietaryRestrictions?.length > 0) {
      score += 10;
    }

    // Health Goals set (+5 points)
    if (healthProfile.goals?.length > 0) {
      score += 5;
    }

    // Cooking habits (+10 points)
    if (
      healthProfile.cookingFrequency === "daily" ||
      healthProfile.cookingFrequency === "multiple_times_daily"
    ) {
      score += 10;
    } else if (healthProfile.cookingFrequency === "weekly") {
      score += 5;
    }

    // Organic preference (+5 points)
    if (
      healthProfile.organicPreference === "organic_only" ||
      healthProfile.organicPreference === "organic_preferred"
    ) {
      score += 5;
    }

    // Cap score between 0-100
    return Math.max(0, Math.min(100, score));
  }
}
