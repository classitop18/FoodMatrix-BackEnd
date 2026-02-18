import { EventAIService } from "../modules/event/services/event-ai.service.js";
import { MealType } from "../modules/event/types/event.types.js";

// Mock AI Provider
const mockAIProvider = {
  createCompletion: async (params: any) => {
    console.log("Mock AI received prompt:", params.prompt);
    // Return a JSON string directly to simulate AI response
    // The service handles raw JSON or markdown wrapped JSON
    return {
      content: JSON.stringify({
        allocations: [
          {
            mealType: "dinner",
            percentage: 50,
            reasoning: "Main meal",
            categoryBreakdown: {
              starter: 20,
              main_course: 60,
              dessert: 20,
            },
          },
          {
            mealType: "breakfast",
            percentage: 50,
            reasoning: "Start of day",
            categoryBreakdown: {
              main_course: 100,
            },
          },
        ],
        recommendations: ["Good luck"],
      }),
    };
  },
  generateImage: async () => "http://image.url",
  getProviderName: () => "MockProvider",
};

// Mock Repos
const mockEventRepo = {
  findById: async () => ({
    id: "evt-123",
    name: "Test Event",
    occasionType: "Dinner Party",
    budget: { totalBudget: 100, currency: "USD" },
    participants: [],
    selectedMealTypes: ["breakfast", "diet"],
  }),
  getMealsByEventId: async () => [],
  updateMeal: async () => {},
  createMeal: async () => ({ id: "meal-123" }),
} as any;

const mockMemberRepo = {
  findHealthProfilesByMemberIds: async () => [],
} as any;

async function runVerification() {
  const service = new EventAIService(mockEventRepo, mockMemberRepo);
  (service as any).aiProvider = mockAIProvider; // Inject mock

  console.log("Testing suggestBudgetAllocation...");

  const result = await service.suggestBudgetAllocation({
    eventId: "evt-123",
    accountId: "acc-123",
    requesterId: "usr-123",
    mealTypes: ["dinner" as MealType, "breakfast" as MealType],
    activeCategories: {
      dinner: ["starter", "main_course", "dessert"],
      breakfast: ["main_course"],
    } as any,
  });

  console.log("Result:", JSON.stringify(result, null, 2));

  // Assertions
  const dinner = result.allocations.find((a) => a.mealType === "dinner");
  // The service parses the JSON string back into an object
  // We need to check if categoryBreakdown is present on the result object
  // Note: The service interface defines categoryBreakdown as optional on MealBudgetAllocation
  if (dinner?.categoryBreakdown?.starter === 20) {
    console.log("SUCCESS: Dinner starter has correct breakdown");
  } else {
    console.error("FAILURE: Dinner starter breakdown mismatch or missing");
    console.error("Dinner object:", JSON.stringify(dinner, null, 2));
  }
}

runVerification();
