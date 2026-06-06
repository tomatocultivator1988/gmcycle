import { readFile, writeFile, unlink } from "fs/promises";
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { resolve } from "path";

const root = resolve("public");
const svgBuffer = await readFile(`${root}/icon.svg`);

const sizes = [16, 32, 48, 192, 512];

// Generate PNGs
for (const size of sizes) {
  const png = await sharp(svgBuffer).resize(size, size).png().toBuffer();

  if (size >= 192) {
    await writeFile(`${root}/icon-${size}x${size}.png`, png);
    console.log(`  icon-${size}x${size}.png`);
  }

  // Save for ICO assembly
  await writeFile(`${root}/.favicon-${size}.png`, png);
}

// Generate ICO from 16, 32, 48 PNGs
const icoInput = [16, 32, 48].map((s) => `${root}/.favicon-${s}.png`);
const icoBuffer = await pngToIco(icoInput);
await writeFile(`${root}/favicon.ico`, icoBuffer);
console.log("  favicon.ico");

// Cleanup temp files
await Promise.all(sizes.map((s) => unlink(`${root}/.favicon-${s}.png`).catch(() => {})));

console.log("Done!");
