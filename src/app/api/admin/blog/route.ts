import { NextResponse, type NextRequest } from "next/server";
import sql from "@/lib/db";
import { revalidateBlogCache } from "@/lib/cache-utils";

export const runtime = "nodejs";

export async function GET() {
  const rows = await sql`SELECT * FROM blog_posts ORDER BY created_at DESC`;
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    slug,
    title,
    excerpt = "",
    content = "",
    coverImage = "",
    tags = [],
    language = "en",
    published = false,
    publishedAt = null,
  } = body;

  if (!slug || !title) {
    return NextResponse.json(
      { error: "slug and title are required" },
      { status: 400 }
    );
  }

  const rows = await sql`
    INSERT INTO blog_posts
      (slug, title, excerpt, content, cover_image, tags, language, published, published_at)
    VALUES
      (${slug}, ${title}, ${excerpt}, ${content}, ${coverImage}, ${tags},
       ${language}, ${published}, ${publishedAt})
    RETURNING *
  `;
  revalidateBlogCache();
  return NextResponse.json(rows[0], { status: 201 });
}
