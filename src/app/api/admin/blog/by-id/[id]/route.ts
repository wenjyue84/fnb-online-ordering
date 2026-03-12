import { NextResponse, type NextRequest } from "next/server";
import sql from "@/lib/db";
import { revalidateBlogCache } from "@/lib/cache-utils";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rows = await sql`SELECT * FROM blog_posts WHERE id = ${id} LIMIT 1`;
  if (!rows[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const {
    slug,
    title,
    excerpt,
    content,
    coverImage,
    tags,
    language,
    published,
    publishedAt,
  } = body;

  const rows = await sql`
    UPDATE blog_posts SET
      slug = COALESCE(${slug ?? null}, slug),
      title = COALESCE(${title ?? null}, title),
      excerpt = COALESCE(${excerpt ?? null}, excerpt),
      content = COALESCE(${content ?? null}, content),
      cover_image = COALESCE(${coverImage ?? null}, cover_image),
      tags = COALESCE(${tags ?? null}, tags),
      language = COALESCE(${language ?? null}, language),
      published = COALESCE(${published ?? null}, published),
      published_at = COALESCE(${publishedAt ?? null}, published_at),
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;

  if (!rows[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  revalidateBlogCache();
  return NextResponse.json(rows[0]);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await sql`DELETE FROM blog_posts WHERE id = ${id}`;
  revalidateBlogCache();
  return NextResponse.json({ ok: true });
}
