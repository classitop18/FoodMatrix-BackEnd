import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "@/utils/logger.utils.js";
import { AppError } from "@/utils/app-error.utils.js";
import crypto from "crypto";
import path from "path";

// ─── S3 Folder Prefixes ─────────────────────────────────────
export enum S3Folder {
  AVATARS = "avatars",
  MEMBER_AVATARS = "member-avatars",
  RECEIPTS = "receipts",
  RECIPES = "recipes",
}

// ─── Configuration ──────────────────────────────────────────
const S3_BUCKET = process.env.AWS_S3_BUCKET || "foodmatrix-prod-assets";
const S3_REGION = process.env.AWS_REGION || "us-east-2";
const CDN_DOMAIN =
  process.env.AWS_CLOUDFRONT_DOMAIN || "d8k560yezazuw.cloudfront.net";

// ─── Lazy-initialized S3 client (singleton) ─────────────────
let _s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!_s3Client) {
    const clientConfig: any = { region: S3_REGION };

    // On EC2 with IAM Role: credentials are auto-resolved from instance metadata
    // For local dev: use explicit keys from .env
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (accessKeyId && secretAccessKey) {
      clientConfig.credentials = { accessKeyId, secretAccessKey };
      logger.info("S3 client initialized with explicit credentials");
    } else {
      logger.info("S3 client initialized with IAM role (EC2 instance profile)");
    }

    _s3Client = new S3Client(clientConfig);
    logger.info(
      `S3 bucket: ${S3_BUCKET} | Region: ${S3_REGION} | CDN: ${CDN_DOMAIN}`,
    );
  }
  return _s3Client;
}

// ─── Key Generation ─────────────────────────────────────────
function generateFileKey(
  folder: S3Folder,
  originalFilename: string,
  entityId?: string,
): string {
  const ext = path.extname(originalFilename).toLowerCase() || ".jpg";
  const uniqueId = crypto.randomUUID();
  const timestamp = Date.now();
  const prefix = entityId ? `${folder}/${entityId}` : folder;
  return `${prefix}/${timestamp}-${uniqueId}${ext}`;
}

// ─── S3 Service ─────────────────────────────────────────────
export class S3Service {
  /**
   * Upload a file buffer to S3
   * @returns The public CDN URL of the uploaded file
   */
  async uploadFile(
    buffer: Buffer,
    folder: S3Folder,
    originalFilename: string,
    contentType: string,
    entityId?: string,
  ): Promise<string> {
    const client = getS3Client();
    const key = generateFileKey(folder, originalFilename, entityId);

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable", // 1 year CDN cache
        }),
      );

      // Return CloudFront CDN URL (OAC handles auth to S3)
      const url = `https://${CDN_DOMAIN}/${key}`;
      logger.info(`S3 upload successful → CDN URL: ${url}`);
      return url;
    } catch (error: any) {
      logger.error(`S3 upload failed for key ${key}:`, error);
      throw new AppError(
        `File upload failed: ${error.message || "Unknown S3 error"} ${S3_BUCKET}/${key}`,
        500,
      );
    }
  }

  /**
   * Delete a file from S3 by its key or full URL (CDN or S3)
   */
  async deleteFile(keyOrUrl: string): Promise<void> {
    const client = getS3Client();
    const key = this.extractKeyFromUrl(keyOrUrl);

    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
        }),
      );
      logger.info(`S3 delete successful: ${key}`);
    } catch (error: any) {
      logger.error(`S3 delete failed for key ${key}:`, error);
      // Don't throw on delete failures — not critical
    }
  }

  /**
   * Generate a presigned URL for temporary access to a private file
   * @param expiresInSeconds - URL validity duration (default: 1 hour)
   */
  async getPresignedUrl(
    keyOrUrl: string,
    expiresInSeconds: number = 3600,
  ): Promise<string> {
    const client = getS3Client();
    const key = this.extractKeyFromUrl(keyOrUrl);

    try {
      const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      });

      const signedUrl = await getSignedUrl(client, command, {
        expiresIn: expiresInSeconds,
      });
      return signedUrl;
    } catch (error: any) {
      logger.error(`S3 presigned URL generation failed for key ${key}:`, error);
      throw new AppError("Failed to generate file access URL", 500);
    }
  }

  /**
   * Get the CDN URL for a given S3 key
   */
  getCdnUrl(key: string): string {
    return `https://${CDN_DOMAIN}/${key}`;
  }

  /**
   * Extract S3 key from a full URL (CDN or direct S3)
   */
  private extractKeyFromUrl(keyOrUrl: string): string {
    if (!keyOrUrl.startsWith("http")) return keyOrUrl;

    try {
      const url = new URL(keyOrUrl);
      return url.pathname.slice(1); // Remove leading /
    } catch {
      return keyOrUrl;
    }
  }

  /**
   * Check if S3 is configured and available
   */
  isConfigured(): boolean {
    // On EC2 with IAM role, we don't need explicit keys
    // Just check if bucket is configured
    return !!S3_BUCKET;
  }
}

// Export singleton instance
export const s3Service = new S3Service();
