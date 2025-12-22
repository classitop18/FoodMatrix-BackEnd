import { HealthProfileResponseDto } from "./dto/health-profile.dto.js";
import { IHealthCalculator } from "./types/health-profile.types.js";

export class HealthCalculatorService implements IHealthCalculator {
  calculateBMI(weight: number, height: number): number {
    // BMI = weight (lbs) / [height (in)]² × 703
    return (weight / (height * height)) * 703;
  }

  calculateBMICategory(
    bmi: number,
  ): "underweight" | "normal" | "overweight" | "obese" {
    if (bmi < 18.5) return "underweight";
    if (bmi < 25) return "normal";
    if (bmi < 30) return "overweight";
    return "obese";
  }

  calculateDailyCalories(
    weight: number,
    height: number,
    age: number,
    sex: string,
    activityLevel: string,
  ): number {
    // Mifflin-St Jeor Equation
    // Men: (10 × weight in kg) + (6.25 × height in cm) - (5 × age) + 5
    // Women: (10 × weight in kg) + (6.25 × height in cm) - (5 × age) - 161

    const weightKg = weight * 0.453592; // lbs to kg
    const heightCm = height * 2.54; // inches to cm

    let bmr: number;
    if (sex.toLowerCase() === "male") {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
    } else {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
    }

    // Activity multipliers
    const activityMultipliers: Record<string, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9,
    };

