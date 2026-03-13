import { getSiteSettings } from "@/lib/site-settings";
import type { MenuItem } from "@/types/menu";

interface JsonLdProps {
  data: Record<string, unknown>;
  nonce?: string | null;
}

export function JsonLd({ data, nonce }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      nonce={nonce ?? undefined}
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export async function RestaurantJsonLd({ nonce }: { nonce?: string | null } = {}) {
  const settings = await getSiteSettings();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3031";

  const data = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: settings.cafeName,
    alternateName: [settings.cafeNameMs, settings.cafeNameZh],
    description: `${settings.cuisineTypes.join(", ")} cafe in ${settings.addressLocality}, ${settings.addressRegion}. ${settings.dietary.join(", ")}.`,
    url: siteUrl,
    telephone: settings.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.streetAddress,
      addressLocality: settings.addressLocality,
      addressRegion: settings.addressRegion,
      postalCode: settings.postalCode,
      addressCountry: settings.addressCountry,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: settings.geoLat,
      longitude: settings.geoLng,
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: settings.operatingHours.open,
      closes: settings.operatingHours.close,
    },
    servesCuisine: [...settings.cuisineTypes, "Halal-friendly"],
    suitableForDiet: "https://schema.org/HalalDiet",
    amenityFeature: [
      {
        "@type": "LocationFeatureSpecification",
        name: "Halal-friendly",
        value: true,
      },
    ],
    priceRange: settings.priceRange,
    paymentAccepted: settings.paymentMethods.join(", "),
    currenciesAccepted: "MYR",
    image: `${siteUrl}/images/og-image.jpg`,
    sameAs: [
      settings.social.facebook,
      settings.social.instagram,
      settings.social.tiktok,
    ],
    hasMenu: {
      "@type": "Menu",
      url: `${siteUrl}/${settings.defaultLocale}/menu`,
    },
    ...(settings.ratingValue && settings.ratingCount && settings.ratingCount >= 1
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: String(settings.ratingValue),
            reviewCount: String(settings.ratingCount),
            ...(settings.ratingProvider ? { name: settings.ratingProvider } : {}),
          },
        }
      : {}),
  };

  return <JsonLd data={data} nonce={nonce} />;
}

export async function MenuPageJsonLd({
  nonce,
  items,
  locale,
}: {
  nonce?: string | null;
  items?: MenuItem[];
  locale?: string;
} = {}) {
  const settings = await getSiteSettings();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3031";
  const menuUrl = `${siteUrl}/${settings.defaultLocale}/menu`;

  // Build MenuSection + MenuItem structured data when items are provided
  let hasMenuSection: Record<string, unknown>[] | undefined;
  if (items && items.length > 0) {
    // Group items by POS category
    const categoryMap = new Map<string, MenuItem[]>();
    for (const item of items) {
      const cats = item.categories.length > 0 ? item.categories : ["Other"];
      for (const cat of cats) {
        if (!categoryMap.has(cat)) categoryMap.set(cat, []);
        categoryMap.get(cat)!.push(item);
      }
    }

    // Helper to pick locale-appropriate name
    const getName = (item: MenuItem): string => {
      if (locale === "zh" && item.nameZh) return item.nameZh;
      if (locale === "ms" && item.nameMs) return item.nameMs;
      return item.nameEn;
    };

    hasMenuSection = Array.from(categoryMap.entries()).map(([category, catItems]) => ({
      "@type": "MenuSection",
      name: category,
      hasMenuItem: catItems.map((item) => {
        const dietList: string[] = ["https://schema.org/HalalDiet"];
        if (item.dietary.some((d) => d.toLowerCase().includes("vegetarian"))) {
          dietList.push("https://schema.org/VegetarianDiet");
        }
        return {
          "@type": "MenuItem",
          name: getName(item),
          ...(item.description && { description: item.description }),
          ...(item.photo && { image: `${siteUrl}${item.photo}` }),
          suitableForDiet: dietList,
          offers: {
            "@type": "Offer",
            price: item.price.toFixed(2),
            priceCurrency: "MYR",
            availability: item.available
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          },
        };
      }),
    }));
  }

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: `${settings.cafeName} Menu`,
    description: settings.menuDescription,
    url: menuUrl,
    mainEntity: {
      "@type": "Restaurant",
      name: settings.cafeName,
    },
    ...(hasMenuSection && { hasMenuSection }),
  };

  return <JsonLd data={data} nonce={nonce} />;
}

export async function BlogPostJsonLd({
  title,
  description,
  datePublished,
  url,
  image,
  nonce,
}: {
  title: string;
  description: string;
  datePublished: string;
  url: string;
  image?: string | null;
  nonce?: string | null;
}) {
  const settings = await getSiteSettings();

  const data = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description,
    datePublished,
    url,
    author: {
      "@type": "Organization",
      name: settings.cafeName,
    },
    publisher: {
      "@type": "Organization",
      name: settings.cafeName,
      url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3031",
    },
    ...(image && { image }),
  };

  return <JsonLd data={data} nonce={nonce} />;
}
