// ============================================
// 1. ENHANCED INTERFACES & TYPES
// ============================================

export interface AIProvider {
    createCompletion(params: AICompletionParams): Promise<AICompletionResponse>;
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
        dietaryRestrictions?: string[]
    ): string;
}

export interface RecipeParser {
    parse(aiResponse: string, request: AIRecipeRequest): AIGeneratedRecipe[];
}

export interface RecipeStorage {
    storeGeneratedRecipes(recipes: AIGeneratedRecipe[], request: AIRecipeRequest): Promise<void>;
    getRecentRecipesWithScores(accountId: string, days?: number): Promise<RecipeScore[]>;
}

// Enhanced Recipe Request with all new parameters
export interface AIRecipeRequest {
    // Basic Info
    mealType: string;
    memberCount: number;
    servings: number; // NEW: Explicit serving size control
    recipeCount: number; // NEW: How many recipes to generate (1-5)

    // Budget & Time
    maxBudgetPerServing: number;
    maxPrepTime?: number;

    // Family Info
    targetMembers?: string[];
    isForAllMembers?: boolean;
    familyAges?: string[];

    // Cuisine & Preferences
    cuisine?: string;
    preferredCuisines?: string[];

    // Health Profiles
    dietaryRestrictions?: string[];
    allergies?: string[];
    healthConditions?: string[];
    healthGoals?: string[];

    // Food Preferences
    excludedFoods?: string[];
    includedFoods?: string[];
    customExclusions?: string[];
    customInclusions?: string[];

    // Pantry Management - NEW
    usePantryItems: boolean; // true = prioritize pantry, false = any ingredients
    pantryOnly?: boolean; // true = ONLY use pantry items

    // AI Learning & Memory
    accountId: string;
    dayOfWeek?: string;
    recipeHistory?: RecipeScore[]; // NEW: Past 2 months scores
    avoidRecentRecipes?: string[];
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
    type: 'like' | 'dislike' | 'cooked' | 'repeated' | 'skipped' | 'try_new';
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
    difficultyLevel: 'easy' | 'medium' | 'hard';
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
}

export interface RecipeIngredient {
    name: string;
    quantity: string;
    unit: string;
    isOptional: boolean;
    notes?: string;
    estimatedCost: number;
    category: 'produce' | 'pantry' | 'dairy' | 'protein' | 'seafood' | 'meat' | 'bakery' | 'spices' | 'beverages' | 'frozen' | 'other';
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
