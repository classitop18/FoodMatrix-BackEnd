import { config } from "dotenv";
config();

async function test() {
  try {
    const { s3Service, S3Folder } =
      await import("./src/modules/storage/s3.service.js");
    const url = await s3Service.uploadFile(
      Buffer.from("test file content 2"),
      S3Folder.RECEIPTS,
      "test2.txt",
      "text/plain",
      "test-user",
    );
    console.log("Success! URL:", url);
  } catch (err) {
    console.error("Error from s3 upload:", err);
  }
}
test();
