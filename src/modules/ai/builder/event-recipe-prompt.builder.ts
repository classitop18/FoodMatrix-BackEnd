/**
 * ============================================
 * EVENT RECIPE PROMPT BUILDER
 * ============================================
 *
 * Production-grade AI prompt builder specifically designed for event recipe generation.
 * This module handles complex event-based meal planning with strict validation
 * and comprehensive prompt generation.
 *
 * Features:
 * - Strict cuisine enforcement
 * - Health profile aggregation
 * - Budget optimization
 * - Pantry integration
 * - Duplicate avoidance
 * - Occasion-aware recipe suggestions
 *
 * @module ai/builder/event-recipe-prompt.builder
 * @version 2.0.0
 */

import { getDb } from "../../../database/db.js";
import { pantryItems, ingredients } from "../../../database/schemas/schema.js";
import { eq } from "drizzle-orm";
import {
  EventRecipePromptRequest,
  MemberHealthProfile,
  NormalizedPantryItem,
  ValidationResult,
} from "../interfaces/ai.interfaces.js";

// ============================================
// TYPES & INTERFACES
// ============================================

// ============================================
// CONSTANTS
// ============================================

/**
 * Occasion-specific guidance for recipe generation
 */
const OCCASION_GUIDANCE: Record<string, string> = {
  birthday: `- Focus on celebratory, crowd-pleasing dishes
- Include colorful and visually appealing presentation
- Consider dishes that can be prepared ahead of time
- Include options suitable for all age groups
- Classic American birthday party foods like sliders, mac & cheese, or grilled items work well`,

  anniversary: `- Suggest elegant, romantic dishes with premium quality
- Quality over quantity approach
- Include premium ingredient options (filet mignon, lobster, scallops)
- Create an intimate dining experience
- Consider classic American fine dining or fusion cuisine`,

  thanksgiving: `- Traditional Thanksgiving staples are ESSENTIAL: turkey, stuffing, cranberry sauce, mashed potatoes, gravy
- Include classic American side dishes: green bean casserole, sweet potato casserole, cornbread
- Pumpkin pie or pecan pie for dessert
- Consider make-ahead dishes for easier day-of preparation
- Ensure generous portions — Thanksgiving is about abundance`,

  super_bowl: `- Easy-to-eat finger foods and snacks are key
- Buffalo wings, sliders, loaded nachos, dips (queso, guacamole, spinach artichoke)
- Chili, pulled pork sandwiches, pizza rolls
- Foods that can be eaten while watching the game
- Hearty, crowd-pleasing, minimal utensils needed`,

  fourth_of_july: `- Classic American BBQ and cookout foods
- Burgers, hot dogs, grilled chicken, ribs, corn on the cob
- Red, white, and blue themed desserts (berry trifle, flag cake)
- Potato salad, coleslaw, baked beans as sides
- Light refreshing options for hot weather`,

  memorial_day: `- BBQ and grilling-focused menu
- Burgers, steaks, grilled vegetables
- Classic American picnic sides: potato salad, pasta salad, coleslaw
- Fresh fruit and berry desserts
- Easy outdoor-friendly dishes`,

  christmas: `- Roast meats: prime rib, ham, turkey, or roast beef
- Classic American sides: mashed potatoes, roasted vegetables, dinner rolls
- Eggnog-inspired desserts, gingerbread, peppermint treats
- Elegant presentation befitting the holiday
- Consider make-ahead components for stress-free entertaining`,

  easter: `- Spring-inspired dishes with fresh seasonal ingredients
- Ham is traditional, also consider lamb or roasted chicken
- Deviled eggs, asparagus, spring salads
- Carrot cake, lemon desserts, hot cross buns
- Light and fresh flavors`,

  halloween: `- Fun, themed party foods with creative presentations
- Spooky-themed finger foods and appetizers
- Comfort foods like chili, soup in bread bowls
- Creative desserts: spider web brownies, candy apples, monster cookies
- Kid-friendly options if children are attending`,

  bbq: `- Grilling and smoking focused: ribs, brisket, pulled pork, burgers
- Classic BBQ sides: coleslaw, baked beans, cornbread, mac & cheese
- Multiple sauce options (Kansas City, Carolina, Texas-style)
- Grilled vegetables and corn on the cob
- Ice cream or cobbler for dessert`,

  potluck: `- Dishes that travel well and stay at temperature
- Casseroles, one-pot dishes, and crowd-pleasers
- Easy to serve and portion
- Include both hot and cold options
- Label-friendly for allergy awareness`,

  baby_shower: `- Elegant but approachable finger foods
- Mini sandwiches, fruit skewers, bruschetta, petit fours
- Light and fresh options
- Beautiful presentation is important
- Consider dietary variety for guests`,

  bridal_shower: `- Sophisticated and Instagram-worthy presentation
- Brunch items work well: quiche, scones, fruit platters
- Light bites and elegant appetizers
- Champagne-friendly pairings
- Dessert table with variety`,

  game_night: `- Easy-to-eat snacks and appetizers
- Pizza, wings, sliders, loaded fries
- Dips with chips and veggies
- Foods that don't require attention away from the game
- Both savory and sweet options`,

  tailgate: `- Portable, outdoor-friendly foods
- Burgers, brats, hot dogs from the grill
- Chili, loaded nachos, snack mixes
- Everything should be easy to eat standing up
- Hearty portions for game day appetite`,

  festival: `- Include traditional/cultural dishes appropriate for the festival
- Focus on festive flavors and presentations
- Consider religious dietary requirements if applicable
- Balance tradition with health considerations`,

  gathering: `- Focus on shareable, family-style dishes
- Easy to serve buffet-style options preferred
- Comfort food that appeals to diverse tastes
- Include vegetarian options for variety`,

  housewarming: `- Welcoming, warm comfort foods
- Dishes that are easy to eat while mingling
- Include both vegetarian and non-vegetarian options
- Finger foods and appetizers work well`,

  celebration: `- Special occasion worthy dishes
- Impressive but achievable recipes
- Mix of familiar favorites and special additions
- Consider dietary restrictions carefully`,

  dinner_party: `- Sophisticated menu planning
- Courses that flow well together
- Consider wine/beverage pairing suggestions
- Show-stopper centerpiece dishes`,

  wedding: `- Elegant, universally appealing dishes
- Easy to serve in large quantities
- Consider dietary restrictions of diverse guests
- Premium presentation is essential`,

  corporate: `- Professional, universally appealing options
- Easy to eat and not messy
- Suitable for formal settings
- Consider allergies and common restrictions`,

  other: `- Balanced, versatile menu options
- Focus on crowd-pleasers
- Ensure dietary accommodation
- Prioritize dishes with broad appeal`,
};

