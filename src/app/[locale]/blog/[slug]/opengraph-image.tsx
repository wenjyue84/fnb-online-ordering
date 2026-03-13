import { ImageResponse } from "next/og";
import { getBlogPost } from "@/lib/blog";
import { getSiteSettings } from "@/lib/site-settings";

export const revalidate = 3600;

export const alt = "Blog post";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  let title = "Blog";
  let cafeName = "Makan Moments";
  let tagline = "Thai Begins, Moments Stay";
  let themeColor = "#b45309";
  let bgColor = "#fef9f0";

  try {
    const [post, settings] = await Promise.all([
      getBlogPost(slug),
      getSiteSettings(),
    ]);

    if (post) {
      title = post.title;
    }

    const nameMap: Record<string, string> = {
      en: settings.cafeName,
      ms: settings.cafeNameMs,
      zh: settings.cafeNameZh,
    };
    cafeName = nameMap[locale] || settings.cafeName;
    tagline = settings.cafeTagline;
    themeColor = settings.themeColor;
    bgColor = settings.backgroundColor;
  } catch {
    // Fallback to defaults above if DB unavailable
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px",
          backgroundColor: bgColor,
          fontFamily: "sans-serif",
        }}
      >
        {/* Top: cafe name + tagline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: themeColor,
              letterSpacing: "-0.02em",
            }}
          >
            {cafeName}
          </div>
          <div
            style={{
              fontSize: 18,
              color: "#78716c",
              marginTop: 4,
            }}
          >
            {tagline}
          </div>
        </div>

        {/* Center: blog post title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            paddingTop: 40,
            paddingBottom: 40,
          }}
        >
          <div
            style={{
              fontSize: title.length > 60 ? 40 : 52,
              fontWeight: 700,
              color: "#1c1917",
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
              maxWidth: "90%",
            }}
          >
            {title}
          </div>
        </div>

        {/* Bottom: locale badge + blog label */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                backgroundColor: themeColor,
                color: "white",
                padding: "6px 16px",
                borderRadius: 6,
                fontSize: 16,
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              {locale}
            </div>
            <div style={{ fontSize: 18, color: "#78716c" }}>Blog</div>
          </div>
          {/* Decorative bar */}
          <div
            style={{
              width: 120,
              height: 4,
              backgroundColor: themeColor,
              borderRadius: 2,
            }}
          />
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
