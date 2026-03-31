import axios from "axios";

interface PricedItem {
  ingredientName: string;
  quantity: string;
  unit: string;
  category: string;
  retailQuantity: number;
  retailUnit: string;
  estimatedPrice: number | null;
  priceUnavailable: boolean;
  priceSource: "kroger" | "curated_db" | "unavailable";
  displayQuantity: string;
  displayUnit: string;
  imageUrl?: string;
  sourceUnit?: string;
}

/**
 * Curated real-world USA grocery price database (2025 market avg).
 * Prices represent the MINIMUM purchasable unit from mainstream US stores
 * (Walmart, Kroger, Aldi, Target). Updated periodically.
 *
 * Format: { [itemKey]: { price: USD, unit: retail_unit, quantity: number } }
 */
const CURATED_PRICE_DB: Record<
  string,
  { price: number; unit: string; quantity: number; retailUnit: string }
> = {
  // ── Spices & Condiments (standard packet/bottle)
  salt: { price: 0.79, unit: "packet", quantity: 1, retailUnit: "packet" },
  "table salt": {
    price: 0.79,
    unit: "packet",
    quantity: 1,
    retailUnit: "packet",
  },
  pepper: { price: 1.49, unit: "packet", quantity: 1, retailUnit: "packet" },
  "black pepper": {
    price: 1.49,
    unit: "packet",
    quantity: 1,
    retailUnit: "packet",
  },
  turmeric: { price: 1.99, unit: "packet", quantity: 1, retailUnit: "packet" },
  cumin: { price: 1.79, unit: "packet", quantity: 1, retailUnit: "packet" },
  "cumin powder": {
    price: 1.79,
    unit: "packet",
    quantity: 1,
    retailUnit: "packet",
  },
  coriander: { price: 1.59, unit: "packet", quantity: 1, retailUnit: "packet" },
  "coriander powder": {
    price: 1.59,
    unit: "packet",
    quantity: 1,
    retailUnit: "packet",
  },
  paprika: { price: 1.89, unit: "packet", quantity: 1, retailUnit: "packet" },
  "chili powder": {
    price: 1.49,
    unit: "packet",
    quantity: 1,
    retailUnit: "packet",
  },
  "red chili": {
    price: 1.49,
    unit: "packet",
    quantity: 1,
    retailUnit: "packet",
  },
  "cayenne pepper": {
    price: 1.69,
    unit: "packet",
    quantity: 1,
    retailUnit: "packet",
  },
  cinnamon: { price: 1.99, unit: "packet", quantity: 1, retailUnit: "packet" },
  "garam masala": {
    price: 2.49,
    unit: "packet",
    quantity: 1,
    retailUnit: "packet",
  },
  oregano: { price: 1.49, unit: "packet", quantity: 1, retailUnit: "packet" },
  basil: { price: 1.59, unit: "packet", quantity: 1, retailUnit: "packet" },
  thyme: { price: 1.59, unit: "packet", quantity: 1, retailUnit: "packet" },
  rosemary: { price: 1.69, unit: "packet", quantity: 1, retailUnit: "packet" },
  "bay leaf": {
    price: 1.29,
    unit: "packet",
    quantity: 1,
    retailUnit: "packet",
  },
  "bay leaves": {
    price: 1.29,
    unit: "packet",
    quantity: 1,
    retailUnit: "packet",
  },
  "baking powder": {
    price: 1.29,
    unit: "packet",
    quantity: 1,
    retailUnit: "packet",
  },
  "baking soda": {
    price: 0.99,
    unit: "packet",
    quantity: 1,
    retailUnit: "packet",
  },
  yeast: { price: 1.49, unit: "packet", quantity: 1, retailUnit: "packet" },
  vanilla: { price: 3.49, unit: "bottle", quantity: 1, retailUnit: "bottle" },
  "vanilla extract": {
    price: 3.49,
    unit: "bottle",
    quantity: 1,
    retailUnit: "bottle",
  },

  // ── Oils & Liquids (bottle)
  oil: { price: 3.99, unit: "bottle", quantity: 1, retailUnit: "bottle" },
  "olive oil": {
    price: 5.99,
    unit: "bottle",
    quantity: 1,
    retailUnit: "bottle",
  },
  "vegetable oil": {
    price: 3.49,
    unit: "bottle",
    quantity: 1,
    retailUnit: "bottle",
  },
  "cooking oil": {
    price: 3.49,
    unit: "bottle",
    quantity: 1,
    retailUnit: "bottle",
  },
  "canola oil": {
    price: 3.29,
    unit: "bottle",
    quantity: 1,
    retailUnit: "bottle",
  },
  "sesame oil": {
    price: 4.99,
    unit: "bottle",
    quantity: 1,
    retailUnit: "bottle",
  },
  "coconut oil": {
    price: 5.49,
    unit: "bottle",
    quantity: 1,
    retailUnit: "bottle",
  },
  vinegar: { price: 2.49, unit: "bottle", quantity: 1, retailUnit: "bottle" },
  "soy sauce": {
    price: 2.99,
    unit: "bottle",
    quantity: 1,
    retailUnit: "bottle",
  },
  "hot sauce": {
    price: 2.49,
    unit: "bottle",
    quantity: 1,
    retailUnit: "bottle",
  },
  ketchup: { price: 2.99, unit: "bottle", quantity: 1, retailUnit: "bottle" },
  mustard: { price: 1.99, unit: "bottle", quantity: 1, retailUnit: "bottle" },
  "soy milk": { price: 3.49, unit: "litre", quantity: 1, retailUnit: "litre" },

  // ── Dairy (standard retail units)
  milk: { price: 3.89, unit: "litre", quantity: 1, retailUnit: "litre" },
  "whole milk": {
    price: 3.89,
    unit: "litre",
    quantity: 1,
    retailUnit: "litre",
  },
  butter: { price: 4.99, unit: "packet", quantity: 1, retailUnit: "packet" },
  cheese: { price: 3.99, unit: "packet", quantity: 1, retailUnit: "packet" },
  "cheddar cheese": {
    price: 4.49,
    unit: "packet",
    quantity: 1,
    retailUnit: "packet",
  },
  "mozzarella cheese": {
    price: 3.99,
    unit: "packet",
    quantity: 1,
    retailUnit: "packet",
  },
  "cream cheese": {
    price: 3.49,
    unit: "packet",
    quantity: 1,
    retailUnit: "packet",
  },
  "sour cream": {
    price: 2.49,
    unit: "packet",
    quantity: 1,
    retailUnit: "packet",
  },
  yogurt: { price: 1.49, unit: "pieces", quantity: 1, retailUnit: "pieces" },
  "heavy cream": {
    price: 3.99,
    unit: "litre",
    quantity: 1,
    retailUnit: "litre",
  },
  "whipping cream": {
    price: 3.99,
    unit: "litre",
    quantity: 1,
    retailUnit: "litre",
  },
  egg: {
    price: 4.29,
    unit: "pieces",
    quantity: 12,
    retailUnit: "pieces (dozen)",
  },
  eggs: {
    price: 4.29,
    unit: "pieces",
    quantity: 12,
    retailUnit: "pieces (dozen)",
  },

  // ── Grains & Pantry (kg / lb)
  rice: { price: 2.49, unit: "kg", quantity: 1, retailUnit: "kg" },
  "white rice": { price: 2.49, unit: "kg", quantity: 1, retailUnit: "kg" },
  "brown rice": { price: 2.99, unit: "kg", quantity: 1, retailUnit: "kg" },
  flour: { price: 2.99, unit: "kg", quantity: 1, retailUnit: "kg" },
  "all-purpose flour": {
    price: 2.99,
    unit: "kg",
    quantity: 1,
    retailUnit: "kg",
  },
  sugar: { price: 2.49, unit: "kg", quantity: 1, retailUnit: "kg" },
  "brown sugar": { price: 2.69, unit: "kg", quantity: 1, retailUnit: "kg" },
  "powdered sugar": { price: 2.49, unit: "kg", quantity: 1, retailUnit: "kg" },
  pasta: { price: 1.49, unit: "packet", quantity: 1, retailUnit: "packet" },
  spaghetti: { price: 1.49, unit: "packet", quantity: 1, retailUnit: "packet" },
  noodles: { price: 1.29, unit: "packet", quantity: 1, retailUnit: "packet" },
  oats: { price: 3.49, unit: "kg", quantity: 1, retailUnit: "kg" },
  bread: { price: 2.99, unit: "loaf", quantity: 1, retailUnit: "loaf" },
  quinoa: { price: 4.99, unit: "kg", quantity: 1, retailUnit: "kg" },
  lentils: { price: 2.29, unit: "kg", quantity: 1, retailUnit: "kg" },
  chickpeas: { price: 1.99, unit: "can", quantity: 1, retailUnit: "can" },
  "kidney beans": { price: 1.79, unit: "can", quantity: 1, retailUnit: "can" },
  "black beans": { price: 1.79, unit: "can", quantity: 1, retailUnit: "can" },
  "canned tomatoes": {
    price: 1.49,
    unit: "can",
    quantity: 1,
    retailUnit: "can",
  },
  "tomato sauce": { price: 1.99, unit: "can", quantity: 1, retailUnit: "can" },
  "tomato paste": { price: 0.99, unit: "can", quantity: 1, retailUnit: "can" },
  "coconut milk": { price: 2.29, unit: "can", quantity: 1, retailUnit: "can" },
  broth: { price: 2.49, unit: "litre", quantity: 1, retailUnit: "litre" },
  "chicken broth": {
    price: 2.49,
    unit: "litre",
    quantity: 1,
    retailUnit: "litre",
  },
  "vegetable broth": {
    price: 2.49,
    unit: "litre",
    quantity: 1,
    retailUnit: "litre",
  },
  cornstarch: {
    price: 1.79,
    unit: "packet",
    quantity: 1,
    retailUnit: "packet",
  },
  "corn starch": {
    price: 1.79,
    unit: "packet",
    quantity: 1,
    retailUnit: "packet",
  },
  breadcrumbs: {
    price: 2.49,
    unit: "packet",
    quantity: 1,
    retailUnit: "packet",
  },
  "panko breadcrumbs": {
    price: 2.99,
    unit: "packet",
    quantity: 1,
    retailUnit: "packet",
  },
  honey: { price: 4.99, unit: "bottle", quantity: 1, retailUnit: "bottle" },
  "maple syrup": {
    price: 5.99,
    unit: "bottle",
    quantity: 1,
    retailUnit: "bottle",
  },

  // ── Produce (kg)
  tomato: { price: 2.49, unit: "kg", quantity: 1, retailUnit: "kg" },
  tomatoes: { price: 2.49, unit: "kg", quantity: 1, retailUnit: "kg" },
  onion: { price: 1.49, unit: "kg", quantity: 1, retailUnit: "kg" },
  onions: { price: 1.49, unit: "kg", quantity: 1, retailUnit: "kg" },
  garlic: { price: 0.79, unit: "pieces", quantity: 1, retailUnit: "bulb" },
  potato: { price: 1.29, unit: "kg", quantity: 1, retailUnit: "kg" },
  potatoes: { price: 1.29, unit: "kg", quantity: 1, retailUnit: "kg" },
  carrot: { price: 1.29, unit: "kg", quantity: 1, retailUnit: "kg" },
  carrots: { price: 1.29, unit: "kg", quantity: 1, retailUnit: "kg" },
  celery: { price: 1.99, unit: "pieces", quantity: 1, retailUnit: "bunch" },
  spinach: { price: 2.99, unit: "kg", quantity: 0.28, retailUnit: "bag" },
  lettuce: { price: 1.99, unit: "pieces", quantity: 1, retailUnit: "head" },
  broccoli: { price: 2.49, unit: "pieces", quantity: 1, retailUnit: "head" },
  cauliflower: { price: 2.99, unit: "pieces", quantity: 1, retailUnit: "head" },
  cucumber: { price: 0.99, unit: "pieces", quantity: 1, retailUnit: "pieces" },
  "bell pepper": {
    price: 1.49,
    unit: "pieces",
    quantity: 1,
    retailUnit: "pieces",
  },
  "green pepper": {
    price: 1.29,
    unit: "pieces",
    quantity: 1,
    retailUnit: "pieces",
  },
  "red pepper": {
    price: 1.69,
    unit: "pieces",
    quantity: 1,
    retailUnit: "pieces",
  },
  zucchini: { price: 1.49, unit: "pieces", quantity: 1, retailUnit: "pieces" },
  eggplant: { price: 1.99, unit: "pieces", quantity: 1, retailUnit: "pieces" },
  mushroom: { price: 2.49, unit: "kg", quantity: 0.23, retailUnit: "punnet" },
  mushrooms: { price: 2.49, unit: "kg", quantity: 0.23, retailUnit: "punnet" },
  corn: { price: 0.79, unit: "pieces", quantity: 1, retailUnit: "pieces" },
  "green beans": { price: 1.99, unit: "kg", quantity: 0.35, retailUnit: "bag" },
  asparagus: { price: 3.99, unit: "kg", quantity: 0.5, retailUnit: "bunch" },
  "sweet potato": { price: 1.79, unit: "kg", quantity: 1, retailUnit: "kg" },
  "sweet potatoes": { price: 1.79, unit: "kg", quantity: 1, retailUnit: "kg" },
  peas: { price: 2.49, unit: "kg", quantity: 0.45, retailUnit: "bag" },
  "green peas": { price: 2.49, unit: "kg", quantity: 0.45, retailUnit: "bag" },
  kale: { price: 2.49, unit: "pieces", quantity: 1, retailUnit: "bunch" },
  cilantro: { price: 0.99, unit: "pieces", quantity: 1, retailUnit: "bunch" },
  "fresh coriander": {
    price: 0.99,
    unit: "pieces",
    quantity: 1,
    retailUnit: "bunch",
  },
  parsley: { price: 0.99, unit: "pieces", quantity: 1, retailUnit: "bunch" },
  lemon: { price: 0.79, unit: "pieces", quantity: 1, retailUnit: "pieces" },
  lemons: { price: 0.79, unit: "pieces", quantity: 1, retailUnit: "pieces" },
  lime: { price: 0.59, unit: "pieces", quantity: 1, retailUnit: "pieces" },
  limes: { price: 0.59, unit: "pieces", quantity: 1, retailUnit: "pieces" },
  apple: { price: 0.89, unit: "pieces", quantity: 1, retailUnit: "pieces" },
  banana: { price: 0.29, unit: "pieces", quantity: 1, retailUnit: "pieces" },
  strawberry: { price: 3.99, unit: "kg", quantity: 0.45, retailUnit: "punnet" },
  strawberries: {
    price: 3.99,
    unit: "kg",
    quantity: 0.45,
    retailUnit: "punnet",
  },
  blueberry: { price: 3.49, unit: "kg", quantity: 0.17, retailUnit: "punnet" },
  blueberries: {
    price: 3.49,
    unit: "kg",
    quantity: 0.17,
    retailUnit: "punnet",
  },
  "cherry tomatoes": {
    price: 2.99,
    unit: "pieces",
    quantity: 1,
    retailUnit: "punnet",
  },
  avocado: { price: 1.29, unit: "pieces", quantity: 1, retailUnit: "pieces" },
  ginger: { price: 0.99, unit: "kg", quantity: 0.1, retailUnit: "piece" },

  // ── Proteins (kg / pieces)
  chicken: { price: 8.99, unit: "kg", quantity: 1, retailUnit: "kg" },
  "chicken breast": { price: 8.99, unit: "kg", quantity: 1, retailUnit: "kg" },
  "chicken thighs": { price: 6.99, unit: "kg", quantity: 1, retailUnit: "kg" },
  "ground chicken": { price: 6.99, unit: "kg", quantity: 1, retailUnit: "kg" },
  beef: { price: 9.99, unit: "kg", quantity: 1, retailUnit: "kg" },
  "ground beef": { price: 6.99, unit: "kg", quantity: 1, retailUnit: "kg" },
  steak: { price: 12.99, unit: "kg", quantity: 1, retailUnit: "kg" },
  pork: { price: 7.99, unit: "kg", quantity: 1, retailUnit: "kg" },
  "pork chops": { price: 7.99, unit: "kg", quantity: 1, retailUnit: "kg" },
  bacon: { price: 5.99, unit: "packet", quantity: 1, retailUnit: "packet" },
  salmon: { price: 13.99, unit: "kg", quantity: 1, retailUnit: "kg" },
  tuna: { price: 1.49, unit: "can", quantity: 1, retailUnit: "can" },
  shrimp: { price: 11.99, unit: "kg", quantity: 1, retailUnit: "kg" },
  tilapia: { price: 7.99, unit: "kg", quantity: 1, retailUnit: "kg" },
  tofu: { price: 2.49, unit: "packet", quantity: 1, retailUnit: "packet" },
  tempeh: { price: 3.49, unit: "packet", quantity: 1, retailUnit: "packet" },

  // ── Nuts & Seeds
  "peanut butter": {
    price: 3.99,
    unit: "bottle",
    quantity: 1,
    retailUnit: "jar",
  },
  almonds: { price: 7.99, unit: "kg", quantity: 0.45, retailUnit: "bag" },
  walnuts: { price: 8.99, unit: "kg", quantity: 0.45, retailUnit: "bag" },
  cashews: { price: 9.99, unit: "kg", quantity: 0.45, retailUnit: "bag" },
  "chia seeds": {
    price: 5.99,
    unit: "packet",
    quantity: 1,
    retailUnit: "packet",
  },
  "sesame seeds": {
    price: 2.99,
    unit: "packet",
    quantity: 1,
    retailUnit: "packet",
  },
  "flax seeds": {
    price: 3.99,
    unit: "packet",
    quantity: 1,
    retailUnit: "packet",
  },

  // ── Beverages
  water: { price: 0.0, unit: "litre", quantity: 1, retailUnit: "litre" },
};