/**
 * Valid ingredient categories
 */
const VALID_INGREDIENT_CATEGORIES = [
  "produce",
  "pantry",
  "dairy",
  "protein",
  "seafood",
  "meat",
  "bakery",
  "spices",
  "beverages",
  "frozen",
  "other",
] as const;

/**
 * System prompt for event recipe generation
 */
export const EVENT_RECIPE_SYSTEM_PROMPT = `You are an elite AI chef specializing in event meal planning with expertise in:

- Large-scale cooking and portion management for events
- Budget optimization for celebrations
- Dietary accommodation for multiple participants
- Cultural and occasion-appropriate menu selection
- Balancing variety with practical execution

Core Principles:
1. Safety First: Zero tolerance for allergens - complete avoidance is mandatory
2. Budget Conscious: Stay within allocated budget - never exceed limits
3. Practicality: Recipes must be feasible for home cooks preparing for events
4. Variety: Avoid duplicate recipes from recent events
5. Occasion Appropriate: Match the event's tone, style, and cultural context
6. **Cuisine Compliance:** When a specific cuisine is REQUIRED, ALL recipes MUST be authentic dishes from that cuisine ONLY. Do not mix or substitute with other cuisines.

Critical Output Rules:
- ALWAYS return valid JSON array - no markdown, no explanations
- NEVER omit nutrition data - it is mandatory for health tracking
- ALWAYS respect dietary restrictions - safety is non-negotiable
- ALWAYS provide accurate cost estimates - use realistic 2025/2026 USA prices (USD)
- **Use budget-conscious pricing:** Assume store brands/value packs unless premium is required
- NEVER suggest recipes from the "avoid" list
- **STRICTLY follow cuisine requirements** - if "Indian" cuisine is required, ONLY suggest authentic Indian dishes`;

