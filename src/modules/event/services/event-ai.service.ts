import {
  AIProvider,
  MemberHealthProfile,
  AIGeneratedRecipe,
} from "../../ai/interfaces/ai.interfaces.js";
import {
  EventRecipePromptBuilder,
  EVENT_RECIPE_SYSTEM_PROMPT,
} from "../../ai/builder/event-recipe-prompt.builder.js";
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
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import axios from "axios";
import { randomUUID } from "crypto";

/**
 * Budget suggestion request interface
 */
export interface BudgetSuggestionRequest {
  eventId: string;
  accountId: string;
  requesterId: string;
  mealTypes?: MealType[];
  activeCategories?: Record<MealType, string[]>; // Optional: Only allocate to these categories
}

/**
 * Budget allocation per meal type
 */
export interface MealBudgetAllocation {
  mealType: MealType;
  suggestedBudget: number;
  percentage: number;
  reasoning: string;
  categoryBreakdown?: Record<string, number>; // Category name -> Percentage (0-100 of meal budget)
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
  allocations: MealBudgetAllocation[]; // Now includes category breakdown
  aiRecommendations: string[];
  totalAllocated: number;
}

/**
 * Event recipe generation request
 */
export interface EventRecipeGenerationRequest {
  eventId: string;
  accountId: string;
  requesterId?: string;
  mealType: MealType;
  courseType?: string; // "starter" | "main_course" | "side_dish" | "appetizer" | "salad" | "soup"
  recipeCount?: number;
  budget?: number; // Budget for this specific meal type
  preferredCuisines?: string[];
  customSearch?: string;
  considerHealthProfiles?: boolean;
  targetMemberIds?: string[];
  excludedCategories?: string[]; // e.g. ["starter", "dessert"]
  existingRecipeNames?: string[]; // e.g. ["Butter Chicken", "Naan"]
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
   * Download and save AI-generated image locally
   */
  private async downloadAndSaveImage(url: string): Promise<string> {
    try {
      const uploadsDir = path.join(
        process.cwd(),
        "public",
        "uploads",
        "recipes",
      );
      if (!fs.existsSync(uploadsDir)) {
        await fsPromises.mkdir(uploadsDir, { recursive: true });
      }

      const extension = "png"; // DALL-E usually returns PNG
      const filename = `${randomUUID()}.${extension}`;
      const filepath = path.join(uploadsDir, filename);

      const response = await axios({
        url,
        method: "GET",
        responseType: "arraybuffer",
      });

      await fsPromises.writeFile(filepath, response.data);

      return `/uploads/recipes/${filename}`;
    } catch (error) {
      console.error("Failed to download image:", error);
      return url; // Fallback to original URL
    }
  }

  /**
   * Generate AI image for a recipe
   */
  private async generateRecipeImage(
    recipe: AIGeneratedRecipe,
  ): Promise<string> {
    try {
      // Only generate images with OpenAI provider
      if (this.aiProvider.getProviderName() === "OpenAI") {
        console.log(`🎨 Generating AI Image for Event Recipe: ${recipe.name}`);
        const imagePrompt = `Professional food photography of ${recipe.name}, ${recipe.description?.substring(0, 100) || "delicious dish"}, high resolution, 4k, appetizing, studio lighting, top down view`;

        const generatedUrl = await this.aiProvider.generateImage({
          prompt: imagePrompt,
          size: "1024x1024",
          quality: "standard",
        });

        if (generatedUrl && generatedUrl.length > 0) {
          // Download and save locally
          const localUrl = await this.downloadAndSaveImage(generatedUrl);
          console.log(`✅ Image saved locally: ${localUrl}`);
          return localUrl;
        } else {
          console.warn(
            `⚠️ DALL-E returned empty URL for ${recipe.name}, using fallback`,
          );
          return `https://placehold.co/1024x1024/3d326d/FFF?text=${encodeURIComponent(recipe.name)}`;
        }
      } else {
        // Fallback for non-OpenAI providers
        return `https://placehold.co/1024x1024/7dab4f/FFF?text=${encodeURIComponent(recipe.name)}`;
      }
    } catch (imageError) {
      console.error(
        `⚠️ Failed to generate AI image for ${recipe.name}, falling back to placeholder`,
        imageError,
      );
      return `https://placehold.co/1024x1024/e0e0e0/333?text=${encodeURIComponent(recipe.name)}`;
    }
  }

