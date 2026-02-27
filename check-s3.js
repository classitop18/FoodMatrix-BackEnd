import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

const client = new S3Client({
  region: "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function run() {
  try {
    const data = await client.send(new ListBucketsCommand({}));
    console.log(
      "Buckets:",
      data.Buckets.map((b) => b.Name),
    );
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