// ============================================
// MAIN BUILDER CLASS
// ============================================

/**
 * EventRecipePromptBuilder
 *
 * Production-grade prompt builder for event-specific recipe generation.
 * Handles complex multi-participant events with varying dietary needs,
 * budget constraints, and cuisine preferences.
 */
export class EventRecipePromptBuilder {
  private _db: any = null;

  /**
   * Lazy-loaded database connection
   */
  private get db() {
    if (!this._db) {
      this._db = getDb();
    }
    return this._db;
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Build complete event recipe prompt
   *
   * Assembles all sections into a comprehensive AI prompt for recipe generation.
   *
   * @param request - Event recipe generation request with all parameters
   * @returns Complete prompt string for AI model
   * @throws Error if validation fails with critical errors
   */
  async buildEventRecipePrompt(
    request: EventRecipePromptRequest,
  ): Promise<string> {
    // Validate request before building prompt
    const validation = this.validateRequest(request);
    if (!validation.isValid) {
      console.error(
        "Event Recipe Prompt Validation Errors:",
        validation.errors,
      );
      throw new Error(`Invalid request: ${validation.errors.join(", ")}`);
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      console.warn("Event Recipe Prompt Warnings:", validation.warnings);
    }

    const isCustomSearch =
      !!request.customSearch && request.customSearch.trim().length > 0;

    // Build all prompt sections
    const sections = await Promise.all([
      this.buildEventContextSection(request),
      this.buildHealthProfilesSection(request.healthProfiles, isCustomSearch),
      this.buildBudgetSection(request, isCustomSearch),
      request.usePantryItems
        ? this.buildPantrySection(request.accountId)
        : Promise.resolve(""),
      this.buildAvoidDuplicatesSection(request.recentEventMealNames),
      request.customSearch
        ? this.buildCustomSearchSection(request.customSearch)
        : "",
      this.buildOutputFormatSection(request, isCustomSearch),
    ]);

    // Filter empty sections and join
    return sections.filter((s) => s.trim().length > 0).join("\n\n");
  }

  /**
   * Get the system prompt for event recipe generation
   */
  getSystemPrompt(): string {
    return EVENT_RECIPE_SYSTEM_PROMPT;
  }

  // ============================================
  // VALIDATION
  // ============================================

  /**
   * Validate the event recipe request
   *
   * Performs comprehensive validation of all request parameters
   * to ensure the prompt will generate valid, usable recipes.
   */
  private validateRequest(request: EventRecipePromptRequest): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!request.eventId?.trim()) {
      errors.push("Event ID is required");
    }
    if (!request.eventName?.trim()) {
      errors.push("Event name is required");
    }
    if (!request.occasionType?.trim()) {
      errors.push("Occasion type is required");
    }
    if (!request.mealType?.trim()) {
      errors.push("Meal type is required");
    }
    if (!request.accountId?.trim()) {
      errors.push("Account ID is required");
    }

    // Numeric validations
    if (!request.recipeCount || request.recipeCount < 1) {
      errors.push("Recipe count must be at least 1");
    }
    if (request.recipeCount > 10) {
      warnings.push("Large recipe count may affect response quality");
    }
    if (!request.servings || request.servings < 1) {
      errors.push("Servings must be at least 1");
    }
    if (request.servings > 100) {
      warnings.push("Very large serving size - ensure practical recipes");
    }

