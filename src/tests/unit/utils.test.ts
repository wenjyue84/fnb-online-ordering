import { describe, it, expect } from "vitest";
import { cn, formatPrice, getLocalizedName } from "@/lib/utils";

describe("cn()", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("deduplicates conflicting Tailwind classes (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("ignores falsy values", () => {
    expect(cn("foo", false && "bar", undefined, null, "baz")).toBe("foo baz");
  });
});

describe("formatPrice()", () => {
  it("formats integer price with RM prefix and 2 decimal places", () => {
    expect(formatPrice(5)).toBe("RM 5.00");
  });

  it("formats decimal price correctly", () => {
    expect(formatPrice(12.5)).toBe("RM 12.50");
  });
});

describe("getLocalizedName()", () => {
  const item = { nameEn: "Nasi Lemak", nameMs: "Nasi Lemak (MS)", nameZh: "椰浆饭" };

  it("returns English name for default locale", () => {
    expect(getLocalizedName(item, "en")).toBe("Nasi Lemak");
  });

  it("returns Chinese name for zh locale", () => {
    expect(getLocalizedName(item, "zh")).toBe("椰浆饭");
  });

  it("falls back to English when Chinese name is empty", () => {
    expect(getLocalizedName({ ...item, nameZh: "" }, "zh")).toBe("Nasi Lemak");
  });
});
