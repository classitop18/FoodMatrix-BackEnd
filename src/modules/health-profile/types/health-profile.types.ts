import { CreateHealthProfileDto, HealthAssessmentDto, HealthProfileResponseDto, QueryHealthProfileDto, UpdateHealthProfileDto } from "../dto/health-profile.dto.js";


export interface IHealthProfileRepository {
  create(data: CreateHealthProfileDto): Promise<HealthProfileResponseDto>;
  findById(id: string): Promise<HealthProfileResponseDto | null>;
  findByMemberId(memberId: string): Promise<HealthProfileResponseDto | null>;
  findAll(query: QueryHealthProfileDto): Promise<{
    data: HealthProfileResponseDto[];
    total: number;
    page: number;
    limit: number;
  }>;
  update(id: string, data: UpdateHealthProfileDto): Promise<HealthProfileResponseDto>;
  delete(id: string): Promise<void>;
  exists(memberId: string): Promise<boolean>;
}

export interface IHealthProfileService {
  createHealthProfile(data: CreateHealthProfileDto, userId: string): Promise<HealthProfileResponseDto>;
  getHealthProfile(id: string, userId: string): Promise<HealthProfileResponseDto>;
  getHealthProfileByMember(memberId: string, userId: string): Promise<HealthProfileResponseDto>;
  updateHealthProfile(id: string, data: UpdateHealthProfileDto, userId: string): Promise<HealthProfileResponseDto>;
  deleteHealthProfile(id: string, userId: string): Promise<void>;
  getAllHealthProfiles(query: QueryHealthProfileDto, userId: string): Promise<{
    data: HealthProfileResponseDto[];
    total: number;
    page: number;
    limit: number;
  }>;
  calculateBMI(weight: number, height: number): number;
  calculateHealthScore(profile: HealthProfileResponseDto): number;
  performHealthAssessment(memberId: string, assessment: HealthAssessmentDto, userId: string): Promise<{
    bmi: number;
    healthScore: number;
    recommendations: string[];
    risks: string[];
  }>;
  syncWearableData(memberId: string, userId: string): Promise<void>;
}

// src/modules/health-profiles/interfaces/health-calculator.interface.ts
export interface IHealthCalculator {
  calculateBMI(weight: number, height: number): number;
  calculateBMICategory(bmi: number): "underweight" | "normal" | "overweight" | "obese";
  calculateDailyCalories(weight: number, height: number, age: number, sex: string, activityLevel: string): number;
  calculateHealthScore(profile: HealthProfileResponseDto): number;
  assessHealthRisks(profile: HealthProfileResponseDto): string[];
  generateRecommendations(profile: HealthProfileResponseDto): string[];
}

// src/modules/health-profiles/interfaces/wearable-integration.interface.ts
export interface IWearableIntegration {
  connect(userId: string, wearableType: string, authToken: string): Promise<void>;
  disconnect(userId: string): Promise<void>;
  syncData(userId: string): Promise<{
    weight?: number;
    activityLevel?: string;
    caloriesBurned?: number;
    steps?: number;
    heartRate?: number;
  }>;
  getLastSyncTime(userId: string): Promise<Date | null>;
}