import { getSiteSettings } from "@/lib/site-settings";

interface JsonLdProps {
  data: Record<string, unknown>;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export async function RestaurantJsonLd() {
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
    servesCuisine: settings.cuisineTypes,
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
  };

  return <JsonLd data={data} />;
}

export async function MenuPageJsonLd() {
  const settings = await getSiteSettings();

  const data = {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: `${settings.cafeName} Menu`,
    description: settings.menuDescription,
    url:
      (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3031") +
      `/${settings.defaultLocale}/menu`,
    mainEntity: {
      "@type": "Restaurant",
      name: settings.cafeName,
    },
  };

  return <JsonLd data={data} />;
}

export async function BlogPostJsonLd({
  title,
  description,
  datePublished,
  url,
  image,
}: {
  title: string;
  description: string;
  datePublished: string;
  url: string;
  image?: string | null;
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

  return <JsonLd data={data} />;
}
