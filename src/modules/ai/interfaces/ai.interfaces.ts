// ============================================
// 1. ENHANCED INTERFACES & TYPES
// ============================================

// Image Generation Types
export interface AIImageGenerationParams {
  prompt: string;
  size?: "256x256" | "512x512" | "1024x1024";
  quality?: "standard" | "hd";
  n?: number;
}

export interface AIProvider {
  createCompletion(params: AICompletionParams): Promise<AICompletionResponse>;
  generateImage(params: AIImageGenerationParams): Promise<string>;
  getProviderName(): string;
}

export interface AICompletionParams {
  prompt: string;
  systemPrompt?: string;
  maxTokens: number;
  temperature?: number;
}

export interface AICompletionResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface RecipePromptBuilder {
  buildPrompt(request: AIRecipeRequest): Promise<string>;
  buildRecipeSearchPrompt(
    recipeName: string,
    mealType: string,
    servings: number,
    dietaryRestrictions?: string[],
  ): Promise<string>;
}

export interface RecipeParser {
  parse(aiResponse: string, request: AIRecipeRequest): AIGeneratedRecipe[];
}

export interface RecipeStorage {
  storeAIGeneratedRecipes(
    recipes: AIGeneratedRecipe[],
    request: AIRecipeRequest,
  ): Promise<AIGeneratedRecipe[]>;
  getRecentRecipesWithScores(
    accountId: string,
    days?: number,
  ): Promise<RecipeScore[]>;
  searchRecipesByName(query: string, accountId?: string): Promise<any[]>;
  getRecipeWithIngredients(recipeId: string): Promise<any>;
}

// Enhanced Recipe Request with all new parameters
export interface MemberHealthProfile {
  id: string;
  name?: string;
  dietaryRestrictions: string[];
  allergies: string[];
  healthConditions: string[];
  healthGoals: string[];
}

export interface AIRecipeRequest {
  accountId: string;
  mealType: string;
  memberCount: number;
  recipeCount: number;
  isForAllMembers?: boolean;

  // Preferences & Constraints
  servings: number;
  usePantryItems: boolean; // Prioritize pantry items
  pantryOnly?: boolean; // STRICT constraint (only pantry)
  maxBudgetPerServing?: number; // USD
  cuisine?: string; // e.g. "Italian", "Mexican"
  preferredCuisines?: string[]; // e.g. ["Italian", "Mexican"] (used if cuisine not set)
  difficulty?: "easy" | "medium" | "hard";
  maxPrepTime?: number; // minutes
  dayOfWeek?: string; // Context for meal complexity

  // Personalization
  recipeHistory?: RecipeScore[]; // For learning
  avoidRecentRecipes?: string[]; // To prevent repetition

  // Health & Diet
  dietaryRestrictions?: string[]; // Global restrictions
  allergies?: string[]; // Global allergies
  healthConditions?: string[]; // Global conditions
  healthGoals?: string[]; // Global goals
  healthProfiles?: MemberHealthProfile[]; // Per-member detailed profiles

  // Food Preferences
  excludedFoods?: string[]; // "I hate mushrooms"
  includedFoods?: string[]; // "I want more kale"
  customExclusions?: string[];
  customInclusions?: string[];
}

// NEW: Recipe Scoring System
export interface RecipeScore {
  recipeId: string;
  recipeName: string;
  score: number; // Calculated score based on user actions
  interactions: RecipeInteraction[];
  lastInteraction: Date;
  timesCooked: number;
  cuisineType: string;
  mealType: string;
  ingredients?: string[]; // Key ingredients for pattern learning
}

export interface RecipeInteraction {
  type: "like" | "dislike" | "cooked" | "repeated" | "skipped" | "try_new";
  date: Date;
  scoreImpact: number; // +1, -2, +2, +3, -1, 0
}

export interface AIGeneratedRecipe {
  id?: string; // Optional: Database ID when recipe is stored
  name: string;
  description: string;
  cuisineType: string;
  mealType: string;
  servings: number;
  totalTimeMinutes: number;
  difficultyLevel: "easy" | "medium" | "hard";
  ingredients: RecipeIngredient[];
  instructions: string[];
  costAnalysis: CostAnalysis;
  nutrition: NutritionInfo; // Now mandatory
  nutritionalHighlights: string[];
  healthScore: number;
  pantryOptimization: string[];
  cookingTips: string[];
  variations: string[];
  webSourceInspirations: string[];
  healthConsiderations?: string[];
  aiReasoningNotes?: string; // Why this recipe was suggested

  // Pantry feasibility tracking (NEW)
  canGenerateRecipe?: boolean; // Whether recipe can be generated with available items
  insufficientPantryReason?: string; // Explanation if canGenerateRecipe is false
  suggestedPantryAdditions?: string[]; // Items needed to make recipe possible
  pantryItemsUsedCount?: number; // Count of pantry items actually used
  imageUrl?: string; // NEW: Image URL of the recipe
}

export interface RecipeIngredient {
  name: string;
  quantity: string;
  unit: string;
  isOptional: boolean;
  notes?: string;
  estimatedCost: number;
  category:
    | "produce"
    | "pantry"
    | "dairy"
    | "protein"
    | "seafood"
    | "meat"
    | "bakery"
    | "spices"
    | "beverages"
    | "frozen"
    | "other";
  isPantryItem?: boolean; // NEW: Mark if from user's pantry
}

export interface CostAnalysis {
  totalCost: number;
  costPerServing: number;
  budgetEfficiency: number;
  pantryItemsSavings?: number; // NEW: Money saved using pantry
}

export interface NutritionInfo {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg?: number;
  cholesterol_mg?: number;
}

export const RECIPE_GENERATION_SYSTEM_PROMPT = `You are an elite AI chef and nutritionist specializing in personalized family meal planning with advanced machine learning capabilities.

**Your Expertise:**
- Professional culinary techniques across all world cuisines
- Clinical nutrition science and dietary management
- Budget optimization without compromising quality
- AI-powered personalization based on user behavior patterns
- Family meal planning for diverse dietary needs
- Ingredient substitution and pantry management

**Your Core Principles:**
1. **Safety First:** Zero tolerance for allergens, strict dietary compliance
2. **Learning-Driven:** Analyze user history to improve suggestions continuously
3. **Authenticity:** Respect cultural culinary traditions while adapting for health
4. **Practicality:** Create recipes real families can actually cook
5. **Precision:** Provide accurate nutrition, costs, and timing
6. **Creativity:** Balance user preferences with exciting variety

**Critical Output Rules:**
- ALWAYS return valid JSON (no markdown, no code blocks, no extra text)
- NEVER omit the "nutrition" object - it's mandatory
- ALWAYS use realistic calculated values (no placeholders)
- ALWAYS respect budget constraints strictly
- ALWAYS mark ingredients with proper categories
- ALWAYS explain your reasoning for recipe selection

**Your Goal:** Create recipes that families love to cook repeatedly while meeting their health, budget, and preference requirements.`;
