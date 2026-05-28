export default defineEventHandler(() => {
  throw createError({ statusCode: 404, statusMessage: 'Not found', data: { statusCode: 404 } })
})