    const multiplier = activityMultipliers[activityLevel] || 1.2;
    return Math.round(bmr * multiplier);
  }

  calculateHealthScore(profile: HealthProfileResponseDto): number {
    let score = 50; // Base score

    // BMI Assessment (±20 points)
    if (profile.bmi) {
      const bmi = parseFloat(profile.bmi);
      const category = this.calculateBMICategory(bmi);

      if (category === "normal") {
        score += 20;
      } else if (category === "overweight") {
        score += 5;
      } else if (category === "underweight") {
        score -= 5;
      } else {
        score -= 15;
      }
    }

    // Activity Level (±15 points)
    if (profile.activityLevel) {
      const activityScores: Record<string, number> = {
        sedentary: -10,
        light: 0,
        moderate: 10,
        active: 15,
        very_active: 15,
      };
      score += activityScores[profile.activityLevel] || 0;
    }

    // Health Conditions (±20 points)
    const conditionCount = profile.conditions?.length || 0;
    if (conditionCount === 0) {
      score += 20;
    } else if (conditionCount === 1) {
      score += 5;
    } else if (conditionCount === 2) {
      score -= 5;
    } else {
      score -= 15;
    }

    // Dietary Restrictions managed properly (+10 points)
    if (profile.dietaryRestrictions?.length > 0 && profile.autoSwap) {
      score += 10;
    }

    // Health Goals set (+5 points)
    if (profile.goals?.length > 0) {
      score += 5;
    }

    // Cooking habits (+10 points)
    if (
      profile.cookingFrequency === "daily" ||
      profile.cookingFrequency === "multiple_times_daily"
    ) {
      score += 10;
    } else if (profile.cookingFrequency === "weekly") {
      score += 5;
    }

    // Organic preference (+5 points)
    if (
      profile.organicPreference === "organic_only" ||
      profile.organicPreference === "organic_preferred"
    ) {
      score += 5;
    }

    // Cap score between 0-100
    return Math.max(0, Math.min(100, score));
  }

  assessHealthRisks(profile: HealthProfileResponseDto): string[] {
    const risks: string[] = [];

    // BMI-related risks
    if (profile.bmi) {
      const bmi = parseFloat(profile.bmi);
      const category = this.calculateBMICategory(bmi);

      if (category === "obese") {
        risks.push(
          "High risk of cardiovascular disease, diabetes, and hypertension",
        );
        risks.push("Increased risk of certain cancers");
      } else if (category === "overweight") {
        risks.push(
          "Moderate risk of cardiovascular disease and type 2 diabetes",
        );
      } else if (category === "underweight") {
        risks.push(
          "Risk of nutritional deficiencies and weakened immune system",
        );
      }
    }

    // Condition-specific risks
    if (profile.conditions?.includes("diabetes")) {
      if (!profile.dailyCarbLimitG) {
        risks.push(
          "Carbohydrate intake not being monitored - important for diabetes management",
        );
      }
    }

    if (profile.conditions?.includes("hypertension")) {
      if (profile.dailySodiumLimitMg > 2000) {
        risks.push(
          "Sodium intake limit may be too high for hypertension management",
        );
      }
    }

    if (profile.conditions?.includes("heart_disease")) {
      if (profile.activityLevel === "sedentary") {
        risks.push("Low activity level increases cardiovascular risk");
      }
    }

    // Allergy risks
    if (profile.allergies?.length > 0 && !profile.autoSwap) {
      risks.push(
        "Auto-swap disabled - manual monitoring required for allergens",
      );
    }

    // Lifestyle risks
    if (profile.activityLevel === "sedentary") {
      risks.push(
        "Sedentary lifestyle increases risk of various chronic diseases",
      );
    }

    if (!profile.cookingFrequency || profile.cookingFrequency === "rarely") {
      risks.push(
        "Infrequent home cooking may lead to less control over nutrition",
      );
    }

    return risks;
  }

  generateRecommendations(profile: HealthProfileResponseDto): string[] {
    const recommendations: string[] = [];

    // BMI-based recommendations
    if (profile.bmi) {
      const bmi = parseFloat(profile.bmi);
      const category = this.calculateBMICategory(bmi);

      if (category === "obese" || category === "overweight") {
        recommendations.push("Focus on portion control and balanced meals");
        recommendations.push(
          "Increase physical activity to at least 150 minutes per week",
        );
        recommendations.push(
          "Consider meal planning to maintain consistent healthy eating",
        );
      } else if (category === "underweight") {
        recommendations.push(
          "Increase calorie intake with nutrient-dense foods",
        );
        recommendations.push("Include protein-rich foods in every meal");
        recommendations.push("Consider consulting with a nutritionist");
      } else {
        recommendations.push(
          "Maintain current healthy weight through balanced diet",
        );
      }
    }

    // Activity level recommendations
    if (
      profile.activityLevel === "sedentary" ||
      profile.activityLevel === "light"
    ) {
      recommendations.push(
        "Gradually increase physical activity to at least 30 minutes daily",
      );
      recommendations.push(
        "Try incorporating more active cooking methods like standing meal prep",
      );
    }

    // Condition-specific recommendations
    if (profile.conditions?.includes("diabetes")) {
      recommendations.push("Monitor carbohydrate intake at each meal");
      recommendations.push("Choose low-glycemic index foods");
      recommendations.push(
        "Include fiber-rich foods to help stabilize blood sugar",
      );
    }

    if (profile.conditions?.includes("hypertension")) {
      recommendations.push("Limit sodium intake to under 2000mg per day");
      recommendations.push(
        "Increase potassium-rich foods (bananas, sweet potatoes)",
      );
      recommendations.push("Avoid processed and packaged foods");
    }

    if (profile.conditions?.includes("heart_disease")) {
      recommendations.push(
        "Choose heart-healthy fats (olive oil, avocados, nuts)",
      );
      recommendations.push("Increase omega-3 rich fish consumption");
      recommendations.push("Limit saturated and trans fats");
    }

    // Goal-based recommendations
    if (profile.goals?.includes("lose_weight")) {
      recommendations.push("Create a consistent meal schedule");
      recommendations.push(
        "Plan meals in advance to avoid impulsive food choices",
      );
      recommendations.push("Focus on whole, unprocessed foods");
    }

    if (profile.goals?.includes("build_muscle")) {
      recommendations.push(
        "Ensure adequate protein intake (0.8-1g per lb of body weight)",
      );
      recommendations.push("Time protein intake around physical activity");
      recommendations.push("Include strength training 3-4 times per week");
    }

    if (profile.goals?.includes("improve_energy")) {
      recommendations.push("Maintain regular meal times");
      recommendations.push(
        "Include complex carbohydrates for sustained energy",
      );
      recommendations.push("Stay hydrated throughout the day");
    }

    // Cooking and lifestyle recommendations
    if (
      profile.cookingSkill === "beginner" ||
      profile.cookingSkill === "novice"
    ) {
      recommendations.push("Start with simple, 3-5 ingredient recipes");
      recommendations.push("Use meal prep to build cooking confidence");
    }

    if (!profile.hasDeepFreezer) {
      recommendations.push(
        "Plan for more frequent shopping trips or focus on fresh ingredients",
      );
    }

    if (profile.budgetFlexibility === "strict") {
      recommendations.push("Focus on seasonal produce for better prices");
      recommendations.push("Buy in bulk for commonly used items");
      recommendations.push(
        "Consider frozen vegetables as cost-effective alternatives",
      );
    }

    // General recommendations
    recommendations.push(
      "Track your meals and notice how different foods affect you",
    );
    recommendations.push(
      "Stay consistent with healthy habits rather than seeking perfection",
    );

    return recommendations.slice(0, 8); // Return top 8 recommendations
  }
}
