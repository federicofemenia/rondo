export interface AvatarUploadUrl {
  /** Short-lived presigned PUT URL -- the browser uploads the file directly to it, bypassing the backend entirely. */
  uploadUrl: string;
  /** The permanent, publicly-readable URL the file will be reachable at once the upload completes. */
  publicUrl: string;
}

export interface AvatarStorage {
  createUploadUrl(userId: string, contentType: string): Promise<AvatarUploadUrl>;
  /** True if `url` was issued by this storage for this exact user -- guards updateProfile's avatarUrl input against an arbitrary or another user's URL. */
  isOwnAvatarUrl(userId: string, url: string): boolean;
}
