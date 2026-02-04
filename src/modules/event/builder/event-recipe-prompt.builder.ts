import { MemberHealthProfile } from "../../ai/interfaces/ai.interfaces.js";
import { MealType } from "../types/event.types.js";
import { getDb } from "../../../database/db.js";
import { pantryItems, ingredients } from "../../../database/schemas/schema.js";
import { eq } from "drizzle-orm";

/**
 * Event Recipe Generation Request
 */
export interface EventRecipePromptRequest {
  eventId: string;
  eventName: string;
  occasionType: string;
  eventDate: Date;
  mealType: MealType;
  recipeCount: number;
  servings: number;
  budget: number;
  maxBudgetPerServing?: number;
  preferredCuisines?: string[];
  customSearch?: string;
  healthProfiles: MemberHealthProfile[];
  participantCount: number;
  adultGuests: number;
  kidGuests: number;
  recentEventMealNames: string[];
  accountId: string;
  usePantryItems?: boolean;
}

/**
 * Dedicated Prompt Builder for Event Recipe Generation
 * Builds structured prompts specifically for event context
 */
export class EventRecipePromptBuilder {
  private _db: any = null;

  private get db() {
    if (!this._db) {
      this._db = getDb();
    }
    return this._db;
  }

  /**
   * Build complete event recipe prompt
   */
  async buildEventRecipePrompt(
    request: EventRecipePromptRequest,
  ): Promise<string> {
    const eventContextSection = this.buildEventContextSection(request);
    const healthSection = this.buildHealthProfilesSection(
      request.healthProfiles,
    );
    const budgetSection = this.buildBudgetSection(request);
    const avoidDuplicatesSection = this.buildAvoidDuplicatesSection(
      request.recentEventMealNames,
    );
    const pantrySection = request.usePantryItems
      ? await this.buildPantrySection(request.accountId)
      : "";
    const customSearchSection = request.customSearch
      ? this.buildCustomSearchSection(request.customSearch)
      : "";
    const outputFormatSection = this.buildOutputFormatSection(request);

    return `
${eventContextSection}

${healthSection}

${budgetSection}

${pantrySection}

${avoidDuplicatesSection}

${customSearchSection}

${outputFormatSection}
`;
  }

  /**
   * Build event context section
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
${
  request.preferredCuisines && request.preferredCuisines.length > 0
    ? `- Preferred Cuisines: ${request.preferredCuisines.join(", ")}`
    : "- Cuisine: Open to suggestions based on occasion"
}

**OCCASION-SPECIFIC GUIDANCE:**
${this.getOccasionGuidance(request.occasionType)}`;
  }

  /**
   * Get occasion-specific recipe guidance
   */
  private getOccasionGuidance(occasionType: string): string {
    const guidance: Record<string, string> = {
      birthday: `- Focus on celebratory, crowd-pleasing dishes
- Include colorful presentation
- Consider making dishes that can be prepared ahead`,
      anniversary: `- Suggest elegant, romantic dishes
- Quality over quantity approach
- Include premium ingredient options`,
      festival: `- Include traditional/cultural dishes appropriate for the festival
- Focus on festive flavors and presentations
- Consider religious dietary requirements if applicable`,
      gathering: `- Focus on shareable, family-style dishes
- Easy to serve buffet-style options
- Comfort food that appeals to diverse tastes`,
      housewarming: `- Welcoming, warm comfort foods
- Dishes that are easy to eat while mingling
- Include both vegetarian and non-vegetarian options`,
      celebration: `- Special occasion worthy dishes
- Impressive but achievable recipes
- Mix of familiar favorites and special additions`,
      dinner_party: `- Sophisticated menu planning
- Courses that flow well together
- Consider wine pairing suggestions`,
      other: `- Balanced, versatile menu options
- Focus on crowd-pleasers
- Ensure dietary accommodation`,
    };

    return guidance[occasionType] || guidance.other;
  }

  /**
   * Build health profiles section
   */
  private buildHealthProfilesSection(
    healthProfiles: MemberHealthProfile[],
  ): string {
    if (healthProfiles.length === 0) {
      return `**🏥 HEALTH CONSIDERATIONS:**
No specific health profiles selected. Generate recipes suitable for general consumption.`;
    }

    // Aggregate all restrictions
    const allAllergies = new Set<string>();
    const allDietaryRestrictions = new Set<string>();
    const allHealthConditions = new Set<string>();
    const allHealthGoals = new Set<string>();

    healthProfiles.forEach((profile) => {
      profile.allergies.forEach((a) => allAllergies.add(a));
      profile.dietaryRestrictions.forEach((dr) =>
        allDietaryRestrictions.add(dr),
      );
      profile.healthConditions.forEach((hc) => allHealthConditions.add(hc));
      profile.healthGoals.forEach((hg) => allHealthGoals.add(hg));
    });

    return `**🏥 HEALTH CONSIDERATIONS (CRITICAL - MUST FOLLOW):**

**⚠️ ALLERGIES (ZERO TOLERANCE - Complete Avoidance Required):**
${
  allAllergies.size > 0
    ? Array.from(allAllergies)
        .map((a) => `- ${a}`)
        .join("\n")
    : "- None specified"
}

**🥗 DIETARY RESTRICTIONS (MUST COMPLY):**
${
  allDietaryRestrictions.size > 0
    ? Array.from(allDietaryRestrictions)
        .map((dr) => `- ${dr}`)
        .join("\n")
    : "- None specified"
}

**🩺 HEALTH CONDITIONS (Adapt Recipes Accordingly):**
${
  allHealthConditions.size > 0
    ? Array.from(allHealthConditions)
        .map((hc) => `- ${hc}`)
        .join("\n")
    : "- None specified"
}

**🎯 HEALTH GOALS (Optimize For):**
${
  allHealthGoals.size > 0
    ? Array.from(allHealthGoals)
        .map((hg) => `- ${hg}`)
        .join("\n")
    : "- General wellness"
}

**👤 INDIVIDUAL MEMBER PROFILES:**
${healthProfiles
  .map(
    (profile) => `
**${profile.name || "Member " + profile.id}:**
- Allergies: ${profile.allergies.length > 0 ? profile.allergies.join(", ") : "None"}
- Dietary: ${profile.dietaryRestrictions.length > 0 ? profile.dietaryRestrictions.join(", ") : "None"}
- Conditions: ${profile.healthConditions.length > 0 ? profile.healthConditions.join(", ") : "None"}
- Goals: ${profile.healthGoals.length > 0 ? profile.healthGoals.join(", ") : "General wellness"}
`,
  )
  .join("\n")}

**INSTRUCTION:** All recipes MUST be safe for everyone listed above. Include "healthConsiderations" field explaining how the recipe accommodates these needs.`;
  }

