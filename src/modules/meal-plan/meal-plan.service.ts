import { MealPlanRepository } from "./meal-plan.repository.js";
import type {
  CreateMealPlanPayload,
  GetMealPlansQuery,
  UpdateMealPlanPayload,
} from "./dto/meal-plan.dto.js";
import type { MealPlanPaginatedResponse } from "./types/meal-plan.types.js";
import { notificationService } from "../notifications/notifications.service.js";

export class MealPlanService {
  private repository: MealPlanRepository;

  constructor(repository: MealPlanRepository) {
    this.repository = repository;
  }

  async getMealPlans(
    accountId: string,
    params: GetMealPlansQuery,
  ): Promise<MealPlanPaginatedResponse> {
    const { data, total } = await this.repository.getMealPlans(
      accountId,
      params,
    );

    return {
      data,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  }

  async createMealPlan(
    data: CreateMealPlanPayload & {
      accountId: string;
      createdBy: string;
    },
  ) {
    // Ensure mealDate is a Date object
    const mealDate = new Date(data.mealDate);

    const mealPlan = await this.repository.createMealPlan({
      accountId: data.accountId,
      createdBy: data.createdBy,
      mealDate: mealDate,
      mealType: data.mealType,
      servings: data.servings,
      status: data.status,
      // recipeId: data.recipeId, // Commented out as per schema
    });

    // Notify account admins
    await notificationService.sendToAccountAdmins(data.accountId, {
      title: "New Meal Plan Created",
      body: `A new ${data.mealType} meal plan has been scheduled for ${mealDate.toLocaleDateString()}.`,
      type: "MEAL_PLAN_CREATED",
      data: {
        mealPlanId: mealPlan.id,
        mealType: data.mealType,
        mealDate: mealDate.toISOString(),
      },
    });

    return mealPlan;
  }

  async updateMealPlan(id: string, updates: UpdateMealPlanPayload) {
    const payload: any = { ...updates };

    if (updates.mealDate) {
      payload.mealDate = new Date(updates.mealDate);
    }

    return await this.repository.updateMealPlan(id, payload);
  }

  async deleteMealPlan(id: string) {
    return await this.repository.deleteMealPlan(id);
  }
}
