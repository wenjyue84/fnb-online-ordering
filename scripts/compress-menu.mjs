/**
 * compress-menu.mjs — Menu photo compression script
 *
 * Compresses input images to WebP, resized for mobile-first display.
 * Target: ≤ 100KB per image, 800px max width.
 *
 * Usage:
 *   node scripts/compress-menu.mjs <input> [input2] [input3] ...
 *   node scripts/compress-menu.mjs public/images/menu/TM03-2.jpg
 *   node scripts/compress-menu.mjs public/images/menu/*.jpg   (via shell glob)
 *
 * Output:
 *   Same directory as input, with .webp extension replacing original ext.
 *   Original file is kept — WebP is the new deliverable.
 */

import sharp from "sharp";
import { existsSync, statSync } from "fs";
import { extname, basename, dirname, join } from "path";

const MAX_WIDTH = 800;      // px — suits menu card @ 2x on mobile
const WEBP_QUALITY = 82;    // 80–85 is the sweet spot for food photos
const WARN_KB = 100;        // warn if output exceeds this

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: node scripts/compress-menu.mjs <file1> [file2] ...");
  process.exit(1);
}

async function compress(inputPath) {
  if (!existsSync(inputPath)) {
    console.warn(`  SKIP: not found — ${inputPath}`);
    return;
  }

  const ext = extname(inputPath).toLowerCase();
  const supported = [".jpg", ".jpeg", ".png", ".webp", ".tiff", ".avif"];
  if (!supported.includes(ext)) {
    console.warn(`  SKIP: unsupported format — ${inputPath}`);
    return;
  }

  const dir = dirname(inputPath);
  const nameNoExt = basename(inputPath, ext);
  const outputPath = join(dir, `${nameNoExt}.webp`);

  const originalKB = (statSync(inputPath).size / 1024).toFixed(1);

  const { data, info } = await sharp(inputPath)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  const outputKB = (info.size / 1024).toFixed(1);
  const saving = (((originalKB - outputKB) / originalKB) * 100).toFixed(0);

  const { writeFileSync } = await import("fs");
  writeFileSync(outputPath, data);

  const flag = outputKB > WARN_KB ? " ⚠ exceeds 100KB target" : " ✓";
  console.log(
    `${basename(inputPath)} → ${basename(outputPath)}`
    + `  [${info.width}×${info.height}px]`
    + `  ${originalKB} KB → ${outputKB} KB  (−${saving}%)${flag}`
  );
}

console.log(`Compressing ${args.length} file(s)...\n`);
for (const arg of args) {
  await compress(arg);
}
console.log("\nDone.");