    // Date validation
    if (!request.eventDate) {
      errors.push("Event date is required");
    }

    // Cuisine validation - warn if None specified for cuisine-specific events
    if (
      request.preferredCuisines &&
      request.preferredCuisines.length > 0 &&
      request.preferredCuisines.includes("")
    ) {
      warnings.push(
        "Empty string found in preferred cuisines - will be filtered",
      );
    }

    // Budget validation
    if (request.budget < 0) {
      errors.push("Budget cannot be negative");
    }

    // Participant validation
    if (request.adultGuests < 0 || request.kidGuests < 0) {
      errors.push("Guest counts cannot be negative");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ============================================
  // PROMPT SECTION BUILDERS
  // ============================================

  /**
   * Build event context section
   *
   * Creates the main context block with event details, serving requirements,
   * and cuisine specifications with strict enforcement.
   */
  private buildEventContextSection(request: EventRecipePromptRequest): string {
    const eventDateStr = new Date(request.eventDate).toLocaleDateString(
      "en-US",
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      },
    );

    // Filter out empty cuisine strings
    const validCuisines = (request.preferredCuisines || []).filter(
      (c) => c && c.trim().length > 0,
    );

    // Build cuisine instruction - STRICT enforcement when specified
    const cuisineInstruction = this.buildCuisineInstruction(validCuisines);

    // Build course type instruction
    const courseTypeInstruction = request.courseType
      ? `\n**📋 COURSE TYPE (SPECIFIC):**
- Generate ONLY **${request.courseType.replace("_", " ")}** recipes for this ${request.mealType}
- All ${request.recipeCount} recipe(s) must be appropriate as a ${request.courseType.replace("_", " ")}
- ${this.getCourseTypeGuidance(request.courseType)}`
      : "";

    return `**🎉 EVENT CONTEXT:**

**Event Details:**
- Event Name: "${request.eventName}"
- Occasion Type: ${request.occasionType}
- Event Date: ${eventDateStr}
- Meal Type: ${request.mealType.toUpperCase()}

**Serving Requirements:**
- Family Members: ${request.participantCount}
- Adult Guests: ${request.adultGuests}
- Kid Guests: ${request.kidGuests}
- Total Servings Required: ${request.servings}

**Recipe Generation:**
- Generate exactly ${request.recipeCount} ${request.mealType} recipe(s)
${cuisineInstruction}
${courseTypeInstruction}

**OCCASION-SPECIFIC GUIDANCE:**
${this.getOccasionGuidance(request.occasionType)}`;
  }

  /**
   * Get course type specific guidance
   */
  private getCourseTypeGuidance(courseType: string): string {
    const guidance: Record<string, string> = {
      starter:
        "Starters should be light, easy to eat, and set the tone for the meal. Finger foods, small plates, and appetizers are ideal.",
      main_course:
        "Main course should be the centerpiece — hearty, satisfying, and the most substantial dish of the meal.",
      side_dish:
        "Side dishes should complement the main course without overpowering it. Vegetables, grains, and light accompaniments work best.",
      appetizer:
        "Appetizers should be bite-sized, flavorful, and designed to whet the appetite before the main event.",
      salad:
        "Salads should be fresh, seasonal, and provide a refreshing contrast to heavier courses.",
      soup: "Soups should be flavorful and can range from light consommés to hearty chowders depending on the meal context.",
    };
    return (
      guidance[courseType] ||
      "Generate dishes appropriate for this course type."
    );
  }

  /**
   * Build cuisine instruction with strict enforcement
   *
   * When cuisines are specified, creates a MANDATORY instruction
   * that the AI must follow strictly.
   */
  private buildCuisineInstruction(cuisines: string[]): string {
    if (cuisines.length === 0) {
      return "- Cuisine: Open to suggestions based on occasion and participant preferences";
    }

    const cuisineList = cuisines.join(", ");
    const cuisineOptions = cuisines.join(" or ");

    return `- **🍽️ REQUIRED Cuisine (MANDATORY):** ${cuisineList}

**⚠️ STRICT CUISINE REQUIREMENT:**
ALL recipes MUST be authentic ${cuisineOptions} cuisine dishes.
- DO NOT suggest dishes from any other cuisine
- Ensure authenticity in ingredients and cooking methods
- Maintain traditional flavors and presentations
- This is a NON-NEGOTIABLE requirement

The cuisineType field in each recipe MUST be: "${cuisines[0]}"`;
  }

