/**
 * Validation utilities for Nitro API handlers.
 * Provides shared field validation to avoid duplicating logic across handlers.
 */

/**
 * Asserts that all specified fields are present and non-empty in the request body.
 * Throws a 400 createError for the first missing or empty field found.
 *
 * @param body - The parsed request body object
 * @param fields - Array of field keys that must be present and non-empty
 * @throws H3Error with statusCode 400 if any field is missing or empty
 */
export function requireFields<T extends Record<string, unknown>>(
  body: T,
  fields: (keyof T)[]
): void {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      throw createError({
        statusCode: 400,
        statusMessage: `${String(field)} is required`,
        data: { statusCode: 400, field: String(field) },
      })
    }
  }
}

/**
 * Sanitize a user-provided search string for safe use in SQL queries.
 * Trims, lowercases, enforces max length, and removes null bytes.
 */
export function sanitizeSearchInput(input: string, maxLength = 100): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\0/g, '')     // strip null bytes
    .slice(0, maxLength)
}

/**
 * UUID v4 format validator.
 * Throws 400 if the provided value is not a valid UUID.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validateUUID(value: string | undefined, label = 'ID'): string {
  if (!value || !UUID_REGEX.test(value)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid ${label} format`,
      data: { statusCode: 400 },
    })
  }
  return value
}

/**
 * Clamp a numeric input to a safe integer range with a fallback default.
 */
export function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof val === 'number' ? val : parseInt(String(val), 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.floor(parsed)))
}

