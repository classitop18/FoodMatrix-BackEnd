import { getDb } from "../database/db.js";
import { ingredients } from "../database/schemas/schema.js";
import ingredientsData from "./ingredients.js";
import { logger } from "../utils/logger.utils.js";
import { eq } from "drizzle-orm";

/**
 * Seed ingredients into the database
 * This script will:
 * 1. Check if ingredient already exists (by name)
 * 2. Insert new ingredients
 * 3. Update existing ingredients with new data (like defaultMeasurementUnit)
 */
export async function seedIngredients() {
  const db = getDb();

  logger.info("🌱 Starting ingredients seed...");

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const ingredientData of ingredientsData) {
    try {
      // Check if ingredient exists
      const existing = await db
        .select()
        .from(ingredients)
        .where(eq(ingredients.name, ingredientData.name))
        .limit(1);

      if (existing.length > 0) {
        // Update existing ingredient with new fields (like defaultMeasurementUnit)
        await db
          .update(ingredients)
          .set({
            category: ingredientData.category,
            averagePrice: ingredientData.averagePrice,
            averageUnit: ingredientData.averageUnit,
            defaultMeasurementUnit: ingredientData.defaultMeasurementUnit,
            isPerishable: ingredientData.isPerishable,
            shelfLifeDays: ingredientData.shelfLifeDays,
          })
          .where(eq(ingredients.name, ingredientData.name));
        updated++;
      } else {
        // Insert new ingredient
        await db.insert(ingredients).values({
          name: ingredientData.name,
          category: ingredientData.category,
          averagePrice: ingredientData.averagePrice,
          averageUnit: ingredientData.averageUnit,
          defaultMeasurementUnit: ingredientData.defaultMeasurementUnit,
          isPerishable: ingredientData.isPerishable,
          shelfLifeDays: ingredientData.shelfLifeDays,
        });
        inserted++;
      }
    } catch (error: any) {
      // Handle duplicate key errors gracefully
      if (error.code === "23505") {
        skipped++;
      } else {
        logger.error(`Error seeding ingredient ${ingredientData.name}:`, error);
      }
    }
  }

  logger.info(`✅ Ingredients seed completed!`);
  logger.info(`   📊 Inserted: ${inserted}`);
  logger.info(`   🔄 Updated: ${updated}`);
  logger.info(`   ⏭️  Skipped: ${skipped}`);

  return { inserted, updated, skipped };
}

// Run if called directly
// ts-node or via npm script
export default seedIngredients;
