// src/modules/account-member/repositories/account-member.repository.ts

import {
  accounts,
  members,
  healthProfiles,
} from "../../../database/schemas/schema.js";
import { sql } from "drizzle-orm";
import { getDb } from "../../../database/db.js";
import { CreateAccountMemberPayload } from "./dto/account-member.dto.js";

export interface IAccountMemberRepository {
  createAccountWithMemberAndHealthProfile(
    payload: CreateAccountMemberPayload,
    primaryAdminId: string,
  ): Promise<{
    accountId: string;
    memberId: string;
    healthProfileId?: string;
  }>;
}

export class AccountMemberRepository implements IAccountMemberRepository {
  private _db: any = null;

  private get db() {
    if (!this._db) {
      this._db = getDb();
    }
    return this._db;
  }

  async createAccountWithMemberAndHealthProfile(
    payload: CreateAccountMemberPayload,
    primaryAdminId: string,
  ) {
    return this.db.transaction(async (tx: any) => {
      // Create Account
      const [account] = await tx
        .insert(accounts)
        .values({
          accountNumber: payload.account.accountNumber,
          accountName: payload.account.accountName,
          accountType: payload.account.accountType,
          description: payload.account.description,
          primaryAdminId,

          addressLine1: payload.account.addressLine1,
          addressLine2: payload.account.addressLine2,
          city: payload.account.city,
          state: payload.account.state,
          country: payload.account.country,
          zipCode: payload.account.zipCode,
          formattedAddress: payload.account.formattedAddress,

          latitude: payload.account.latitude,
          longitude: payload.account.longitude,
          placeId: payload.account.placeId,

          weeklyBudget: payload.account.weeklyBudget,
          dailyBudget: payload.account.dailyBudget,
          monthlyBudget: payload.account.monthlyBudget,
          annualBudget: payload.account.annualBudget,

          groceriesPercentage: payload.account.groceriesPercentage ?? 70,
          diningPercentage: payload.account.diningPercentage ?? 20,
          emergencyPercentage: payload.account.emergencyPercentage ?? 10,
        })
        .returning({ id: accounts.id });

      // Create Member
      const [member] = await tx
        .insert(members)
        .values({
          accountId: account.id,
          userId: payload.member.userId,
          role: payload.member.role ?? "super_admin",
          name: payload.member.name,
          age: payload.member.age,
          sex: payload.member.sex,
        })
        .returning({ id: members.id });

      let healthProfileId: string | undefined;

      // Create Health Profile (if provided)
      if (payload.healthProfile) {
        const [healthProfile] = await tx
          .insert(healthProfiles)
          .values({
            memberId: member.id,

            // Demographics & Physical Info
            height: payload.healthProfile.height,
            weight: payload.healthProfile.weight,
            activityLevel: payload.healthProfile.activityLevel,

            // Medical Conditions & Health Issues
            conditions: payload.healthProfile.conditions ?? [],
            allergies: payload.healthProfile.allergies ?? [],

            // Dietary Restrictions & Preferences
            dietaryRestrictions:
              payload.healthProfile.dietaryRestrictions ?? [],
            organicPreference:
              payload.healthProfile.organicPreference ?? "standard_only",

            // Health & Nutrition Goals
            goals: payload.healthProfile.goals ?? [],
            targetWeight: payload.healthProfile.targetWeight,

            // Food Behavior & Lifestyle
            cookingSkill: payload.healthProfile.cookingSkill,
            cookingFrequency: payload.healthProfile.cookingFrequency,
            preferredCuisines: payload.healthProfile.preferredCuisines ?? [],
            budgetFlexibility: payload.healthProfile.budgetFlexibility,

            // Food Preferences
            excludedFoods: payload.healthProfile.excludedFoods ?? [],
            includedFoods: payload.healthProfile.includedFoods ?? [],
            customExclusions: payload.healthProfile.customExclusions ?? [],
            customInclusions: payload.healthProfile.customInclusions ?? [],
            preferenceSets: payload.healthProfile.preferenceSets ?? [],
            autoLearn: payload.healthProfile.autoLearn ?? true,
            autoSwap: payload.healthProfile.autoSwap ?? true,

            // Storage & Shopping
            hasDeepFreezer: payload.healthProfile.hasDeepFreezer ?? false,
            shopsDaily: payload.healthProfile.shopsDaily ?? false,

            // Health Optimization & Scoring
            privacyLevel: payload.healthProfile.privacyLevel ?? "private",
            healthScore: payload.healthProfile.healthScore ?? 50, // ✅ Now included
            bmi: payload.healthProfile.bmi, // ✅ Now included
            dailyCalorieTarget: payload.healthProfile.dailyCalorieTarget,
            dailySodiumLimitMg:
              payload.healthProfile.dailySodiumLimitMg ?? 2300,
            dailyCarbLimitG: payload.healthProfile.dailyCarbLimitG,
            dailyFiberTargetG: payload.healthProfile.dailyFiberTargetG ?? 25,
            conditionSpecificMetrics:
              payload.healthProfile.conditionSpecificMetrics ?? {},
            wearableConnected: payload.healthProfile.wearableConnected ?? false,
            wearableType: payload.healthProfile.wearableType,
          })
          .returning({ id: healthProfiles.id });

        healthProfileId = healthProfile.id;
      }

      return {
        accountId: account.id,
        memberId: member.id,
        healthProfileId,
      };
    });
  }
}