  /**
   * Get occasion-specific recipe guidance
   */
  private getOccasionGuidance(occasionType: string): string {
    const normalizedType = occasionType.toLowerCase().replace(/[^a-z_]/g, "_");
    return OCCASION_GUIDANCE[normalizedType] || OCCASION_GUIDANCE.other;
  }

  /**
   * Build health profiles section
   *
   * Aggregates all participant health data and creates comprehensive
   * safety requirements for recipe generation.
   */
  private buildHealthProfilesSection(
    healthProfiles: MemberHealthProfile[],
    isCustomSearch: boolean = false,
  ): string {
    if (!healthProfiles || healthProfiles.length === 0) {
      return `**🏥 HEALTH CONSIDERATIONS:**
No specific health profiles provided. Generate recipes suitable for general consumption.
Consider common allergens and provide alternatives where possible.`;
    }

    // Aggregate all restrictions for safety
    const aggregatedData = this.aggregateHealthData(healthProfiles);

    if (isCustomSearch) {
      return `**🏥 HEALTH CONSIDERATIONS (ADVISORY ONLY):**

**⚠️ KNOWN ALLERGIES (User has overridden safety checks for this specific request):**
${this.formatListOrNone(aggregatedData.allergies, "No specific allergies")}

**🥗 DIETARY RESTRICTIONS (User has overridden checks):**
${this.formatListOrNone(aggregatedData.dietaryRestrictions, "No specific restrictions")}

**🩺 HEALTH CONDITIONS (Adapt where possible):**
${this.formatListOrNone(aggregatedData.healthConditions, "No specific conditions")}

**🎯 HEALTH GOALS:**
${this.formatListOrNone(aggregatedData.healthGoals, "General wellness")}

**CRITICAL INSTRUCTION:** 
Safety checks are OVERRIDDEN by the user's specific request. 
Generate the requested recipe regardless of conflicts, but NOTE any major health conflicts in the 'healthConsiderations' field.`;
    }

    return `**🏥 HEALTH CONSIDERATIONS (CRITICAL - MUST FOLLOW):**

**⚠️ ALLERGIES (ZERO TOLERANCE - Complete Avoidance Required):**
${this.formatListOrNone(aggregatedData.allergies, "No specific allergies")}

**🥗 DIETARY RESTRICTIONS (MUST COMPLY):**
${this.formatListOrNone(aggregatedData.dietaryRestrictions, "No specific restrictions")}

**🩺 HEALTH CONDITIONS (Adapt Recipes Accordingly):**
${this.formatListOrNone(aggregatedData.healthConditions, "No specific conditions")}

**🎯 HEALTH GOALS (Optimize For):**
${this.formatListOrNone(aggregatedData.healthGoals, "General wellness")}

**👤 INDIVIDUAL PARTICIPANT PROFILES:**
${this.formatParticipantProfiles(healthProfiles)}

**CRITICAL INSTRUCTION:** 
All recipes MUST be safe for EVERY participant listed above. 
Include "healthConsiderations" field explaining how each recipe accommodates these needs.
If any allergy cannot be avoided while maintaining authenticity, do NOT suggest the recipe.`;
  }

