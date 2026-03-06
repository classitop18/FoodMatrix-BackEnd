import { s3Service, S3Folder } from "./src/modules/storage/s3.service.js";
import { config } from "dotenv";
config();

async function test() {
  try {
    const url = await s3Service.uploadFile(
      Buffer.from("test file content"),
      S3Folder.RECEIPTS,
      "test.txt",
      "text/plain",
      "test-user",
    );
    console.log("Success! URL:", url);
  } catch (err) {
    console.error("Error from s3 upload:", err);
  }
}
test();
