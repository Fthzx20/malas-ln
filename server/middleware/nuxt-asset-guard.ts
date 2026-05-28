// Prevent directory-only requests to /_nuxt or /_nuxt/ from being treated as navigable routes.
// This avoids the client router receiving a navigation to the literal directory path
// which triggers "No match found for location with path '/_nuxt/'" warnings.
export default defineEventHandler((event) => {
  const reqUrl = (event.node?.req && (event.node.req.url || '')) || ''
  if (reqUrl === '/_nuxt' || reqUrl === '/_nuxt/') {
    throw createError({ statusCode: 404, statusMessage: 'Not found', data: { statusCode: 404 } })
  }
})
