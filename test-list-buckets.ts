import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import { config } from "dotenv";
config();

async function test() {
  try {
    const s3 = new S3Client({
      region: process.env.AWS_REGION || "us-east-2",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    const { Buckets } = await s3.send(new ListBucketsCommand({}));
    console.log(
      "Buckets:",
      Buckets?.map((b) => b.Name),
    );
  } catch (err) {
    console.error("Error from s3 list:", err);
  }
}
test();
