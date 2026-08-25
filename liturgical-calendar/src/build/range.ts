/** First and last civil years shipped by the long-range calendar build. */
export const CALENDAR_START_YEAR = 2025;
export const CALENDAR_END_YEAR = 3000;

/** Inclusive year range, validated to avoid silently incomplete builds. */
export function calendarYearRange(
  startYear: number = CALENDAR_START_YEAR,
  endYear: number = CALENDAR_END_YEAR,
): number[] {
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear > endYear) {
    throw new Error(`Invalid calendar year range: ${startYear}–${endYear}`);
  }

  return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
}
