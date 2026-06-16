import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import { getEnv } from "@/lib/env";

// -------------------------------------------------------------------------------------
// Document Storage — S3-compatible (e.g. Cloudflare R2 / AWS S3)
// -------------------------------------------------------------------------------------
// NFR (Security): "rider documents in private buckets with signed URLs".
// This module never returns a public URL — only short-lived signed PUT (for
// upload) and GET (for review/download) URLs.
//
// Object key convention:
//   riders/{riderId}/{documentType}/{uuid}.{ext}
// -------------------------------------------------------------------------------------

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;
  const env = getEnv();
  client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT || undefined,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    // Most S3-compatible providers (R2, MinIO) require path-style addressing.
    forcePathStyle: true,
  });
  return client;
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * Builds the storage key for a new document upload.
 */
export function buildDocumentKey(riderId: string, documentType: string, mimeType: string): string {
  const ext = MIME_EXTENSIONS[mimeType] ?? "bin";
  const uuid = crypto.randomUUID();
  return `riders/${riderId}/${documentType.toLowerCase()}/${uuid}.${ext}`;
}

/**
 * Generates a pre-signed PUT URL the client can use to upload a document
 * directly to the bucket. The request must match `mimeType` exactly
 * (enforced via the `ContentType` condition baked into the signature).
 */
export async function createUploadUrl(
  key: string,
  mimeType: string
): Promise<{ uploadUrl: string; expiresInSeconds: number }> {
  const env = getEnv();
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(getClient(), command, {
    expiresIn: env.S3_SIGNED_URL_TTL_SECONDS,
  });

  return { uploadUrl, expiresInSeconds: env.S3_SIGNED_URL_TTL_SECONDS };
}

/**
 * Generates a pre-signed GET URL for viewing/downloading a stored document
 * (used by admin review UI and by the rider to view their own uploads).
 */
export async function createDownloadUrl(key: string): Promise<string> {
  const env = getEnv();
  const command = new GetObjectCommand({ Bucket: env.S3_BUCKET_NAME, Key: key });

  return getSignedUrl(getClient(), command, {
    expiresIn: env.S3_SIGNED_URL_TTL_SECONDS,
  });
}
