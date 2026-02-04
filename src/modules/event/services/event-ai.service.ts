import {
  AIProvider,
  MemberHealthProfile,
  AIGeneratedRecipe,
} from "../../ai/interfaces/ai.interfaces.js";
import { EventRecipePromptBuilder } from "../builder/event-recipe-prompt.builder.js";
import {
  RecipeParser,
  RecipeStorage,
} from "../../ai/interfaces/ai.interfaces.js";
import { IEventRepository, EventRepository } from "../event.repository.js";
import {
  IMemberRepository,
  MemberRepository,
} from "../../member/member.repository.js";
import { AppError } from "../../../utils/app-error.utils.js";
import { MealType } from "../types/event.types.js";
import { AnthropicProvider } from "../../ai/providers/anthropic.provider.js";
import { OpenAIProvider } from "../../ai/providers/openai.provider.js";
import { JSONRecipeParser } from "../../ai/parser/json-recipe.parser.js";
import { RecipeStorage as RecipeStorageImpl } from "../../recipe/recipe.repository.js";

/**
 * Budget suggestion request interface
 */
export interface BudgetSuggestionRequest {
  eventId: string;
  accountId: string;
  requesterId: string;
}

/**
 * Budget allocation per meal type
 */
export interface MealBudgetAllocation {
  mealType: MealType;
  suggestedBudget: number;
  percentage: number;
  reasoning: string;
}

/**
 * Budget suggestion response
 */
export interface BudgetSuggestionResponse {
  eventId: string;
  eventName: string;
  totalBudget: number;
  currency: string;
  mealTypes: MealType[];
  allocations: MealBudgetAllocation[];
  aiRecommendations: string[];
  totalAllocated: number;
}

/**
 * Event recipe generation request
 */
export interface EventRecipeGenerationRequest {
  eventId: string;
  accountId: string;
  requesterId: string;
  mealType: MealType;
  recipeCount?: number;
  budget?: number; // Budget for this specific meal type
  preferredCuisines?: string[];
  customSearch?: string;
  considerHealthProfiles?: boolean;
  targetMemberIds?: string[];
}

/**
 * Event AI Service
 * Handles AI-powered budget suggestions and event recipe generation
 */
export class EventAIService {
  private eventRepo: IEventRepository;
  private memberRepo: IMemberRepository;
  private promptBuilder: EventRecipePromptBuilder;
  private aiProvider: AIProvider;
  private recipeParser: RecipeParser;
  private recipeStorage: RecipeStorage;

  constructor(
    eventRepo: IEventRepository = new EventRepository(),
    memberRepo: IMemberRepository = new MemberRepository(),
  ) {
    this.eventRepo = eventRepo;
    this.memberRepo = memberRepo;
    this.promptBuilder = new EventRecipePromptBuilder();

    // Initialize AI provider based on environment
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (anthropicKey) {
      this.aiProvider = new AnthropicProvider(anthropicKey);
    } else if (openaiKey) {
      this.aiProvider = new OpenAIProvider(openaiKey);
    } else {
      throw new Error(
        "No AI API key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable.",
      );
    }

    // Initialize recipe parser
    this.recipeParser = new JSONRecipeParser();

    // Initialize recipe storage
    this.recipeStorage = new RecipeStorageImpl();
  }

