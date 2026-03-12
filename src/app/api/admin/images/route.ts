import { NextResponse, type NextRequest } from "next/server";
import { readdir, writeFile, unlink, rename } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import sql from "@/lib/db";
import { invalidatePhotosCache } from "@/lib/menu";
import { revalidateMenuCache } from "@/lib/cache-utils";

export const runtime = "nodejs";

const MENU_IMAGES_DIR = join(process.cwd(), "public", "images", "menu");

/** GET /api/admin/images — list all images in public/images/menu/ */
export async function GET() {
  try {
    const files = await readdir(MENU_IMAGES_DIR);
    const images = files
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ images: [] });
  }
}

/** POST /api/admin/images — upload an image for a menu item code */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const code = formData.get("code") as string | null;
  const imageIndexRaw = formData.get("imageIndex") as string | null;
  const imageIndex = imageIndexRaw ? parseInt(imageIndexRaw, 10) : 1;

  if (!file || !code) {
    return NextResponse.json(
      { error: "file and code are required" },
      { status: 400 }
    );
  }

  if (isNaN(imageIndex) || imageIndex < 1) {
    return NextResponse.json(
      { error: "imageIndex must be a positive integer" },
      { status: 400 }
    );
  }

  // Validate file type
  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image files are allowed" },
      { status: 400 }
    );
  }

  // Limit to 5MB
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File must be under 5MB" },
      { status: 400 }
    );
  }

  // Resolve item name for descriptive filename
  let itemSlug = "";
  try {
    const rows = await sql`SELECT name_en FROM menu_items WHERE code = ${code} LIMIT 1`;
    if (rows[0]) {
      itemSlug = "-" + (rows[0].name_en as string)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
    }
  } catch { /* best-effort */ }

  // Always output as WebP — compress to 800px wide, quality 82
  const filename =
    imageIndex === 1 ? `${code}${itemSlug}.webp` : `${code}-${imageIndex}.webp`;
  const raw = Buffer.from(await file.arrayBuffer());
  const buffer = await sharp(raw)
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  await writeFile(join(MENU_IMAGES_DIR, filename), buffer);
  invalidatePhotosCache();

  // Touch updated_at so the image cache-busting version changes on next page render
  await sql`UPDATE menu_items SET updated_at = NOW() WHERE code = ${code}`;

  revalidateMenuCache();

  return NextResponse.json({ filename, path: `/images/menu/${filename}` });
}

/** DELETE /api/admin/images — delete a menu item image (primary=1, secondary=2|3) */
export async function DELETE(request: NextRequest) {
  const body = (await request.json()) as { code?: string; imageIndex?: number };
  const { code, imageIndex } = body;

  if (!code || !imageIndex || imageIndex < 1) {
    return NextResponse.json(
      { error: "code and imageIndex (positive integer) are required" },
      { status: 400 }
    );
  }

  // Primary image: {code}.ext, secondary: {code}-{index}.ext
  const patterns =
    imageIndex === 1
      ? ["jpg", "jpeg", "png", "webp"].map((ext) => `${code}.${ext}`)
      : ["jpg", "jpeg", "png", "webp"].map((ext) => `${code}-${imageIndex}.${ext}`);

  for (const filename of patterns) {
    const filepath = join(MENU_IMAGES_DIR, filename);
    if (existsSync(filepath)) {
      await unlink(filepath);
      invalidatePhotosCache();
      await sql`UPDATE menu_items SET updated_at = NOW() WHERE code = ${code}`;
      revalidateMenuCache();
      return NextResponse.json({ success: true });
    }
  }

  return NextResponse.json({ error: "Image not found" }, { status: 404 });
}

/** PATCH /api/admin/images — promote a secondary image to primary (swap) */
export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as { code?: string; imageIndex?: number };
  const { code, imageIndex } = body;

  if (!code || !imageIndex || imageIndex < 2) {
    return NextResponse.json(
      { error: "code and imageIndex (>= 2) are required" },
      { status: 400 }
    );
  }

  const files = await readdir(MENU_IMAGES_DIR);

  // Find the secondary file to promote
  const secondaryPatterns = ["webp", "jpg", "jpeg", "png"].map(
    (ext) => `${code}-${imageIndex}.${ext}`
  );
  const secondaryFile = secondaryPatterns.find((f) => files.includes(f));
  if (!secondaryFile) {
    return NextResponse.json({ error: "Secondary image not found" }, { status: 404 });
  }

  // Find current primary file (exact: {code}.ext or descriptive: {code}-{non-digit-slug}.ext)
  let primaryFile: string | null = null;
  for (const file of files) {
    if (!/\.(jpe?g|png|webp)$/i.test(file)) continue;
    const exactMatch = file.match(/^([^-]+)\.(jpe?g|png|webp)$/i);
    if (exactMatch && exactMatch[1] === code) { primaryFile = file; break; }
    const descMatch = file.match(/^([^-]+)-([^0-9].+)\.(jpe?g|png|webp)$/i);
    if (descMatch && descMatch[1] === code) primaryFile = file;
  }

  const secondaryPath = join(MENU_IMAGES_DIR, secondaryFile);
  const newPrimaryPath = join(MENU_IMAGES_DIR, `${code}.webp`);

  if (primaryFile) {
    const primaryPath = join(MENU_IMAGES_DIR, primaryFile);
    const newSecondaryPath = join(MENU_IMAGES_DIR, `${code}-${imageIndex}.webp`);
    const tempPath = join(MENU_IMAGES_DIR, `${code}-swap-temp.webp`);
    await rename(secondaryPath, tempPath);
    await rename(primaryPath, newSecondaryPath);
    await rename(tempPath, newPrimaryPath);
  } else {
    await rename(secondaryPath, newPrimaryPath);
  }

  invalidatePhotosCache();
  await sql`UPDATE menu_items SET updated_at = NOW() WHERE code = ${code}`;
  revalidateMenuCache();

  return NextResponse.json({ success: true, newPrimaryPath: `/images/menu/${code}.webp` });
}
