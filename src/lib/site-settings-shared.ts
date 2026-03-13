export interface SiteSettings {
  defaultLocale: string;
  cafeName: string;
  currency: string;
  operatingHours: {
    open: string;
    lastOrder: string;
    close: string;
  };
  preOrderEnabled: boolean;
  depositRequired: boolean;
  paymentMethods: string[];
  tng_phone: string;
  tng_qr_url: string;
  address: string;
  phone: string;
  neighborhood: string;
  wifi: string;
  dietary: string[];
  displayHours: {
    daily: string;
    lastOrder: string;
  };
  social: {
    facebook: string;
    instagram: string;
    tiktok: string;
  };
  googleMapsEmbed: string;
  cafeTagline: string;
  cafeNameMs: string;
  cafeNameZh: string;
  themeColor: string;
  backgroundColor: string;
  cuisineTypes: string[];
  priceRange: string;
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  addressCountry: string;
  geoLat: number;
  geoLng: number;
  menuDescription: string;
  orderExpiryMinutes: number;
  kitchenPin: string;
  posMode: "builtin" | "feedme_manual";
  ratingValue?: number;
  ratingCount?: number;
  ratingProvider?: string;
  escalationMinutes: number;
  maxOrdersPerSlot: number;
  waiterEmail?: string;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  defaultLocale: "en",
  cafeName: "Makan Moments",
  currency: "RM",
  operatingHours: {
    open: "11:00",
    lastOrder: "22:30",
    close: "23:00",
  },
  preOrderEnabled: true,
  depositRequired: false,
  paymentMethods: ["Touch & Go", "Cash on Arrival"],
  tng_phone: "",
  tng_qr_url: "",
  address:
    "Ground Floor 61, Jalan Impian Emas 5/1, Taman Impian Emas, 81300 Skudai, Johor, Malaysia",
  phone: "012-708 8789",
  neighborhood: "Taman Impian Emas (Skudai, Johor Bahru)",
  wifi: "ilovemakan",
  dietary: ["No Pork", "No Lard", "Halal-friendly"],
  displayHours: {
    daily: "11:00 AM - 11:00 PM",
    lastOrder: "10:30 PM",
  },
  social: {
    facebook: "https://www.facebook.com/MakanMomentsCafe",
    instagram: "https://www.instagram.com/MakanMomentsCafe",
    tiktok: "https://www.tiktok.com/@MakanMomentsCafe",
  },
  googleMapsEmbed:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3988.4!2d103.72!3d1.56!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMcKwMzMnNDAuNCJOIDEwM8KwNDMnMjAuMCJF!5e0!3m2!1sen!2smy!4v1",
  cafeTagline: "Thai Begins, Moments Stay",
  cafeNameMs: "Kafe Kenangan Makan",
  cafeNameZh: "Shi Guang Ji Yi",
  themeColor: "#b45309",
  backgroundColor: "#fef9f0",
  cuisineTypes: ["Thai", "Malaysian", "Fusion"],
  priceRange: "RM 2 - RM 90",
  streetAddress: "Ground Floor 61, Jalan Impian Emas 5/1",
  addressLocality: "Skudai",
  addressRegion: "Johor",
  postalCode: "81300",
  addressCountry: "MY",
  geoLat: 1.5612,
  geoLng: 103.7222,
  menuDescription: "Thai-Malaysian fusion dishes — rice, noodles, soups, beverages and more",
  orderExpiryMinutes: 240,
  kitchenPin: "1234",
  posMode: "feedme_manual",
  escalationMinutes: 10,
  maxOrdersPerSlot: 5,
};
