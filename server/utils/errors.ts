export function throwApiError(statusCode: number, statusMessage: string, data?: any): never {
  const err: any = { statusCode, statusMessage }
  if (data !== undefined) err.data = data
  throw createError(err)
}

export function badRequest(msg = 'Bad request') {
  throwApiError(400, msg)
}

export function notFound(msg = 'Not found') {
  throwApiError(404, msg)
}

export function serverError(msg = 'Internal server error') {
  throwApiError(500, msg)
}
