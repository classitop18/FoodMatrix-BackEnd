
```
import "dotenv/config";
import { getDb, connectDatabase } from "./src/database/db.js";
import { recipes } from "./src/database/schemas/schema.js";
import { desc } from "drizzle-orm";

async function main() {
    await connectDatabase();
    const db = getDb();
    console.log("Fetching latest 5 recipes...");

    const results = await db
        .select({
            id: recipes.id,
            name: recipes.name,
            imageUrl: recipes.imageUrl
        })
        .from(recipes)
        .orderBy(desc(recipes.createdAt))
        .limit(5);

    console.log("Results:");
    results.forEach(r => {
        console.log(`ID: ${ r.id } | Name: ${ r.name } | ImageUrl: ${ r.imageUrl } `);
    });

    process.exit(0);
}

main().catch(console.error);
