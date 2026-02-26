import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

const client = new S3Client({
  region: "us-east-2",
  credentials: {
    // accessKeyId: "AKIATL7H67FCFCU4MT7aa4",
    // secretAccessKey: "iNJXF0kPR7ENJOzzMIkwsO4rXtYzOa+83AERnOoaaA",
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
