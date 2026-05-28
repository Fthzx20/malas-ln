import { randomUUID } from 'crypto'
import { getR2PublicUrl, uploadToR2 } from '../../utils/r2'
import { throwApiError } from '@@/server/utils/errors'
import { logger } from '@@/server/utils/logger'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
const MAX_SIZE = 5 * 1024 * 1024

export default defineEventHandler(async (event) => {
  let user
  try {
    user = await requireAuth(event)
  } catch (_err) {
    throwApiError(401, 'Authentication required')
  }

  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throwApiError(400, 'No file uploaded')
  }

  const file = formData.find(part => part.name === 'image')
  if (!file?.data) {
    throwApiError(400, 'No image field found')
  }

  const contentType = file.type || 'application/octet-stream'
  if (!ALLOWED_TYPES.includes(contentType)) {
    throwApiError(400, `Invalid file type: ${contentType}`)
  }

  if (file.data.length > MAX_SIZE) {
    throwApiError(400, `File too large. Maximum size: ${MAX_SIZE / 1024 / 1024}MB`)
  }

  const ext = contentType.split('/')[1] || 'bin'
  const key = `avatars/${user.id}/${randomUUID()}.${ext}`

  try {
    await uploadToR2(key, file.data, contentType)
  } catch (error: any) {
    logger.error('[avatar] Upload error:', error)
    throwApiError(500, 'Failed to upload avatar to storage')
  }

  return {
    success: true,
    key,
    url: getR2PublicUrl(key),
  }
})