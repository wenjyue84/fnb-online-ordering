import { ImageResponse } from "next/og";
import { getSiteSettings } from "@/lib/site-settings";

export const revalidate = 3600;

export const alt = "Menu";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const menuLabels: Record<string, string> = {
  en: "Menu",
  ms: "Menu",
  zh: "菜单",
};

const subtitleLabels: Record<string, string> = {
  en: "Browse our full menu",
  ms: "Lihat menu penuh kami",
  zh: "浏览我们的完整菜单",
};

export default async function OgImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  let cafeName = "Makan Moments";
  let tagline = "Thai Begins, Moments Stay";
  let themeColor = "#b45309";
  let bgColor = "#fef9f0";
  let cuisineTypes: string[] = ["Thai", "Malaysian", "Fusion"];

  try {
    const settings = await getSiteSettings();
    const nameMap: Record<string, string> = {
      en: settings.cafeName,
      ms: settings.cafeNameMs,
      zh: settings.cafeNameZh,
    };
    cafeName = nameMap[locale] || settings.cafeName;
    tagline = settings.cafeTagline;
    themeColor = settings.themeColor;
    bgColor = settings.backgroundColor;
    cuisineTypes = settings.cuisineTypes;
  } catch {
    // Fallback to defaults above if DB unavailable
  }

  const menuLabel = menuLabels[locale] || "Menu";
  const subtitle = subtitleLabels[locale] || subtitleLabels.en;

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

        {/* Center: Menu title */}
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
              fontSize: 72,
              fontWeight: 700,
              color: "#1c1917",
              letterSpacing: "-0.02em",
            }}
          >
            {menuLabel}
          </div>
          <div
            style={{
              fontSize: 24,
              color: "#78716c",
              marginTop: 8,
            }}
          >
            {subtitle}
          </div>
        </div>

        {/* Bottom: cuisine tags + locale badge */}
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
            {cuisineTypes.map((cuisine) => (
              <div
                key={cuisine}
                style={{
                  backgroundColor: themeColor + "1a",
                  color: themeColor,
                  padding: "6px 16px",
                  borderRadius: 20,
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                {cuisine}
              </div>
            ))}
          </div>
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
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
