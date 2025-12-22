/**
 * CLI Runner for Ingredients Seed
 * Run with: npm run db:seed
 */

import { connectDatabase } from "../database/db.js";
import { seedIngredients } from "./run-seed.js";
import { logger } from "../utils/logger.utils.js";

async function main() {
    try {
        logger.info("🔄 Connecting to database...");
        await connectDatabase();

        logger.info("🌱 Running ingredients seed...");
        const result = await seedIngredients();

        logger.info("✅ Seed completed successfully!");
        logger.info(`📊 Results: Inserted ${result.inserted}, Updated ${result.updated}, Skipped ${result.skipped}`);

        process.exit(0);
    } catch (error) {
        logger.error("❌ Seed failed:", error);
        process.exit(1);
    }
}

main();
