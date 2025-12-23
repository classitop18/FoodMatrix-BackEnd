import {
  activityLevelEnum,
  allergyEnum,
  budgetFlexibilityEnum,
  cookingFrequencyEnum,
  cookingSkillEnum,
  dietaryRestrictionEnum,
  healthConditionEnum,
  healthGoalEnum,
  organicPreferenceEnum,
  privacyLevelEnum,
} from "@/database/schemas/enums.js";
import z from "zod";
export const healthProfileSchema = z.object({
  height: z.number().optional(),
  weight: z.number().optional(),

  activityLevel: z.string().optional(),

  conditions: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),

  dietaryRestrictions: z.array(z.string()).optional(),
  organicPreference: z.string().optional(),

  goals: z.array(z.string()).optional(),

  cookingSkill: z.string().optional(),
  cookingFrequency: z.string().optional(),

  preferredCuisines: z.array(z.string()).optional(),

  budgetFlexibility: z.string().optional(),

  hasDeepFreezer: z.boolean().optional(),
  shopsDaily: z.boolean().optional(),

  isPrivate: z.boolean().optional(),
  healthScore: z.number().optional(),
});

export const createHealthProfileSchema = z.object({
  memberId: z.string().uuid(),

  // Demographics & Physical Info
  height: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  activityLevel: z.enum(activityLevelEnum.enumValues).optional(),

  // Medical Conditions & Health Issues
  conditions: z.array(z.enum(healthConditionEnum.enumValues)).optional(),
  allergies: z.array(z.enum(allergyEnum.enumValues)).optional(),

  // Dietary Restrictions & Preferences
  dietaryRestrictions: z
    .array(z.enum(dietaryRestrictionEnum.enumValues))
    .optional(),
  organicPreference: z.enum(organicPreferenceEnum.enumValues).optional(),

  // Health & Nutrition Goals
  goals: z.array(z.enum(healthGoalEnum.enumValues)).optional(),
  targetWeight: z.number().positive().optional(),

  // Food Behavior & Lifestyle
  cookingSkill: z.enum(cookingSkillEnum.enumValues).optional(),
  cookingFrequency: z.enum(cookingFrequencyEnum.enumValues).optional(),
  preferredCuisines: z.array(z.string()).optional(),
  budgetFlexibility: z.enum(budgetFlexibilityEnum.enumValues).optional(),

  // Food Preferences
  excludedFoods: z.array(z.string()).optional(),
  includedFoods: z.array(z.string()).optional(),
  customExclusions: z.array(z.string()).optional(),
  customInclusions: z.array(z.string()).optional(),
  preferenceSets: z.array(z.string()).optional(),
  autoLearn: z.boolean().optional(),
  autoSwap: z.boolean().optional(),

  // Storage & Shopping
  hasDeepFreezer: z.boolean().optional(),
  shopsDaily: z.boolean().optional(),

  // Health Optimization
  privacyLevel: z.enum(privacyLevelEnum.enumValues).optional(),
  dailySodiumLimitMg: z.number().int().positive().optional(),
  dailyCarbLimitG: z.number().int().positive().optional(),
  dailyCalorieTarget: z.number().int().positive().optional(),
  dailyFiberTargetG: z.number().int().positive().optional(),
  conditionSpecificMetrics: z.record(z.any()).optional(),
  wearableConnected: z.boolean().optional(),
  wearableType: z.string().optional(),
});

export type CreateHealthProfileDto = z.infer<typeof createHealthProfileSchema>;

// src/modules/health-profiles/dto/update-health-profile.dto.ts
export const updateHealthProfileSchema = createHealthProfileSchema
  .partial()
  .omit({ memberId: true });
export type UpdateHealthProfileDto = z.infer<typeof updateHealthProfileSchema>;

// src/modules/health-profiles/dto/health-profile-response.dto.ts
export interface HealthProfileResponseDto {
  id: string;
  memberId: string;

  // Demographics & Physical Info
  height?: number;
  weight?: number;
  activityLevel?: string;

  // Medical Conditions & Health Issues
  conditions: string[];
  allergies: string[];

  // Dietary Restrictions & Preferences
  dietaryRestrictions: string[];
  organicPreference: string;

  // Health & Nutrition Goals
  goals: string[];
  targetWeight?: number;

  // Food Behavior & Lifestyle
  cookingSkill?: string;
  cookingFrequency?: string;
  preferredCuisines: string[];
  budgetFlexibility?: string;

  // Food Preferences
  excludedFoods: string[];
  includedFoods: string[];
  customExclusions: string[];
  customInclusions: string[];
  preferenceSets: string[];
  autoLearn: boolean;
  autoSwap: boolean;

  // Storage & Shopping
  hasDeepFreezer: boolean;
  shopsDaily: boolean;

  // Health Optimization
  privacyLevel: string;
  healthScore: number;
  bmi?: string;
  dailySodiumLimitMg: number;
  dailyCarbLimitG?: number;
  dailyCalorieTarget?: number;
  dailyFiberTargetG: number;
  lastHealthAssessment?: Date;
  conditionSpecificMetrics: Record<string, any>;
  wearableConnected: boolean;
  wearableType?: string;
  updatedAt: Date;
}

// src/modules/health-profiles/dto/health-assessment.dto.ts
export const healthAssessmentSchema = z.object({
  weight: z.number().positive(),
  height: z.number().positive(),
  activityLevel: z.enum(activityLevelEnum.enumValues),
  conditions: z.array(z.enum(healthConditionEnum.enumValues)),
  allergies: z.array(z.enum(allergyEnum.enumValues)),
  goals: z.array(z.enum(healthGoalEnum.enumValues)),
});

export type HealthAssessmentDto = z.infer<typeof healthAssessmentSchema>;

// src/modules/health-profiles/dto/query-health-profile.dto.ts
export const queryHealthProfileSchema = z.object({
  memberId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  privacyLevel: z.enum(privacyLevelEnum.enumValues).optional(),
  hasConditions: z.boolean().optional(),
  hasAllergies: z.boolean().optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(10),
});

export type QueryHealthProfileDto = z.infer<typeof queryHealthProfileSchema>;
