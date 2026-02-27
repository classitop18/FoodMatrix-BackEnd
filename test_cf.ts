import { s3Service } from "./src/modules/storage/s3.service.js";
import "dotenv/config";

async function run() {
  try {
    const CDN_DOMAIN =
      process.env.AWS_CLOUDFRONT_DOMAIN || "d8k560yezazuw.cloudfront.net";
    const bucket = process.env.AWS_S3_BUCKET;
    console.log("Bucket:", bucket);
    console.log("CDN Domain:", CDN_DOMAIN);

    // Test presigned URL generation
    const fakeKey = "receipts/test.jpg";
    const url = await s3Service.getPresignedUrl(fakeKey);
    console.log("Presigned URL:", url);
    console.log("CDN URL:", `https://${CDN_DOMAIN}/${fakeKey}`);
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