/**
 * Unit normalization: converts cooking units to retail purchasable units
 */
const UNIT_CONVERSION: Record<string, { factor: number; targetUnit: string }> =
  {
    // Small weight measurements
    tsp: { factor: 0.005, targetUnit: "kg" }, // ~5g
    tbsp: { factor: 0.015, targetUnit: "kg" }, // ~15g
    teaspoon: { factor: 0.005, targetUnit: "kg" },
    tablespoon: { factor: 0.015, targetUnit: "kg" },
    // Weight
    g: { factor: 0.001, targetUnit: "kg" },
    gram: { factor: 0.001, targetUnit: "kg" },
    grams: { factor: 0.001, targetUnit: "kg" },
    oz: { factor: 0.02835, targetUnit: "kg" },
    lb: { factor: 0.4536, targetUnit: "kg" },
    pound: { factor: 0.4536, targetUnit: "kg" },
    pounds: { factor: 0.4536, targetUnit: "kg" },
    kg: { factor: 1, targetUnit: "kg" },
    // Volume
    ml: { factor: 0.001, targetUnit: "litre" },
    milliliter: { factor: 0.001, targetUnit: "litre" },
    millilitre: { factor: 0.001, targetUnit: "litre" },
    l: { factor: 1, targetUnit: "litre" },
    liter: { factor: 1, targetUnit: "litre" },
    litre: { factor: 1, targetUnit: "litre" },
    liters: { factor: 1, targetUnit: "litre" },
    litres: { factor: 1, targetUnit: "litre" },
    cup: { factor: 0.237, targetUnit: "litre" },
    cups: { factor: 0.237, targetUnit: "litre" },
    floz: { factor: 0.02957, targetUnit: "litre" },
    "fl oz": { factor: 0.02957, targetUnit: "litre" },
    // Count
    piece: { factor: 1, targetUnit: "pieces" },
    pieces: { factor: 1, targetUnit: "pieces" },
    pcs: { factor: 1, targetUnit: "pieces" },
    slice: { factor: 1, targetUnit: "pieces" },
    slices: { factor: 1, targetUnit: "pieces" },
    clove: { factor: 1, targetUnit: "pieces" }, // garlic clove ≈ 1 piece
    cloves: { factor: 1, targetUnit: "pieces" },
    whole: { factor: 1, targetUnit: "pieces" },
    unit: { factor: 1, targetUnit: "pieces" },
    can: { factor: 1, targetUnit: "can" },
    jar: { factor: 1, targetUnit: "bottle" },
    bottle: { factor: 1, targetUnit: "bottle" },
    packet: { factor: 1, targetUnit: "packet" },
    pack: { factor: 1, targetUnit: "packet" },
    bunch: { factor: 1, targetUnit: "pieces" },
    pinch: { factor: 0.0003, targetUnit: "kg" }, // ~0.3g
    dash: { factor: 0.0006, targetUnit: "litre" }, // ~0.6ml
    handful: { factor: 0.03, targetUnit: "kg" }, // ~30g
    stick: { factor: 0.113, targetUnit: "kg" }, // butter stick = 113g
    bag: { factor: 1, targetUnit: "packet" },
  };

