import { defineConfig } from "tsup";
import * as fs from "fs";
import * as path from "path";

export default defineConfig({
  entry: ["src/**/*.ts"],
  format: ["esm"],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  tsconfig: "./tsconfig.json",
  // Copy email templates after build
  onSuccess: async () => {
    const sourceDir = "src/email/layouts";
    const destDir = "dist/email/layouts";

    // Create destination directory if it doesn't exist
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Copy all .hbs files
    const files = fs.readdirSync(sourceDir);
    files.forEach((file: string) => {
      if (file.endsWith(".hbs")) {
        fs.copyFileSync(path.join(sourceDir, file), path.join(destDir, file));
      }
    });

    console.log("✅ Email templates copied to dist/email/layouts");
  },
});
