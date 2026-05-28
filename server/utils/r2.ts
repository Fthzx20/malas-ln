import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

let _s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (!_s3Client) {
    const config = useRuntimeConfig()
    _s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.r2AccessKeyId,
        secretAccessKey: config.r2SecretAccessKey,
      },
    })
  }
  return _s3Client
}

/**
 * Upload a file to Cloudflare R2.
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  const config = useRuntimeConfig()
  const client = getS3Client()

  await client.send(
    new PutObjectCommand({
      Bucket: config.r2BucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  return key
}

/**
 * Delete a file from Cloudflare R2.
 */
export async function deleteFromR2(key: string): Promise<void> {
  const config = useRuntimeConfig()
  const client = getS3Client()

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.r2BucketName,
      Key: key,
    }),
  )
}

/**
 * Generate a presigned URL for direct client upload.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  const config = useRuntimeConfig()
  const client = getS3Client()

  return await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.r2BucketName,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn },
  )
}

/**
 * Generate a presigned URL for reading a private object.
 */
export async function getPresignedReadUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const config = useRuntimeConfig()
  const client = getS3Client()

  return await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.r2BucketName,
      Key: key,
    }),
    { expiresIn },
  )
}

/**
 * Build the public URL for an R2 asset.
 */
export function getR2PublicUrl(key: string): string {
  const config = useRuntimeConfig()
  const publicUrl = config.public.r2PublicUrl
  if (publicUrl) {
    return `${publicUrl}/${key}`
  }
  return key
}

/**
 * Extract the object key from a public R2 URL if it belongs to this project.
 */
export function getR2KeyFromPublicUrl(url: string): string | null {
  const config = useRuntimeConfig()
  const publicUrl = config.public.r2PublicUrl?.replace(/\/$/, '')
  if (!publicUrl) return null
  if (!url.startsWith(publicUrl)) return null

  const key = url.slice(publicUrl.length).replace(/^\//, '')
  return key || null
}
