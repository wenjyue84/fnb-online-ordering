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

  const data = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: settings.cafeName,
    alternateName: [settings.cafeNameMs, settings.cafeNameZh],
    description:
      "Thai-Malaysian fusion cafe in Skudai, Johor. No Pork, No Lard, Halal-friendly.",
    url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3031",
    telephone: "+60127088789",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Ground Floor 61, Jalan Impian Emas 5/1",
      addressLocality: "Skudai",
      addressRegion: "Johor",
      postalCode: "81300",
      addressCountry: "MY",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 1.5612,
      longitude: 103.7222,
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
      opens: "11:00",
      closes: "23:00",
    },
    servesCuisine: ["Thai", "Malaysian", "Fusion"],
    priceRange: "RM 2 - RM 90",
    paymentAccepted: "Cash, Touch n Go, GrabPay, DuitNow QR",
    currenciesAccepted: "MYR",
    image:
      (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3031") +
      "/images/og-image.jpg",
    sameAs: [
      settings.social.facebook,
      settings.social.instagram,
      settings.social.tiktok,
    ],
    hasMenu: {
      "@type": "Menu",
      url:
        (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3031") +
        "/en/menu",
      hasMenuSection: [
        {
          "@type": "MenuSection",
          name: "Must-Try",
          description: "Our signature dishes and customer favorites",
        },
        {
          "@type": "MenuSection",
          name: "Ala Cart",
          description: "Individual dishes — chicken, fish, eggs, vegetables",
        },
        {
          "@type": "MenuSection",
          name: "Value Set",
          description: "Complete meal sets at great value",
        },
        {
          "@type": "MenuSection",
          name: "Noodle Soup",
          description: "Thai-style noodle soups",
        },
        {
          "@type": "MenuSection",
          name: "Beverages",
          description: "Hot drinks, cold drinks, fresh juices",
        },
      ],
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
    description: "384+ Thai-Malaysian fusion dishes",
    url:
      (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3031") +
      "/en/menu",
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