/**
 * Liquid items: ingredients that should be measured in volume when possible
 */
const LIQUID_ITEMS = new Set([
  "oil",
  "olive oil",
  "vegetable oil",
  "coconut oil",
  "sesame oil",
  "canola oil",
  "cooking oil",
  "milk",
  "soy milk",
  "cream",
  "heavy cream",
  "whipping cream",
  "broth",
  "chicken broth",
  "vegetable broth",
  "vinegar",
  "soy sauce",
  "ketchup",
  "mustard",
  "hot sauce",
  "water",
  "vanilla",
  "vanilla extract",
  "honey",
  "maple syrup",
  "coconut milk",
]);

/**
 * Spice/pantry items: typically sold in packets and tiny amounts needed
 */
const SPICE_ITEMS = new Set([
  "salt",
  "table salt",
  "pepper",
  "black pepper",
  "turmeric",
  "cumin",
  "cumin powder",
  "coriander powder",
  "paprika",
  "chili powder",
  "red chili",
  "cayenne pepper",
  "cinnamon",
  "garam masala",
  "oregano",
  "basil",
  "thyme",
  "rosemary",
  "baking powder",
  "baking soda",
  "cornstarch",
  "corn starch",
  "yeast",
]);

export class GroceryPricingService {
  private krogerToken: string | null = null;
  private krogerTokenExpiry: number = 0;
  private krogerTokenPromise: Promise<void> | null = null;
  private krogerLocationId: string | null = null;
  private krogerAuthFailed: boolean = false;