  /**
   * Aggregate health data from all profiles
   */
  private aggregateHealthData(profiles: MemberHealthProfile[]): {
    allergies: string[];
    dietaryRestrictions: string[];
    healthConditions: string[];
    healthGoals: string[];
  } {
    const allergies = new Set<string>();
    const dietaryRestrictions = new Set<string>();
    const healthConditions = new Set<string>();
    const healthGoals = new Set<string>();

    profiles.forEach((profile) => {
      profile.allergies?.forEach((a) => allergies.add(a));
      profile.dietaryRestrictions?.forEach((dr) => dietaryRestrictions.add(dr));
      profile.healthConditions?.forEach((hc) => healthConditions.add(hc));
      profile.healthGoals?.forEach((hg) => healthGoals.add(hg));
    });

    return {
      allergies: Array.from(allergies),
      dietaryRestrictions: Array.from(dietaryRestrictions),
      healthConditions: Array.from(healthConditions),
      healthGoals: Array.from(healthGoals),
    };
  }

  /**
   * Format a list of items or return default text
   */
  private formatListOrNone(items: string[], defaultText: string): string {
    if (items.length === 0) {
      return `- ${defaultText}`;
    }
    return items.map((item) => `- ${item}`).join("\n");
  }

  /**
   * Format individual participant profiles
   */
  private formatParticipantProfiles(profiles: MemberHealthProfile[]): string {
    return profiles
      .map((profile) => {
        const name = profile.name || `Participant ${profile.id.slice(0, 6)}`;
        const allergies =
          profile.allergies?.length > 0 ? profile.allergies.join(", ") : "None";
        const dietary =
          profile.dietaryRestrictions?.length > 0
            ? profile.dietaryRestrictions.join(", ")
            : "None";
        const conditions =
          profile.healthConditions?.length > 0
            ? profile.healthConditions.join(", ")
            : "None";
        const goals =
          profile.healthGoals?.length > 0
            ? profile.healthGoals.join(", ")
            : "General wellness";

        return `
**${name}:**
- Allergies: ${allergies}
- Dietary: ${dietary}
- Conditions: ${conditions}
- Goals: ${goals}`;
      })
      .join("\n");
  }

  /**
   * Build budget section
   *
   * Creates budget constraints with strict enforcement rules.
   */
  private buildBudgetSection(
    request: EventRecipePromptRequest,
    isCustomSearch: boolean = false,
  ): string {
    if (request.budget <= 0) {
      return `**💰 BUDGET:**
No specific budget constraint. Focus on value for money while maintaining quality.
Prioritize cost-effective ingredients without sacrificing taste.`;
    }

    const perServingBudget =
      request.maxBudgetPerServing || request.budget / request.servings;

    if (isCustomSearch) {
      return `**💰 BUDGET TARGETS:**

- **Meal Budget Allocated:** $${request.budget.toFixed(2)}
- **Per Serving Budget:** $${perServingBudget.toFixed(2)}

**BUDGET GUIDELINES:**
1. Try to stay close to $${request.budget}, but if the specific requested recipe requires more, PRIROITIZE the recipe quality.
2. Report expected cost honestly found in the USA market.`;
    }

    return `**💰 BUDGET CONSTRAINTS (STRICT):**

- **Meal Budget Allocated:** $${request.budget.toFixed(2)} (Total for ${request.mealType})
- **Per Serving Budget:** $${perServingBudget.toFixed(2)}
- **Total Servings:** ${request.servings}

**BUDGET RULES (MANDATORY):**
1. Total recipe cost MUST NOT exceed $${request.budget}
2. Use realistic 2025 grocery prices (USA market for USD)
3. Calculate accurate cost per ingredient based on USA standard pricing
4. Report exact cost breakdown in costAnalysis
5. Cost per serving must not exceed $${perServingBudget.toFixed(2)}
6. Prioritize budget efficiency without sacrificing quality
7. Consider bulk buying for large servings
8. **Pricing Strategy:**
   - Use "Store Brand" pricing for generics (flour, sugar, canned goods)
   - Assume standard non-organic produce
   - Use family-pack pricing for meats where applicable
   - Avoid premium store pricing (e.g. Whole Foods); use standard market averages
9. **CRITICAL:** The 'totalCost' field MUST be the exact sum of all 'estimatedCost' fields in the 'ingredients' array. Do not estimate the total independently. Sum the ingredients.`;
  }

