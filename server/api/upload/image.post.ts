import { randomUUID } from 'crypto'
import { throwApiError } from '@@/server/utils/errors'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'translator', 'admin')

  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throwApiError(400, 'No file uploaded')
  }

  const file = formData.find(part => part.name === 'image')
  if (!file || !file.data) {
    throwApiError(400, 'No image field found')
  }

  const contentType = file.type || 'application/octet-stream'
  if (!ALLOWED_TYPES.includes(contentType)) {
    throwApiError(400, `Invalid file type: ${contentType}. Allowed: ${ALLOWED_TYPES.join(', ')}`)
  }

  if (file.data.length > MAX_SIZE) {
    throwApiError(400, `File too large. Maximum size: ${MAX_SIZE / 1024 / 1024}MB`)
  }

  // Determine folder based on type query param
  const query = getQuery(event)
  const folder = query.folder === 'covers' ? 'covers' : query.folder === 'illustrations' ? 'illustrations' : 'uploads'

  const ext = contentType.split('/')[1] || 'bin'
  const key = `${folder}/${randomUUID()}.${ext}`

  try {
    await uploadToR2(key, file.data, contentType)
    const publicUrl = getR2PublicUrl(key)

    return {
      success: true,
      key,
      url: publicUrl,
    }
  } catch (error: any) {
    console.error('Upload error:', error)
    throwApiError(500, 'Failed to upload file to storage')
  }
})
