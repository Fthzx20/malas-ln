/**
 * Shared utility for extracting HTTP status codes from error objects
 * and determining if an error is an authentication/authorization error.
 *
 * Validates: Requirements 14.1
 */

/**
 * Extracts the HTTP status code from an unknown error object.
 * Checks `data.statusCode`, `statusCode`, and `status` fields in that priority order.
 */
export function getErrorStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null
  const c = error as { statusCode?: unknown; status?: unknown; data?: { statusCode?: unknown } }
  // Check body data first (consistent with server-side createError data field)
  if (typeof c.data?.statusCode === 'number') return c.data.statusCode
  if (typeof c.statusCode === 'number') return c.statusCode
  if (typeof c.status === 'number') return c.status
  return null
}

/**
 * Returns true if the error represents an authentication (401) or
 * authorization (403) failure.
 */
export function isAuthError(error: unknown): boolean {
  const code = getErrorStatusCode(error)
  return code === 401 || code === 403
}
