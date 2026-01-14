/**
 * Safely parses a string quantity into a number.
 * Handles fractions (e.g., "1/2"), mixed numbers (e.g., "1 1/2"), and decimals.
 * Returns null if parsing fails, instead of throwing or using eval().
 */
export function safeParseQuantity(quantity: string): number | null {
  if (!quantity) return null;

  const cleanQty = quantity.trim();

  // Handle simple numbers and decimals
  if (!isNaN(Number(cleanQty))) {
    return Number(cleanQty);
  }

  // Handle fractions like "1/2"
  const fractionMatch = cleanQty.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const numerator = parseInt(fractionMatch[1], 10);
    const denominator = parseInt(fractionMatch[2], 10);
    return denominator !== 0 ? numerator / denominator : null;
  }

  // Handle mixed numbers like "1 1/2" or "1-1/2"
  const mixedMatch = cleanQty.match(/^(\d+)[\s-](\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const numerator = parseInt(mixedMatch[2], 10);
    const denominator = parseInt(mixedMatch[3], 10);
    return denominator !== 0 ? whole + numerator / denominator : null;
  }

  return null;
}

/**
 * Scales a quantity string by a ratio.
 * Preserves the original format if possible, otherwise returns decimal fixed to 2 places.
 */
export function scaleQuantityString(quantity: string, ratio: number): string {
  // Extract numeric part (naive approach matching original logic but safer)
  // The original regex was /[\d./]+/ which matches "1.5", "1/2", "1 1/2" (roughly)

  // We'll attempt to find the first numeric/fraction-like substring
  const match = quantity.match(/(\d+[\s-]\d+\/\d+|\d+\/\d+|\d+(\.\d+)?)/);

  if (!match) return quantity;

  const originalNumStr = match[0];
  const parsed = safeParseQuantity(originalNumStr);

  if (parsed === null) return quantity;

  const scaled = parsed * ratio;

  // Format closer to original if it was an integer
  const formattedScaled = Number.isInteger(scaled)
    ? scaled.toString()
    : scaled.toFixed(2);

  // Replace the FIRST occurrence of the number in the string
  return quantity.replace(originalNumStr, formattedScaled);
}
