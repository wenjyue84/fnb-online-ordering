import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/site-settings-shared";

describe("SiteSettings identity fields", () => {
  it("address is a non-empty string", () => {
    expect(typeof DEFAULT_SETTINGS.address).toBe("string");
    expect(DEFAULT_SETTINGS.address.length).toBeGreaterThan(0);
  });

  it("phone is a non-empty string", () => {
    expect(typeof DEFAULT_SETTINGS.phone).toBe("string");
    expect(DEFAULT_SETTINGS.phone.length).toBeGreaterThan(0);
  });

  it("dietary is an array with at least 1 item", () => {
    expect(Array.isArray(DEFAULT_SETTINGS.dietary)).toBe(true);
    expect(DEFAULT_SETTINGS.dietary.length).toBeGreaterThanOrEqual(1);
  });

  it("social has facebook, instagram, tiktok keys", () => {
    expect(DEFAULT_SETTINGS.social).toHaveProperty("facebook");
    expect(DEFAULT_SETTINGS.social).toHaveProperty("instagram");
    expect(DEFAULT_SETTINGS.social).toHaveProperty("tiktok");
    expect(typeof DEFAULT_SETTINGS.social.facebook).toBe("string");
    expect(typeof DEFAULT_SETTINGS.social.instagram).toBe("string");
    expect(typeof DEFAULT_SETTINGS.social.tiktok).toBe("string");
  });

  it("displayHours has daily and lastOrder keys", () => {
    expect(DEFAULT_SETTINGS.displayHours).toHaveProperty("daily");
    expect(DEFAULT_SETTINGS.displayHours).toHaveProperty("lastOrder");
    expect(typeof DEFAULT_SETTINGS.displayHours.daily).toBe("string");
    expect(typeof DEFAULT_SETTINGS.displayHours.lastOrder).toBe("string");
  });

  it("cafeTagline is a non-empty string", () => {
    expect(typeof DEFAULT_SETTINGS.cafeTagline).toBe("string");
    expect(DEFAULT_SETTINGS.cafeTagline.length).toBeGreaterThan(0);
  });

  it("cafeName is a non-empty string", () => {
    expect(typeof DEFAULT_SETTINGS.cafeName).toBe("string");
    expect(DEFAULT_SETTINGS.cafeName.length).toBeGreaterThan(0);
  });

  it("cafeNameMs and cafeNameZh are non-empty strings", () => {
    expect(typeof DEFAULT_SETTINGS.cafeNameMs).toBe("string");
    expect(DEFAULT_SETTINGS.cafeNameMs.length).toBeGreaterThan(0);
    expect(typeof DEFAULT_SETTINGS.cafeNameZh).toBe("string");
    expect(DEFAULT_SETTINGS.cafeNameZh.length).toBeGreaterThan(0);
  });
});
