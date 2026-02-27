import { s3Service, S3Folder } from "./src/modules/storage/s3.service.js";
import "dotenv/config";

async function run() {
  try {
    const buf = Buffer.from("test");
    const url = await s3Service.uploadFile(
      buf,
      S3Folder.RECEIPTS,
      "test.jpg",
      "image/jpeg",
      "test-user",
    );
    console.log("Success:", url);
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
