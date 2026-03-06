import { Storage } from "@google-cloud/storage";
import { logger } from "./logger.utils.js";

// Initialize Google Cloud Storage client
const storage = new Storage();

// We need a bucket for Vision API PDF processing
// const GCS_BUCKET = CONFIG.GOOGLE_CLOUD_STORAGE_BUCKET;
const GCS_BUCKET = null;

export const gcsService = {
  isConfigured: () => {
    return !!GCS_BUCKET;
  },

  getBucketName: () => {
    if (!GCS_BUCKET) {
      throw new Error("GOOGLE_CLOUD_STORAGE_BUCKET is not configured.");
    }
    return GCS_BUCKET;
  },

  /**
   * Uploads a buffer to Google Cloud Storage
   */
  async uploadFile(
    buffer: Buffer,
    destinationPath: string,
    mimetype: string,
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error("GCS is not configured");
    }

    const bucketName = this.getBucketName();
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(destinationPath);

    return new Promise((resolve, reject) => {
      const stream = file.createWriteStream({
        metadata: {
          contentType: mimetype,
        },
        resumable: false,
      });

      stream.on("error", (err) => {
        logger.error("Error uploading to GCS:", err);
        reject(err);
      });

      stream.on("finish", () => {
        logger.info(
          `Successfully uploaded to GCS: gs://${bucketName}/${destinationPath}`,
        );
        resolve(`gs://${bucketName}/${destinationPath}`);
      });

      stream.end(buffer);
    });
  },

  /**
   * Downloads a JSON file from GCS and parses it
   */
  async downloadJson(gcsUri: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error("GCS is not configured");
    }

    // gcsUri format: gs://bucket-name/path/to/file.json
    const match = gcsUri.match(new RegExp("^gs://([^/]+)/(.+)$"));
    if (!match) {
      throw new Error(`Invalid GCS URI: ${gcsUri}`);
    }

    const bucketName = match[1];
    const fileName = match[2];

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    const [contents] = await file.download();
    return JSON.parse(contents.toString("utf-8"));
  },

  /**
   * Lists all files with a specific prefix in GCS
   */
  async listFilesByPrefix(prefix: string): Promise<string[]> {
    if (!this.isConfigured()) {
      throw new Error("GCS is not configured");
    }

    const bucketName = this.getBucketName();
    const bucket = storage.bucket(bucketName);

    const [files] = await bucket.getFiles({ prefix });
    return files.map((file) => `gs://${bucketName}/${file.name}`);
  },

  /**
   * Deletes files matching a specific prefix from GCS
   */
  async deleteFilesByPrefix(prefix: string): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    try {
      const bucketName = this.getBucketName();
      const bucket = storage.bucket(bucketName);

      const [files] = await bucket.getFiles({ prefix });

      const deletePromises = files.map((file) => file.delete());
      await Promise.all(deletePromises);

      logger.info(
        `Deleted ${files.length} files from GCS with prefix: ${prefix}`,
      );
    } catch (error) {
      logger.warn(`Failed to delete GCS files with prefix ${prefix}:`, error);
    }
  },
};
