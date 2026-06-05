import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const svg = fs.readFileSync(path.join(__dirname, "..", "public", "icon.svg"), "utf-8");
const sizes = [192, 512];

for (const size of sizes) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(path.join(__dirname, "..", "public", `icon-${size}x${size}.png`));
  console.log(`Created icon-${size}x${size}.png`);
}