  /**
   * Get AI-suggested budget allocation for event meals
   */
  async suggestBudgetAllocation(
    request: BudgetSuggestionRequest,
  ): Promise<BudgetSuggestionResponse> {
    const { eventId } = request;

    // Fetch event with all relations
    const event = await this.eventRepo.findById(eventId, true);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    // Get meal types from event
    const mealTypes = (event as any).selectedMealTypes || [];
    if (mealTypes.length === 0) {
      throw new AppError("No meal types selected for this event", 400);
    }

    // Get total budget
    const budget = (event as any).budget;
    const totalBudget = budget?.totalBudget
      ? parseFloat(budget.totalBudget)
      : (event as any).budgetAmount
        ? parseFloat((event as any).budgetAmount)
        : 0;

    if (totalBudget <= 0) {
      throw new AppError("No budget set for this event", 400);
    }

    const currency = budget?.currency || "INR";

    // Get participant count for context
    const participants = (event as any).participants || [];
    const participantCount = participants.length;
    const adultGuests = (event as any).adultGuests || 0;
    const kidGuests = (event as any).kidGuests || 0;
    const totalServings = participantCount + adultGuests + kidGuests * 0.5;

    // Get health profiles if available
    const healthProfilesData = await this.fetchHealthProfiles(
      participants.map((p: any) => p.memberId),
    );

    // Build AI prompt for budget allocation
    const prompt = this.buildBudgetAllocationPrompt({
      eventName: event.name,
      occasionType: (event as any).occasionType,
      mealTypes,
      totalBudget,
      currency,
      totalServings,
      participantCount,
      adultGuests,
      kidGuests,
      healthProfiles: healthProfilesData,
    });

    // Call AI for budget suggestions
    const aiResponse = await this.aiProvider.createCompletion({
      prompt,
      systemPrompt: BUDGET_ALLOCATION_SYSTEM_PROMPT,
      maxTokens: 2000,
      temperature: 0.7,
    });

    // Parse AI response
    const allocations = this.parseBudgetAllocationResponse(
      aiResponse.content,
      mealTypes,
      totalBudget,
    );

    return {
      eventId,
      eventName: event.name,
      totalBudget,
      currency,
      mealTypes,
      allocations: allocations.allocations,
      aiRecommendations: allocations.recommendations,
      totalAllocated: allocations.allocations.reduce(
        (sum, a) => sum + a.suggestedBudget,
        0,
      ),
    };
  }

  /**
   * Generate recipes for an event meal
   */
  async generateEventRecipes(
    request: EventRecipeGenerationRequest,
  ): Promise<AIGeneratedRecipe[]> {
    const {
      eventId,
      accountId,

      mealType,
      recipeCount = 3,
      budget,
      preferredCuisines = [],
      customSearch,
      considerHealthProfiles = true,
      targetMemberIds,
    } = request;

    // Fetch event with all relations
    const event = await this.eventRepo.findById(eventId, true);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    // Get participants and their health profiles
    const participants = (event as any).participants || [];
    const memberIds =
      targetMemberIds && targetMemberIds.length > 0
        ? targetMemberIds
        : participants.map((p: any) => p.memberId);

    let healthProfiles: MemberHealthProfile[] = [];
    if (considerHealthProfiles && memberIds.length > 0) {
      healthProfiles = await this.fetchHealthProfiles(memberIds);
    }

    // Calculate servings
    const adultGuests = (event as any).adultGuests || 0;
    const kidGuests = (event as any).kidGuests || 0;
    const memberCount = participants.length;
    const totalServings = Math.ceil(
      memberCount + adultGuests + kidGuests * 0.5,
    );

    // Get recent event meals to avoid duplicates
    const recentEventMeals = await this.getRecentEventMeals(accountId, eventId);

    // Build the prompt using Event Recipe Prompt Builder
    const prompt = await this.promptBuilder.buildEventRecipePrompt({
      eventId,
      eventName: event.name,
      occasionType: (event as any).occasionType,
      eventDate: event.eventDate,
      mealType,
      recipeCount,
      servings: totalServings,
      budget: budget || 0,
      maxBudgetPerServing: budget ? budget / totalServings : undefined,
      preferredCuisines,
      customSearch,
      healthProfiles,
      participantCount: memberCount,
      adultGuests,
      kidGuests,
      recentEventMealNames: recentEventMeals,
      accountId,
    });

    // Call AI for recipe generation
    const aiResponse = await this.aiProvider.createCompletion({
      prompt,
      systemPrompt: EVENT_RECIPE_SYSTEM_PROMPT,
      maxTokens: this.calculateMaxTokens(recipeCount),
      temperature: 0.7,
    });

    // Parse recipes from AI response
    const parsedRecipes = this.parseRecipeResponse(
      aiResponse.content,
      mealType,
      recipeCount,
    );

    // Post-process and store recipes
    const storedRecipes = await this.recipeStorage.storeAIGeneratedRecipes(
      parsedRecipes,
      {
        accountId,
        mealType,
        memberCount,
        recipeCount,
        servings: totalServings,
        usePantryItems: false,
        healthProfiles,
        preferredCuisines,
      },
    );

    return storedRecipes;
  }

