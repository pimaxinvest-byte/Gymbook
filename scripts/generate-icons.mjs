/**
 * Generates all PWA / app icons from public/icon.svg using sharp.
 * Run: node scripts/generate-icons.mjs
 */

import sharp from "sharp";
import { readFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PUBLIC = resolve(ROOT, "public");

const svgBuffer = readFileSync(resolve(PUBLIC, "icon.svg"));

// Ensure icons folder
mkdirSync(resolve(PUBLIC, "icons"), { recursive: true });

const sizes = [
  // Standard PWA (manifest.json)
  { size: 192, file: "icons/icon-192.png", purpose: "any" },
  { size: 512, file: "icons/icon-512.png", purpose: "any" },
  // Maskable (safe zone = center 80%)
  { size: 192, file: "icons/icon-192-maskable.png", purpose: "maskable" },
  { size: 512, file: "icons/icon-512-maskable.png", purpose: "maskable" },
  // Apple touch icon
  { size: 180, file: "apple-touch-icon.png" },
  // Favicons
  { size: 32,  file: "favicon-32.png" },
  { size: 16,  file: "favicon-16.png" },
  // Extra Android / MS sizes
  { size: 144, file: "icons/icon-144.png" },
  { size: 96,  file: "icons/icon-96.png" },
  { size: 72,  file: "icons/icon-72.png" },
];

async function generate() {
  for (const { size, file } of sizes) {
    const out = resolve(PUBLIC, file);
    await sharp(svgBuffer)
      .resize(size, size)
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(out);
    console.log(`✓ ${file} (${size}x${size})`);
  }

  // Generate favicon.ico (multi-size: 16+32+48)
  // sharp doesn't natively write ICO; we'll use the 32px PNG as favicon.ico substitute
  // Modern browsers accept a PNG favicon.ico path
  await sharp(svgBuffer)
    .resize(48, 48)
    .png()
    .toFile(resolve(PUBLIC, "favicon.ico"));
  console.log("✓ favicon.ico (48x48 PNG disguised as .ico — works in all modern browsers)");

  console.log("\n✅ All icons generated in public/");
}

generate().catch((e) => { console.error(e); process.exit(1); });