  /**
   * Get AI-suggested budget allocation for event meals
   */
  async suggestBudgetAllocation(
    request: BudgetSuggestionRequest,
  ): Promise<BudgetSuggestionResponse> {
    const { eventId, mealTypes: requestedMealTypes } = request;

    // Fetch event with all relations
    const event = await this.eventRepo.findById(eventId, true);
    if (!event) {
      throw new AppError("Event not found", 404);
    }

    // Get meal types from request OR event
    const rawMealTypes =
      requestedMealTypes || (event as any).selectedMealTypes || [];

    // Filter to only include Breakfast, Lunch, and Dinner (User Request)
    const validTypes = ["breakfast", "lunch", "dinner"];
    const mealTypes = rawMealTypes.filter((mt: any) =>
      validTypes.includes(mt.toLowerCase()),
    );

    if (mealTypes.length === 0) {
      throw new AppError(
        "No valid meal types (Breakfast, Lunch, Dinner) available for budget allocation",
        400,
      );
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

    const currency = budget?.currency || "USD";

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
      activeCategories: request.activeCategories,
    });

    console.log("🚀 Prompt:", prompt);

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

    // Save allocations to event meals in DB
    try {
      const existingMeals = await this.eventRepo.getMealsByEventId(eventId);

      for (const allocation of allocations.allocations) {
        const existingMeal = existingMeals.find(
          (m) => m.mealType === allocation.mealType,
        );

        if (existingMeal) {
          // Update existing meal estimated cost
          await this.eventRepo.updateMeal(existingMeal.id, {
            estimatedCost: allocation.suggestedBudget,
          });
        } else {
          // Create new meal
          const newMeal = await this.eventRepo.createMeal(eventId, {
            mealType: allocation.mealType,
          });
          // Update immediately with estimatedCost
          await this.eventRepo.updateMeal(newMeal.id, {
            estimatedCost: allocation.suggestedBudget,
          });
        }
      }
      console.log(
        `✅ Saved budget allocations for ${allocations.allocations.length} meals`,
      );
    } catch (dbError) {
      console.error("⚠️ Failed to save budget allocations to DB:", dbError);
      // Continue without failing the request, as return value is still useful
    }

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
      courseType,
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
      courseType,
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
      excludedCategories: request.excludedCategories,
      existingRecipeNames: request.existingRecipeNames || [],
    });

    console.log({ prompt });

    // Call AI for recipe generation
    const aiResponse = await this.aiProvider.createCompletion({
      prompt,
      systemPrompt: EVENT_RECIPE_SYSTEM_PROMPT,
      maxTokens: this.calculateMaxTokens(recipeCount),
      temperature: 0.7,
    });
    console.log("aiResponse:", aiResponse);

    // Parse recipes from AI response
    const parsedRecipes = this.parseRecipeResponse(
      aiResponse.content,
      mealType,
    );

    // Generate AI images for each recipe (parallel processing)
    console.log(
      `🖼️ Generating images for ${parsedRecipes.length} event recipes...`,
    );
    const recipesWithImages = await Promise.all(
      parsedRecipes.map(async (recipe) => {
        const imageUrl = await this.generateRecipeImage(recipe);
        return {
          ...recipe,
          imageUrl,
        };
      }),
    );

    // Post-process and store recipes
    const storedRecipes = await this.recipeStorage.storeAIGeneratedRecipes(
      recipesWithImages,
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
    activeCategories?: Record<MealType, string[]>;
  }): string {
    const hasHealthRestrictions = data.healthProfiles.some(
      (p) => p.allergies.length > 0 || p.dietaryRestrictions.length > 0,
    );

    const activeCategoriesText = data.activeCategories
      ? `\n**ACTIVE CATEGORIES PER MEAL (Only allocate to these):**\n${Object.entries(
          data.activeCategories,
        )
          .map(([mt, cats]) => `- ${mt}: ${cats.join(", ")}`)
          .join("\n")}`
      : "";

    return `
You are an expert event planner and budget analyst specializing in high-end family events and meal planning.
Your goal is to suggest a realistic, market-rate aware budget distribution for an event.

**EVENT CONTEXT:**
- Event Name: ${data.eventName}
- Occasion: ${data.occasionType} (Adjust allocations based on formality: Formal = higher budget for main course/wine; Casual = balanced)
- Total Budget: ${data.currency} ${data.totalBudget} (This is a HARD limit)
- Family Members: ${data.participantCount}
- Guests: ${data.adultGuests} Adults, ${data.kidGuests} Kids
- Total Servings: ${data.totalServings}

**MEAL TYPES TO ALLOCATE:**
${data.mealTypes.map((mt) => `- ${mt}`).join("\n")}
${activeCategoriesText}

**HEALTH CONSIDERATIONS (May affect cost):**
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

**CRITICAL ALLOCATION RULES (STRICT COMPLIANCE REQUIRED):**
1. **Total Budget**: Distribute exactly 100% of the TOTAL budget among the listed meal types.
2. **Meal Importance**:
   - Dinner typically requires 40-50% of the total budget.
   - Lunch typically requires 30-40%.
   - Breakfast typically requires 20-30%.
   - Adjust based on the specific meal types provided.
3. **Category Distribution (MOST IMPORTANT)**:
   - For EACH meal type, you MUST distribute 100% of THAT MEAL'S budget among its **Active Categories**.
   - **NO ZERO ALLOCATIONS**: Every category listed in "ACTIVE CATEGORIES" for a meal MUST receive a non-zero percentage (minimum 5-10%).
   - **Do NOT** allocate 0% to any category unless it is NOT listed in the active categories.
   - Example: If "Snacks" is listed as an active category for Lunch, it MUST get at least 5-10% of the Lunch budget.
4. **Realistic Ratios**:
   - Starters/Appetizers: ~15-20%
   - Main Course: ~40-50%
   - Sides: ~15-20%
   - Dessert: ~10-15%
   - Beverages: ~10-15%
   - Snacks: ~10-15% (if active)

**OUTPUT FORMAT (JSON only):**
\`\`\`json
{
    "allocations": [
        {
            "mealType": "dinner",
            "percentage": 50,
            "reasoning": "Formal dinner requires higher spend on premium mains and wine.",
            "categoryBreakdown": {
                "starter": 20,
                "main_course": 50,
                "side_dish": 15,
                "dessert": 15
            }
        },
        {
            "mealType": "lunch",
            "percentage": 30,
            "reasoning": "Light lunch with focus on fresh ingredients.",
            "categoryBreakdown": {
                "main_course": 60,
                "beverages": 20,
                "dessert": 20
            }
        }
    ],
    "recommendations": [
        "Focus on seasonal vegetables to maximize quality within budget.",
        "Bulk buy beverages to save costs."
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
        categoryBreakdown: a.categoryBreakdown, // Extract category breakdown
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

  /**
   * Merge ingredients using AI
   */
  async mergeIngredients(ingredients: any[]): Promise<any[]> {
    if (!ingredients || ingredients.length === 0) return [];

    console.log(`🤖 AI Merging ${ingredients.length} ingredients...`);

    const prompt = `Merge these ingredients into a consolidated shopping list:

    ${JSON.stringify(
      ingredients.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        category: i.category,
      })),
      null,
      2,
    )}

    Return a JSON array with merged items.`;

    try {
      const aiResponse = await this.aiProvider.createCompletion({
        prompt,
        systemPrompt: MERGE_INGREDIENTS_SYSTEM_PROMPT,
        maxTokens: 4000,
        temperature: 0.3, // Lower temperature for more deterministic merging
      });

      let content = aiResponse.content;
      // Remove markdown code blocks if present
      if (content.includes("```json")) {
        content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "");
      }
      if (content.includes("```")) {
        content = content.replace(/```\s*/g, "");
      }

      const merged = JSON.parse(content);

      if (!Array.isArray(merged)) {
        console.warn("AI returned non-array for merge, returning original");
        return ingredients;
      }

      return merged;
    } catch (error) {
      console.error("AI Merge failed:", error);
      return ingredients; // Fallback to original
    }
  }
}

/**
 * System prompt for budget allocation
 */
/**
 * System prompt for budget allocation
 */
const BUDGET_ALLOCATION_SYSTEM_PROMPT = `You are an expert AI Event Budget Consultant with 20+ years of experience in high-end catering and event planning.
Your task is to provide a precise, market-aware budget breakdown for an event.

**CORE DIRECTIVES:**
1. **Accuracy**: Allocations must be realistic for the specific occasion (e.g., a "Birthday Party" needs a different structure than a "Business Lunch").
2. **Completeness**: You MUST allocate budget to EVERY category requested. **Never return 0% for a requested category.**
3. **Health Awareness**: Account for dietary restrictions (e.g., Gluten-Free ingredients often cost 15-20% more).
4. **Structured Output**: Return ONLY valid JSON. No conversational filler.

**BEHAVIOR:**
- If a user asks for "Snacks" in the active categories, you MUST allocate a reasonable portion (e.g., 10-15%) to it.
- Prioritize "Main Course" as the anchor of the meal (usually 40-50%).
- Ensure the sum of all meal allocations equals 100% of the Total Budget.
- Ensure the sum of all category allocations equals 100% of the Meal Budget.
- Accounting for dietary restrictions and their cost implications
- Optimizing budget allocation for maximum satisfaction
- Considering cultural and occasion-specific requirements

**RULES:**
1. Always return valid JSON
2. Percentages must sum to 100
3. Consider health restrictions increase ingredient costs
4. Provide practical, actionable recommendations
5. Never exceed the total budget
6. Use USA market standards for cost estimation logic (USD currency)`;

const MERGE_INGREDIENTS_SYSTEM_PROMPT = `You are a smart grocery list optimizer and culinary expert.

Your task is to merge a list of ingredients into a consolidated shopping list and estimate their costs.

** Rules:**
  1. ** Merge Identical Items **: Combine ingredients that are effectively the same product.
   - Example: "Chopped Onions", "Red Onion", "White Onion" -> Merge to "Onions"(unless specifically distinct usage implies specific purchase, but favor merging for shopping list).
   - "Minced Garlic", "Garlic Cloves" -> Merge to "Garlic".
2. ** Standardize Names **: Use the most common, generic name for the merged item(e.g., "All-Purpose Flour" instead of "AP Flour").
3. ** Format Units **: Keep units consistent.If merging "cups" and "spoons", try to approximate to a common unit if sensible, or list separately if conversion is ambiguous.Ideally, merge into standard metric(g, ml) or common kitchen units(cup, tbsp, piece).
4. ** Sum Quantities **: Add up the quantities for merged items.
5. ** Categorize **: Ensuring each item has a correct category(Vegetables, Fruits, Meat, Dairy, Pantry, Spices, Bakery, Beverages, Others).
6. ** Estimate Cost **: Estimate the approximate cost in USD for the ** TOTAL quantity ** of the merged item.
   - Use current US market prices(2025 / 2026).
   - ** Price Sensitivity Strategy:** Act as a budget - conscious shopper. 
     - Assume "Store Brand" or "Great Value" pricing for generic items(e.g., flour, sugar, canned goods) unless a premium brand is specified.
     - Look for bulk savings for large quantities.
     - Avoid premium organic / specialty pricing unless explicitly implied by the ingredient name(e.g., "Organic Kale").
   - Example: If 2kg of Chicken Breast, use the price of a standard value pack, not the most expensive organic air - chilled option.
   - Provide a realistic urgency cost(don't underestimate, but aim for the "smart shopper" price).
7. ** Output JSON Only **: Return a valid JSON array of objects.

** Input Format:** JSON Array of { name, quantity, unit, category }
  ** Output Format:** JSON Array of { name, quantity, unit, category, estimatedCost: number, originalItems: string[] }
    `;