  /**
   * Build pantry section (if using pantry items)
   */
  private async buildPantrySection(accountId: string): Promise<string> {
    try {
      const items = await this.fetchPantryItems(accountId);

      if (items.length === 0) {
        return `**🍳 PANTRY STATUS:**
User's pantry is empty. All ingredients will need to be purchased.`;
      }

      const formattedItems = items
        .map(
          (item) =>
            `- ${item.name}: ${item.quantity} ${item.unit} (${item.category})`,
        )
        .join("\n");

      return `**🍳 AVAILABLE PANTRY ITEMS (Prioritize Using These):**

${formattedItems}

**PANTRY RULES:**
1. Prioritize using pantry items to reduce costs
2. Mark used pantry items with "isPantryItem": true
3. Calculate savings from pantry usage in costAnalysis.pantryItemsSavings
4. Only suggest additional purchases for items not in pantry`;
    } catch (error) {
      console.error("Error fetching pantry items:", error);
      return "";
    }
  }

  /**
   * Fetch and normalize pantry items from database
   */
  private async fetchPantryItems(
    accountId: string,
  ): Promise<NormalizedPantryItem[]> {
    const items = await this.db
      .select({
        name: ingredients.name,
        quantity: pantryItems.quantity,
        unit: pantryItems.unit,
        category: ingredients.category,
      })
      .from(pantryItems)
      .leftJoin(ingredients, eq(pantryItems.ingredientId, ingredients.id))
      .where(eq(pantryItems.accountId, accountId));

    return items.map((item: any) => ({
      name: item.name || "Unknown",
      quantity: item.quantity || 0,
      unit: item.unit || "unit",
      category: item.category || "other",
    }));
  }

  /**
   * Build section to avoid duplicate recipes
   */
  private buildAvoidDuplicatesSection(recentMealNames: string[]): string {
    if (!recentMealNames || recentMealNames.length === 0) {
      return `**🔄 VARIETY:**
No recent event meals to avoid. Focus on variety and occasion appropriateness.`;
    }

    const formattedNames = recentMealNames
      .map((name) => `- "${name}"`)
      .join("\n");

    return `**🚫 AVOID THESE RECIPES (Recently Used in Events):**

The following recipes have been served in recent events. DO NOT suggest these or very similar dishes:

${formattedNames}

**INSTRUCTION:** 
- Create fresh, unique recipes that differ from the above list
- Avoid similar flavor profiles or preparation methods
- Ensure variety in cuisine and ingredients`;
  }

  /**
   * Build custom search section
   */
  private buildCustomSearchSection(customSearch: string): string {
    const sanitizedSearch = customSearch.trim().slice(0, 200); // Limit length

    return `**🔍 SPECIFIC RECIPE REQUEST (STRICT):**

The user has specifically requested: "${sanitizedSearch}"

**INSTRUCTION:** 
- You MUST generate the recipe requested by the user.
- **IGNORE ALL HEALTH/DIETARY RESTRICTIONS** for this specific request. The user is aware and wants this specific dish regardless of allergies or diet.
- If the request is a generic description (e.g., "chicken with rice", "roasted fish"), generate a high-quality, authentic version of that dish.
- If the requested recipe name is complete nonsense or random characters (e.g., "asdfgh"), return an empty array \`[]\`.
- Do NOT return an empty array if there is a health conflict. Generate the recipe details faithfully to the dish name.

**MANDATORY SAFETY ANALYSIS:**
Since you are overriding safety checks, you MUST perform a detailed analysis:
1. Identify exactly which health profiles (from the list above) this recipe conflicts with.
2. Fill the "suitabilityAnalysis" field with clear warnings.
3. Add a "Use at your own risk" disclaimer in "healthConsiderations" if severe allergies or conditions are present.`;
  }