  /**
   * Build budget section
   */
  private buildBudgetSection(request: EventRecipePromptRequest): string {
    if (request.budget <= 0) {
      return `**💰 BUDGET:**
No specific budget constraint. Focus on value for money while maintaining quality.`;
    }

    return `**💰 BUDGET CONSTRAINTS (STRICT):**

- **Meal Budget Allocated:** ₹${request.budget} (Total for ${request.mealType})
- **Per Serving Budget:** ₹${request.maxBudgetPerServing?.toFixed(2) || (request.budget / request.servings).toFixed(2)}
- **Total Servings:** ${request.servings}

**BUDGET RULES:**
1. Total recipe cost MUST NOT exceed ₹${request.budget}
2. Use realistic 2025 grocery prices (Indian market if INR)
3. Calculate accurate cost per ingredient
4. Report exact cost breakdown in costAnalysis
5. Prioritize budget efficiency without sacrificing quality`;
  }

  /**
   * Build pantry section (if using pantry items)
   */
  private async buildPantrySection(accountId: string): Promise<string> {
    try {
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

      if (items.length === 0) {
        return "";
      }

      return `**🍳 AVAILABLE PANTRY ITEMS (Prioritize Using These):**

${items.map((item: any) => `- ${item.name}: ${item.quantity} ${item.unit} (${item.category})`).join("\n")}

**PANTRY RULES:**
1. Prioritize using pantry items to reduce costs
2. Mark used pantry items with "isPantryItem": true
3. Calculate savings from pantry usage`;
    } catch (error) {
      console.error("Error fetching pantry items:", error);
      return "";
    }
  }

  /**
   * Build section to avoid duplicate recipes
   */
  private buildAvoidDuplicatesSection(recentMealNames: string[]): string {
    if (recentMealNames.length === 0) {
      return `**🔄 VARIETY:**
No recent event meals to avoid. Focus on variety and occasion appropriateness.`;
    }

    return `**🚫 AVOID THESE RECIPES (Recently Used in Events):**

The following recipes have been served in recent events. DO NOT suggest these or very similar dishes:

${recentMealNames.map((name) => `- "${name}"`).join("\n")}

**INSTRUCTION:** Create fresh, unique recipes that differ from the above list. Avoid similar flavor profiles or preparation methods.`;
  }

  /**
   * Build custom search section
   */
  private buildCustomSearchSection(customSearch: string): string {
    return `**🔍 SPECIFIC RECIPE REQUEST:**

The user has specifically requested: "${customSearch}"

**INSTRUCTION:** 
- Generate recipe(s) matching or closely related to this request
- Maintain authenticity while adapting to health/budget constraints
- If the exact dish cannot be made safely, suggest closest alternatives`;
  }

  /**
   * Build output format section
   */
  private buildOutputFormatSection(request: EventRecipePromptRequest): string {
    return `**📤 OUTPUT FORMAT (JSON ONLY - No additional text):**

Return a JSON array with EXACTLY ${request.recipeCount} recipe object(s):

\`\`\`json
[
    {
        "name": "Recipe Name",
        "description": "2-3 sentence appetizing description highlighting event appropriateness",
        "cuisineType": "Specific cuisine",
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
                "estimatedCost": <number in INR>,
                "category": "produce|pantry|dairy|protein|seafood|meat|bakery|spices|beverages|frozen|other",
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
            "totalCost": <sum in INR>,
            "costPerServing": <totalCost / servings>,
            "budgetEfficiency": <0.0-1.0>,
            "pantryItemsSavings": <optional>
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

**FINAL CHECKLIST:**
✅ Exactly ${request.recipeCount} recipe(s)
✅ Each for ${request.servings} servings
✅ All ingredients have valid categories
✅ Complete nutrition data
✅ Budget constraints met (if specified)
✅ All allergens completely avoided
✅ No duplicates from recent events
✅ Occasion-appropriate
✅ Valid JSON format (no markdown, no extra text)`;
  }
}
