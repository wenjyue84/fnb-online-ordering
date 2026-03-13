import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const inputPath = process.argv[2];
if (!inputPath) {
    console.error('Usage: node scripts/compress-steamed-fish.mjs <input-image-path>');
    process.exit(1);
}
const outputPath = path.join(process.cwd(), 'public', 'images', 'hero', 'hero-mobile.webp');
const blurPath = path.join(process.cwd(), 'src', 'data', 'hero-blur.ts');

async function main() {
    const { data, info } = await sharp(inputPath)
        .resize({ width: 800, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true });

    fs.writeFileSync(outputPath, data);
    console.log('Saved to', outputPath, 'size:', info.size);

    const blurBuffer = await sharp(inputPath)
        .resize(10, 10, { fit: 'cover' })
        .jpeg({ quality: 40 })
        .toBuffer();

    const blurBase64 = `data:image/jpeg;base64,${blurBuffer.toString('base64')}`;

    let blurContent = fs.readFileSync(blurPath, 'utf8');
    // insert new key before the last brace
    blurContent = blurContent.replace('} as const', `  , "heroMobile": "${blurBase64}"\n} as const`);

    fs.writeFileSync(blurPath, blurContent);
    console.log('Updated hero-blur.ts');
}

main().catch(console.error);
