import {
  accountTypeEnum,
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
  rolesEnum,
  sexEnum,
} from "@/database/schemas/enums.js";
import z from "zod";

// Account Schema
const accountSchema = z.object({
  accountNumber: z.string().length(8),
  accountName: z.string().min(1).optional(),
  accountType: z.enum(accountTypeEnum.enumValues).optional(),
  description: z.string().optional(),

  // Address
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  zipCode: z.string().max(20).optional(),
  formattedAddress: z.string().optional(),

  // Coordinates
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  placeId: z.string().optional(),

  primaryAdminId: z.string().optional(),

  // Budget
  currentAllocation: z.enum(["daily", "weekly", "monthly", "annual"]).optional(),
  weeklyBudget: z.string().or(z.number()),
  dailyBudget: z.string().or(z.number()).optional(),
  monthlyBudget: z.string().or(z.number()).optional(),
  annualBudget: z.string().or(z.number()).optional(),

  groceriesPercentage: z.number().int().min(0).max(100).optional(),
  diningPercentage: z.number().int().min(0).max(100).optional(),
  emergencyPercentage: z.number().int().min(0).max(100).optional(),
});

// Member Schema
const memberSchema = z.object({
  userId: z.string().optional(),
  role: z.enum(rolesEnum.enumValues).optional(),
  name: z.string().optional(),
  age: z.number().int().positive().optional(),
  sex: z.enum(sexEnum.enumValues).optional(),
});

// Health Profile Schema (Extended with BMI and Health Score)
const healthProfileSchema = z.object({
  // Demographics & Physical Info
  height: z.number().int().positive().optional(),
  weight: z.number().int().positive().optional(),
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
  targetWeight: z.number().int().positive().optional(),

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

  // Health Optimization & Scoring
  privacyLevel: z.enum(privacyLevelEnum.enumValues).optional(),
  healthScore: z.number().int().min(0).max(100).optional(), // ✅ Added
  bmi: z.string().optional(), // ✅ Added (stored as string for precision)
  dailyCalorieTarget: z.number().int().positive().optional(),
  dailySodiumLimitMg: z.number().int().positive().optional(),
  dailyCarbLimitG: z.number().int().positive().optional(),
  dailyFiberTargetG: z.number().int().positive().optional(),
  conditionSpecificMetrics: z.record(z.any()).optional(),
  wearableConnected: z.boolean().optional(),
  wearableType: z.string().optional(),
});

// Complete Payload Schema
export const createAccountMemberSchema = z.object({
  account: accountSchema,
  member: memberSchema,
  healthProfile: healthProfileSchema.optional(),
});

export type CreateAccountMemberPayload = z.infer<
  typeof createAccountMemberSchema
>;

// Response DTO
export interface CreateAccountMemberResponse {
  accountId: string;
  memberId: string;
  healthProfileId?: string;
  calculatedBMI?: string;
  healthScore?: number;
}