  /**
   * Fetch health profiles for given member IDs
   */
  private async fetchHealthProfiles(
    memberIds: string[],
  ): Promise<MemberHealthProfile[]> {
    if (memberIds.length === 0) return [];

    try {
      const profiles =
        await this.memberRepo.findHealthProfilesByMemberIds(memberIds);
      return profiles.map((profile: any) => ({
        id: profile.memberId,
        name: profile.member?.name || "Member",
        dietaryRestrictions: profile.dietaryRestrictions || [],
        allergies: profile.allergies || [],
        healthConditions: profile.conditions || [],
        healthGoals: profile.goals || [],
      }));
    } catch (error) {
      console.error("Error fetching health profiles:", error);
      return [];
    }
  }

  /**
   * Get recent event meals to avoid duplicates
   */
  private async getRecentEventMeals(
    accountId: string,
    currentEventId: string,
  ): Promise<string[]> {
    try {
      // Get recent events (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentEvents = await this.eventRepo.findAll({
        accountId,
        page: 1,
        limit: 10,
        sortBy: "eventDate",
        sortOrder: "desc",
        fromDate: thirtyDaysAgo.toISOString(),
      });

      const recipeNames: string[] = [];

      for (const event of recentEvents.data) {
        if (event.id === currentEventId) continue;

        const meals = event.meals || [];
        for (const meal of meals) {
          const recipes = (meal as any).recipes || [];
          for (const recipe of recipes) {
            if (recipe.recipe?.name) {
              recipeNames.push(recipe.recipe.name);
            }
          }
        }
      }