  constructor() {}

  /**
   * Main entry point: Enriches a list of shopping list items with real prices.
   * @param items - Items to price
   * @param options.skipUnitNormalization - true when items are already in retail units
   *   (e.g. from AI merge step). Skips unit conversion, uses quantity/unit as-is.
   */
  async enrichWithPrices(
    items: Array<{
      ingredientName: string;
      quantity: string;
      unit: string;
      category: string;
      displayQuantity?: string;
      displayUnit?: string;
    }>,
    options: { skipUnitNormalization?: boolean } = {},
  ): Promise<PricedItem[]> {
    const results = await Promise.all(
      items.map((item) =>
        this.processItem(item, options.skipUnitNormalization ?? false),
      ),
    );
    return results;
  }

  /**
   * Process a single item: normalize name, convert unit, price it
   * @param skipUnitNormalization - when true, skip convertToRetailUnit and use item qty/unit directly
   */
  private async processItem(
    item: {
      ingredientName: string;
      quantity: string;
      unit: string;
      category: string;
      displayQuantity?: string;
      displayUnit?: string;
    },
    skipUnitNormalization = false,
  ): Promise<PricedItem> {
    const normalizedName = this.normalizeName(item.ingredientName);

    let retailQuantity: number;
    let retailUnit: string;

    if (skipUnitNormalization) {
      // Items already in retail units (e.g. from AI merge) — trust them directly
      retailQuantity = parseFloat(item.displayQuantity || item.quantity) || 1;
      retailUnit = (item.displayUnit || item.unit || "piece").toLowerCase();
    } else {
      const converted = this.convertToRetailUnit(
        normalizedName,
        parseFloat(item.quantity) || 1,
        item.unit,
      );
      retailQuantity = converted.retailQuantity;
      retailUnit = converted.retailUnit;
    }

    // Generate display values
    const displayQuantity =
      item.displayQuantity || this.formatQuantity(retailQuantity);
    const displayUnit =
      item.displayUnit || this.formatRetailUnit(retailUnit, normalizedName);

    // Try Kroger API first, then fallback to curated DB
    let estimatedPrice: number | null = null;
    let priceSource: PricedItem["priceSource"] = "unavailable";
    let imageUrl: string | undefined;
    let sourceUnit: string | undefined;

    // 1. Try Kroger if configured
    let krogerResult: {
      price: number;
      unit: string;
      imageUrl: string;
      basePrice: number;
    } | null = null;

    if (process.env.KROGER_CLIENT_ID && process.env.KROGER_CLIENT_SECRET) {
      try {
        krogerResult = await this.fetchKrogerPrice(
          normalizedName,
          retailQuantity,
          retailUnit,
        );
        if (krogerResult !== null) {
          estimatedPrice = krogerResult.price;
          priceSource = "kroger";
          imageUrl = krogerResult.imageUrl;
          sourceUnit = krogerResult.unit;
        }
        console.log({ krogerResult });
      } catch (err) {
        console.warn(
          `⚠️ Kroger price fetch failed for "${normalizedName}":`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    // 2. Fallback to curated price DB
    if (estimatedPrice === null) {
      const curatedResult = this.fetchCuratedPrice(
        normalizedName,
        retailQuantity,
        retailUnit,
      );
      if (curatedResult !== null) {
        estimatedPrice = curatedResult;
        priceSource = "curated_db";
      }
    }

    // Update display unit with specific price info if available
    let finalDisplayUnit = displayUnit;
    if (priceSource === "kroger" && sourceUnit && krogerResult) {
      // Format: "kg (Kroger: $20.00 for 1.5 lb | Est: $6.67)"
      finalDisplayUnit = `${displayUnit} (Kroger: $${krogerResult.basePrice.toFixed(2)} for ${sourceUnit} | Est: $${krogerResult.price.toFixed(2)})`;
    }

    return {
      ingredientName: normalizedName,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category || "Other",
      retailQuantity,
      retailUnit,
      estimatedPrice,
      priceUnavailable: estimatedPrice === null,
      priceSource,
      displayQuantity,
      displayUnit: finalDisplayUnit,
      imageUrl,
      sourceUnit,
    };
  }

  /**
   * Normalize ingredient name: lowercase, strip adjectives, standardize
   */
  private normalizeName(name: string): string {
    const normalized = name
      .toLowerCase()
      .trim()
      .replace(
        /\b(fresh|dried|frozen|organic|raw|cooked|large|medium|small|extra|whole|boneless|skinless|minced|diced|chopped|sliced|grated|shredded)\b/g,
        "",
      )
      .replace(/\s+/g, " ")
      .trim();

    // Common aliases
    const aliases: Record<string, string> = {
      "egg white": "egg",
      "egg yolk": "egg",
      "all purpose flour": "all-purpose flour",
      "plain flour": "flour",
      "self raising flour": "flour",
      "cooking oil": "vegetable oil",
      "refined oil": "vegetable oil",
      "groundnut oil": "vegetable oil",
      "corn oil": "vegetable oil",
      "sunflower oil": "vegetable oil",
      "red chilly": "red chili",
      "hot pepper": "red chili",
      "spring onion": "onion",
      scallion: "onion",
      "green onion": "onion",
      "yellow onion": "onion",
      "white onion": "onion",
      "red onion": "onion",
      shallot: "onion",
      "cherry tomato": "cherry tomatoes",
      capsicum: "bell pepper",
      aubergine: "eggplant",
      ladyfinger: "okra",
      groundnut: "peanut",
      peanuts: "peanut butter",
      paneer: "cheese",
      curd: "yogurt",
      cream: "heavy cream",
      stock: "broth",
      "chicken stock": "chicken broth",
      "vegetable stock": "vegetable broth",
      "beef stock": "broth",
      "canned tomato": "canned tomatoes",
      "diced tomatoes": "canned tomatoes",
      "crushed tomatoes": "canned tomatoes",
    };

    return aliases[normalized] || normalized;
  }

  /**
   * Convert cooking unit to minimum retail purchasable quantity
   */
  private convertToRetailUnit(
    itemName: string,
    quantity: number,
    unit: string,
  ): { retailQuantity: number; retailUnit: string } {
    const unitLower = unit.toLowerCase().trim();
    const conv = UNIT_CONVERSION[unitLower];

    // Spice items: always return 1 packet regardless of amount used
    if (SPICE_ITEMS.has(itemName)) {
      return { retailQuantity: 1, retailUnit: "packet" };
    }

    // Garlic: always return minimum bulb
    if (itemName === "garlic" || itemName === "garlic clove") {
      return { retailQuantity: 1, retailUnit: "bulb" };
    }

    // Ginger: always return minimum piece
    if (itemName === "ginger") {
      return { retailQuantity: 1, retailUnit: "piece" };
    }

    // Bay leaf/leaves: always 1 packet
    if (itemName.includes("bay leaf") || itemName.includes("bay leaves")) {
      return { retailQuantity: 1, retailUnit: "packet" };
    }

    if (!conv) {
      // Unknown unit — treat as pieces or packet
      return { retailQuantity: Math.ceil(quantity), retailUnit: "pieces" };
    }

    const asBase = quantity * conv.factor;
    const targetUnit = conv.targetUnit;

    // For liquid items: return in litre
    if (targetUnit === "litre" && LIQUID_ITEMS.has(itemName)) {
      // Minimum 1 bottle/litre
      const litres = Math.max(asBase, 0.001);
      // Round up to standard bottle sizes: 0.25L, 0.5L, 1L
      if (litres <= 0.5) return { retailQuantity: 1, retailUnit: "bottle" };
      return { retailQuantity: 1, retailUnit: "bottle" };
    }

    if (targetUnit === "kg") {
      // Round up to nearest 0.25 kg, minimum 0.25 kg
      const kgs = Math.max(asBase, 0.001);
      const rounded = Math.ceil(kgs / 0.25) * 0.25;
      // Below 0.5 kg — return minimum unit appropriate to item
      if (rounded <= 0.5) {
        // Produce items sold per piece
        const produceByPiece = [
          "tomato",
          "onion",
          "potato",
          "carrot",
          "lemon",
          "lime",
          "apple",
          "banana",
          "avocado",
          "cucumber",
          "zucchini",
          "eggplant",
          "bell pepper",
          "green pepper",
          "red pepper",
          "corn",
          "egg",
          "eggs",
        ];
        if (produceByPiece.includes(itemName)) {
          // Convert kg to approximate pieces (avg weight ~150-200g)
          const pieces = Math.max(1, Math.ceil(kgs / 0.15));
          return { retailQuantity: pieces, retailUnit: "pieces" };
        }
        return { retailQuantity: rounded, retailUnit: "kg" };
      }
      return { retailQuantity: rounded, retailUnit: "kg" };
    }

    if (targetUnit === "litre") {
      const litres = Math.max(asBase, 0.001);
      if (litres < 1) return { retailQuantity: 1, retailUnit: "litre" };
      return {
        retailQuantity: Math.ceil(litres),
        retailUnit: "litre",
      };
    }

    if (
      targetUnit === "pieces" ||
      targetUnit === "can" ||
      targetUnit === "bottle" ||
      targetUnit === "packet"
    ) {
      return {
        retailQuantity: Math.max(1, Math.ceil(quantity * conv.factor)),
        retailUnit: targetUnit,
      };
    }

    return {
      retailQuantity: Math.max(1, Math.ceil(asBase)),
      retailUnit: targetUnit,
    };
  }

  /**
   * Fetch price from Kroger API (official free tier, requires OAuth2 credentials)
   */

  private async fetchKrogerPrice(
    itemName: string,
    retailQuantity: number,
    retailUnit: string,
  ): Promise<{
    price: number;
    unit: string;
    imageUrl: string;
    basePrice: number;
  } | null> {
    try {
      if (this.krogerAuthFailed) {
        console.log(
          `[Kroger] ❌ Auth previously failed, skipping for: ${itemName}`,
        );
        return null;
      }

      await this.ensureKrogerToken();
      if (!this.krogerToken) {
        console.log(`[Kroger] ❌ No token available for: ${itemName}`);
        return null;
      }

      console.log(
        `[Kroger] ✅ Token present: ${this.krogerToken.substring(0, 20)}...`,
      );

      const locationId = "01400943";

      const searchMap: Record<string, string> = {
        atta: "wheat flour",
        haldi: "turmeric",
        paneer: "cottage cheese",
      };

      const searchTerm = searchMap[itemName] || itemName;
      console.log(
        `[Kroger] 🔍 Searching | itemName: "${itemName}" → searchTerm: "${searchTerm}" | qty: ${retailQuantity} ${retailUnit}`,
      );

      const response = await axios.get("https://api.kroger.com/v1/products", {
        params: {
          "filter.term": searchTerm,
          "filter.locationId": locationId,
          "filter.limit": 10,
          "filter.fulfillment": "csp",
        },
        headers: {
          Authorization: `Bearer ${this.krogerToken}`,
          Accept: "application/json",
        },
        timeout: 8000,
      });

      // ✅ LEVEL 1: Full raw response status
      console.log(`[Kroger] 📡 Response Status: ${response.status}`);

      // ✅ LEVEL 2: Full raw response.data
      console.log(
        `[Kroger] 📦 Raw response.data:`,
        JSON.stringify(response.data, null, 2),
      );

      const products = response.data?.data || [];

      // ✅ LEVEL 3: How many products found
      console.log(
        `[Kroger] 🛒 Products found: ${products.length} for "${searchTerm}"`,
      );

      if (products.length === 0) {
        console.log(`[Kroger] ⚠️ No products returned for: "${searchTerm}"`);
        return null;
      }

      let basePrice: number | null = null;
      let sourceUnit: string = "";
      let imageUrl: string = "";

      for (const [productIndex, product] of products.entries()) {
        // Find image
        const productImageUrl =
          product.images
            ?.find((img: any) => img.perspective === "front")
            ?.sizes?.find((s: any) => s.size === "medium")?.url ||
          product.images?.[0]?.sizes?.[0]?.url ||
          "";

        // ✅ LEVEL 4: Each product summary
        console.log(
          `[Kroger] 📌 Product [${productIndex}]:`,
          JSON.stringify(
            {
              productId: product.productId,
              upc: product.upc,
              brand: product.brand,
              description: product.description,
              itemCount: product.items?.length ?? 0,
            },
            null,
            2,
          ),
        );

        for (const [itemIndex, item] of (product.items || []).entries()) {
          // ✅ LEVEL 5: Each item's full price object
          console.log(
            `[Kroger] 💰 Product[${productIndex}] Item[${itemIndex}] price block:`,
            JSON.stringify(
              {
                size: item.size,
                soldBy: item.soldBy,
                inventory: item.inventory,
                fulfillment: item.fulfillment,
                price: item.price, // promo / regular / display — full block
                nationalPrice: item.nationalPrice,
              },
              null,
              2,
            ),
          );

          const price =
            item.price?.promo ?? item.price?.regular ?? item.price?.display;

          console.log(
            `[Kroger] 🏷️  Product[${productIndex}] Item[${itemIndex}] → resolved price: ${price}`,
          );

          if (price && price > 0) {
            basePrice = price;
            sourceUnit = item.size || "unit";
            imageUrl = productImageUrl;
            console.log(
              `[Kroger] ✅ basePrice locked: ${basePrice} (from Product[${productIndex}] Item[${itemIndex}])`,
            );
            break;
          } else {
            console.log(
              `[Kroger] ⚠️  Product[${productIndex}] Item[${itemIndex}] → skipped (price null/zero)`,
            );
          }
        }

        if (basePrice) break;
      }

      if (!basePrice) {
        console.log(
          `[Kroger] ❌ No valid price found across all products for: "${searchTerm}"`,
        );
        return null;
      }

      // ✅ LEVEL 6: Scaling logic
      let finalPrice = basePrice;

      console.log(
        `[Kroger] ⚖️  Scaling | basePrice: ${basePrice} | unit: "${retailUnit}" | qty: ${retailQuantity}`,
      );

      if (
        retailUnit === "kg" ||
        retailUnit === "litre" ||
        retailUnit === "pieces" ||
        retailUnit === "packet" ||
        retailUnit === "can" ||
        retailUnit === "bottle"
      ) {
        finalPrice = basePrice * retailQuantity;
      } else {
        console.log(
          `[Kroger] ℹ️  Unit "${retailUnit}" not in scale list — using basePrice as-is`,
        );
      }

      const roundedPrice = Math.round(finalPrice * 100) / 100;
      console.log(
        `[Kroger] ✅ Final price for "${itemName}" (${retailQuantity} ${retailUnit}): $${roundedPrice}`,
      );

      return {
        price: roundedPrice,
        unit: sourceUnit,
        imageUrl: imageUrl,
        basePrice: basePrice,
      };
    } catch (err: any) {
      // ✅ LEVEL 7: Full error dump
      console.error(`[Kroger] 🔴 API Error for "${itemName}":`, {
        status: err.response?.status,
        statusText: err.response?.statusText,
        message: err.message,
        responseData: JSON.stringify(err.response?.data, null, 2),
        requestURL: err.config?.url,
        requestParams: err.config?.params,
      });
      return null;
    }
  }

  /**
   * OAuth2 client credentials flow for Kroger
   * Tries 'product.compact' scope first, then no-scope fallback
   */
  private async ensureKrogerToken(): Promise<void> {
    if (this.krogerAuthFailed) return;
    if (this.krogerToken && Date.now() < this.krogerTokenExpiry) return;

    // Use a promise to handle concurrent requests
    if (this.krogerTokenPromise) {
      return this.krogerTokenPromise;
    }

    this.krogerTokenPromise = (async () => {
      const clientId = process.env.KROGER_CLIENT_ID;
      const clientSecret = process.env.KROGER_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return;
      }

      console.log(
        `🔑 Kroger: Authenticating with client_id=${clientId.substring(0, 12)}...`,
      );

      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
        "base64",
      );

      const scopeVariants = ["product.compact", ""];

      for (const scope of scopeVariants) {
        try {
          const body = scope
            ? `grant_type=client_credentials&scope=${encodeURIComponent(scope)}`
            : "grant_type=client_credentials";

          const response = await axios.post(
            "https://api.kroger.com/v1/connect/oauth2/token",
            body,
            {
              headers: {
                Authorization: `Basic ${credentials}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              timeout: 10000,
            },
          );

          this.krogerToken = response.data.access_token;
          this.krogerTokenExpiry =
            Date.now() + (response.data.expires_in - 60) * 1000;
          console.log(
            `✅ Kroger: Token obtained (scope="${scope || "none"}", expires in ${response.data.expires_in}s)`,
          );
          return;
        } catch (err: any) {
          console.log(err);
          const status = err.response?.status;
          const errMsg =
            err.response?.data?.error_description ||
            err.response?.data?.error ||
            err.message;

          if (status === 401) {
            this.krogerAuthFailed = true;
            console.error(
              "❌ Kroger: Invalid credentials (401). Skipping further attempts for this session.\n" +
                "  → Falling back to curated price database.",
            );
            return;
          }

          if (scope === "product.compact") {
            console.warn(
              `⚠️ Kroger auth failed for scope="product.compact" (HTTP ${status}). Retrying with no scope...`,
            );
          } else {
            console.warn(`⚠️ Kroger auth failed (HTTP ${status}): ${errMsg}`);
          }
        }
      }
    })();

    try {
      await this.krogerTokenPromise;
    } finally {
      this.krogerTokenPromise = null;
    }
  }

  /**
   * Fetch a Kroger location ID (required for price queries)
   */
  private async fetchKrogerLocationId(): Promise<string> {
    const response = await axios.get("https://api.kroger.com/v1/locations", {
      params: {
        "filter.zipCode.near": "10001", // NYC default; can be made configurable
        "filter.limit": 1,
        "filter.chain": "KROGER",
      },
      headers: {
        Authorization: `Bearer ${this.krogerToken}`,
        Accept: "application/json",
      },
      timeout: 5000,
    });

    const locations = response.data?.data || [];
    if (locations.length > 0) {
      return locations[0].locationId;
    }
    throw new Error("No Kroger locations found");
  }

  /**
   * Look up price from our curated price database
   * Returns the real retail price for the minimum purchasable unit
   */
  private fetchCuratedPrice(
    itemName: string,
    retailQuantity: number,
    _retailUnit: string,
  ): number | null {
    const entry = CURATED_PRICE_DB[itemName];
    if (!entry) {
      // Fuzzy match: try prefix/contains matching
      const keys = Object.keys(CURATED_PRICE_DB);
      const match = keys.find(
        (k) => k.includes(itemName) || itemName.includes(k),
      );
      if (!match) return null;
      const fuzzyEntry = CURATED_PRICE_DB[match];
      // Scale price by quantity needed vs standard retail quantity
      const scaleFactor = retailQuantity / (fuzzyEntry.quantity || 1);
      const finalPrice = Math.max(
        fuzzyEntry.price,
        fuzzyEntry.price * Math.ceil(scaleFactor),
      );
      return Math.round(finalPrice * 100) / 100;
    }

    // Scale price to cover the needed retail quantity
    const standardQty = entry.quantity || 1;
    const unitsNeeded = Math.ceil(retailQuantity / standardQty);
    const finalPrice = entry.price * unitsNeeded;
    return Math.round(finalPrice * 100) / 100;
  }

  /**
   * Format quantity for display (fractions for small values)
   */
  private formatQuantity(quantity: number): string {
    if (quantity === Math.round(quantity)) {
      return quantity.toString();
    }
    // Common fractions
    const fractions: Record<number, string> = {
      0.25: "1/4",
      0.5: "1/2",
      0.75: "3/4",
      0.33: "1/3",
      0.67: "2/3",
    };
    const rounded = Math.round(quantity * 100) / 100;
    return fractions[rounded] || rounded.toFixed(2).replace(/\.?0+$/, "");
  }

  /**
   * Format retail unit for display
   */
  private formatRetailUnit(unit: string, _itemName: string): string {
    const unitLabels: Record<string, string> = {
      kg: "kg",
      litre: "litre",
      bottle: "bottle",
      packet: "packet",
      pieces: "piece(s)",
      can: "can",
      bulb: "bulb",
      piece: "piece",
      loaf: "loaf",
      bunch: "bunch",
      punnet: "punnet",
    };
    return unitLabels[unit] || unit;
  }

  /**
   * Calculate total cost of all items
   */
  calculateTotal(items: PricedItem[]): {
    total: number;
    availableCount: number;
    unavailableCount: number;
  } {
    let total = 0;
    let availableCount = 0;
    let unavailableCount = 0;

    for (const item of items) {
      if (!item.priceUnavailable && item.estimatedPrice !== null) {
        total += item.estimatedPrice;
        availableCount++;
      } else {
        unavailableCount++;
      }
    }

    return {
      total: Math.round(total * 100) / 100,
      availableCount,
      unavailableCount,
    };
  }
}
