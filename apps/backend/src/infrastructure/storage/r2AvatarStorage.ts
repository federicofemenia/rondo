import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { AvatarStorage, AvatarUploadUrl } from './avatarStorage.js';

const UPLOAD_URL_TTL_SECONDS = 5 * 60;

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type R2Env = {
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  R2_PUBLIC_URL?: string;
};

/** null when R2 isn't configured -- callers show a clear "not configured" error rather than crash, same pattern as push.service.ts's VAPID `configured` guard. */
export function createR2AvatarStorage(env: R2Env): AvatarStorage | null {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET_NAME || !env.R2_PUBLIC_URL) {
    return null;
  }

  const accountId = env.R2_ACCOUNT_ID;
  const bucketName = env.R2_BUCKET_NAME;
  const publicUrl = env.R2_PUBLIC_URL.replace(/\/+$/, '');

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  });

  function keyPrefix(userId: string): string {
    return `avatars/${userId}/`;
  }

  return {
    async createUploadUrl(userId: string, contentType: string): Promise<AvatarUploadUrl> {
      const extension = CONTENT_TYPE_EXTENSIONS[contentType] ?? 'bin';
      const key = `${keyPrefix(userId)}${randomUUID()}.${extension}`;

      const command = new PutObjectCommand({ Bucket: bucketName, Key: key, ContentType: contentType });
      const uploadUrl = await getSignedUrl(client, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });

      return { uploadUrl, publicUrl: `${publicUrl}/${key}` };
    },

    isOwnAvatarUrl(userId: string, url: string): boolean {
      return url.startsWith(`${publicUrl}/${keyPrefix(userId)}`);
    },
  };
}