  /**
   * Build output format section
   *
   * Creates detailed JSON schema for AI output with all required fields.
   */
  private buildOutputFormatSection(
    request: EventRecipePromptRequest,
    isCustomSearch: boolean = false,
  ): string {
    const validCuisines = (request.preferredCuisines || []).filter(
      (c) => c && c.trim().length > 0,
    );

    const cuisineChecklistItem =
      validCuisines.length > 0
        ? `\n✅ **ALL recipes are authentic ${validCuisines.join(" or ")} cuisine (MANDATORY)**`
        : "";

    // ADJUSTED CHECKLIST SECTION
    let checklist = `
**FINAL CHECKLIST (All MUST be satisfied):**
✅ Exactly ${request.recipeCount} recipe(s)
✅ Each for ${request.servings} servings
✅ All ingredients have valid categories
✅ Complete nutrition data (no zeros or placeholders)
✅ Valid JSON format (no markdown, no extra text outside JSON)`;

    if (isCustomSearch) {
      checklist += `
✅ Requested dish "${request.customSearch}" generated successfully`;
    } else {
      checklist += `
✅ Budget constraints met (total ≤ $${request.budget || "N/A"})
✅ All allergens completely avoided
✅ No duplicates from recent events
✅ Occasion-appropriate for ${request.occasionType}${cuisineChecklistItem}`;
    }

    return `**📤 OUTPUT FORMAT (JSON ONLY - No additional text):**

Return a JSON array with EXACTLY ${request.recipeCount} recipe object(s):

\`\`\`json
[
    {
        "name": "Recipe Name",
        "description": "2-3 sentence appetizing description highlighting event appropriateness",
        "cuisineType": "${validCuisines[0] || "Specific cuisine"}",
        "mealType": "${request.mealType}",
        "servings": ${request.servings},
        "imageUrl": "Valid public image URL or null",
        "totalTimeMinutes": <number>,
        "difficultyLevel": "easy|medium|hard",
        
        "ingredients": [
            {
                "name": "ingredient name (singular, standard)",
                "quantity": "precise amount",
                "unit": "standard unit",
                "isOptional": false,
                "notes": "preparation notes",
                "estimatedCost": <number in USD, realistic USA 2025 price>,
                "category": "${VALID_INGREDIENT_CATEGORIES.join("|")}",
                "isPantryItem": false
            }
        ],
        
        "shoppingList": [
            {
                "ingredientName": "standardized name",
                "quantity": "amount to purchase",
                "unit": "kg|g|lb|l|ml (weight/volume, not piece/each)"
            }
        ],
        
        "instructions": [
            "Step 1: Detailed instruction with timing",
            "Step 2: Continue with visual cues..."
        ],
        
        "costAnalysis": {
            "totalCost": <sum of all 'estimatedCost' fields in USD>,
            "costPerServing": <totalCost / servings>,
            "budgetEfficiency": <0.0-1.0>,
            "pantryItemsSavings": <optional>
        },
        
        "suitabilityAnalysis": {
            "suitableFor": ["Low Carb", "High Protein"],
            "notSuitableFor": ["Nut Allergy", "Diabetic"],
            "riskNote": "Specific warning if any health conflicts exist"
        },
        
        "nutrition": {
            "calories": <per serving>,
            "protein_g": <per serving>,
            "carbs_g": <per serving>,
            "fat_g": <per serving>,
            "fiber_g": <per serving>,
            "sugar_g": <per serving>,
            "sodium_mg": <per serving>,
            "cholesterol_mg": <per serving>
        },
        
        "nutritionalHighlights": ["Health benefit 1", "Health benefit 2"],
        "healthScore": <0-100>,
        "healthConsiderations": ["How this recipe accommodates dietary needs"],
        "cookingTips": ["Pro tip 1", "Pro tip 2"],
        "variations": ["Variation 1", "Variation 2"],
        "eventRecommendations": ["Why this is perfect for ${request.occasionType}"],
        "aiReasoningNotes": "Explanation of why this recipe was chosen for this event"
    }
]
\`\`\`
${checklist}`;
  }
}

// ============================================
// EXPORTS
// ============================================

export default EventRecipePromptBuilder;
