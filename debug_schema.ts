import { eventExtraItems } from "./src/database/schemas/schema.js";
import { getTableColumns } from "drizzle-orm";

console.log("--- DEBUG START ---");
const columns = getTableColumns(eventExtraItems);
Object.keys(columns).forEach((key) => {
  console.log(`Key: "${key}", Name: "${columns[key].name}"`);
});
console.log("--- DEBUG END ---");