      return [...new Set(recipeNames)]; // Return unique names
    } catch (error) {
      console.error("Error fetching recent event meals:", error);
      return [];
    }
  }

  /**
   * Build prompt for budget allocation
   */
  private buildBudgetAllocationPrompt(data: {
    eventName: string;
    occasionType: string;
    mealTypes: MealType[];
    totalBudget: number;
    currency: string;
    totalServings: number;
    participantCount: number;
    adultGuests: number;
    kidGuests: number;
    healthProfiles: MemberHealthProfile[];
  }): string {
    const hasHealthRestrictions = data.healthProfiles.some(
      (p) => p.allergies.length > 0 || p.dietaryRestrictions.length > 0,
    );

    return `
Analyze this event and suggest an optimal budget allocation for each meal type:

**EVENT DETAILS:**
- Event Name: ${data.eventName}
- Occasion: ${data.occasionType}
- Total Budget: ${data.currency} ${data.totalBudget}
- Total Servings: ${data.totalServings}
- Family Members: ${data.participantCount}
- Adult Guests: ${data.adultGuests}
- Kid Guests: ${data.kidGuests}

**MEAL TYPES TO ALLOCATE:**
${data.mealTypes.map((mt) => `- ${mt}`).join("\n")}

**HEALTH CONSIDERATIONS:**
${
  hasHealthRestrictions
    ? data.healthProfiles
        .map(
          (p) => `
- ${p.name}: Allergies: ${p.allergies.join(", ") || "None"}, Restrictions: ${p.dietaryRestrictions.join(", ") || "None"}
`,
        )
        .join("")
    : "No special health restrictions"
}

**ALLOCATION RULES:**
1. Dinner typically gets highest allocation (35-45%)
2. Lunch gets second highest (25-35%)
3. Breakfast gets moderate allocation (15-25%)
4. Snacks, desserts, beverages get remaining
5. Consider health restrictions may increase costs
6. Ensure total allocation equals 100%

**OUTPUT FORMAT (JSON only):**
\`\`\`json
{
    "allocations": [
        {
            "mealType": "dinner",
            "percentage": 40,
            "reasoning": "Main event meal, requires premium ingredients"
        }
    ],
    "recommendations": [
        "Consider batch cooking for efficiency",
        "Seasonal ingredients will reduce costs"
    ]
}
\`\`\`
`;
  }

  /**
   * Parse budget allocation response from AI
   */
  private parseBudgetAllocationResponse(
    response: string,
    mealTypes: MealType[],
    totalBudget: number,
  ): { allocations: MealBudgetAllocation[]; recommendations: string[] } {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : response;
      const parsed = JSON.parse(jsonStr);

      const allocations: MealBudgetAllocation[] = (
        parsed.allocations || []
      ).map((a: any) => ({
        mealType: a.mealType as MealType,
        percentage: a.percentage,
        suggestedBudget: Math.round((a.percentage / 100) * totalBudget),
        reasoning: a.reasoning || "",
      }));

      // Ensure all meal types are covered
      const missing = mealTypes.filter(
        (mt) => !allocations.find((a) => a.mealType === mt),
      );

      if (missing.length > 0) {
        const remainingPercentage =
          100 - allocations.reduce((sum, a) => sum + a.percentage, 0);
        const perMissing = remainingPercentage / missing.length;

        missing.forEach((mt) => {
          allocations.push({
            mealType: mt,
            percentage: perMissing,
            suggestedBudget: Math.round((perMissing / 100) * totalBudget),
            reasoning: "Default allocation",
          });
        });
      }

      return {
        allocations,
        recommendations: parsed.recommendations || [],
      };
    } catch (error) {
      console.error("Error parsing budget allocation:", error);
      // Fallback to equal distribution
      const perMeal = Math.round(100 / mealTypes.length);
      return {
        allocations: mealTypes.map((mt) => ({
          mealType: mt,
          percentage: perMeal,
          suggestedBudget: Math.round((perMeal / 100) * totalBudget),
          reasoning: "Equal distribution (AI parsing failed)",
        })),
        recommendations: [
          "Consider your event priorities when adjusting allocations",
        ],
      };
    }
  }

  /**
   * Parse recipe response from AI
   */
  private parseRecipeResponse(
    response: string,
    mealType: string,
  ): AIGeneratedRecipe[] {
    try {
      // Remove markdown code blocks if present
      let cleanResponse = response;
      if (cleanResponse.includes("```json")) {
        cleanResponse = cleanResponse
          .replace(/```json\s*/g, "")
          .replace(/```\s*/g, "");
      }
      if (cleanResponse.includes("```")) {
        cleanResponse = cleanResponse.replace(/```\s*/g, "");
      }

      // Find JSON array
      const jsonStart = cleanResponse.indexOf("[");
      const jsonEnd = cleanResponse.lastIndexOf("]") + 1;
      if (jsonStart === -1 || jsonEnd === 0) {
        throw new Error("No JSON array found in response");
      }

      const jsonStr = cleanResponse.substring(jsonStart, jsonEnd);
      const recipes = JSON.parse(jsonStr);

      if (!Array.isArray(recipes)) {
        throw new Error("Response is not an array");
      }

      return recipes.map((recipe: any) => ({
        ...recipe,
        mealType: recipe.mealType || mealType,
        isValid: recipe.isValid !== false,
      }));
    } catch (error) {
      console.error("Error parsing recipe response:", error);
      return [];
    }
  }

  /**
   * Calculate max tokens based on recipe count
   */
  private calculateMaxTokens(recipeCount: number): number {
    const baseTokens = 2000;
    const tokensPerRecipe = 1500;
    return Math.min(baseTokens + recipeCount * tokensPerRecipe, 8000);
  }
}

/**
 * System prompt for budget allocation
 */
const BUDGET_ALLOCATION_SYSTEM_PROMPT = `You are an expert event planner and budget analyst specializing in meal planning for family events.

Your expertise includes:
- Understanding meal importance hierarchy (dinner > lunch > breakfast > snacks)
- Accounting for dietary restrictions and their cost implications
- Optimizing budget allocation for maximum satisfaction
- Considering cultural and occasion-specific requirements

Rules:
1. Always return valid JSON
2. Percentages must sum to 100
3. Consider health restrictions increase ingredient costs
4. Provide practical, actionable recommendations
5. Never exceed the total budget`;

/**
 * System prompt for event recipe generation
 */
const EVENT_RECIPE_SYSTEM_PROMPT = `You are an elite AI chef specializing in event meal planning with expertise in:

- Large-scale cooking and portion management
- Budget optimization for events
- Dietary accommodation for multiple people
- Cultural and occasion-appropriate menu selection
- Balancing variety with practical execution

Core Principles:
1. Safety First: Zero tolerance for allergens
2. Budget Conscious: Stay within allocated budget
3. Practicality: Recipes must be feasible for home cooks
4. Variety: Avoid duplicate recipes from recent events
5. Occasion Appropriate: Match the event's tone and style

Critical Output Rules:
- ALWAYS return valid JSON array
- NEVER omit nutrition data
- ALWAYS respect dietary restrictions
- ALWAYS provide accurate cost estimates
- NEVER suggest recipes from the "avoid" list`;
