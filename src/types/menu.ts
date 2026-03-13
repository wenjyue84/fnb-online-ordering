export interface MenuItem {
  id: string;            // UUID
  code: string;
  nameEn: string;
  nameMs: string;
  nameZh: string;
  price: number;
  description: string;
  dietary: string[];
  categories: string[];  // multi-category array (was `category: string`)
  displayCategories: string[];  // website-only display categories (not POS)
  available: boolean;
  featured: boolean;
  photo: string | null;  // derived: /images/menu/{code}.jpg
  photos: string[];      // all images: primary + up to 2 secondary ({code}-2.jpg, {code}-3.jpg)
  sortOrder: number;
  availableDays: string[];
  timeFrom: string;
  timeUntil: string;
  specialDates: string[];
  imagePosition: string;   // CSS object-position, e.g. '50% 30%'
  updatedAt: string;       // ISO timestamp — used for image cache-busting
  isSignature: boolean;    // true = this dish appears as the hero on the landing page (max 1 at a time)
  archived: boolean;       // true = removed from menu; still restorable from admin archive list
  allergens: string[];     // e.g. ["nuts", "shellfish", "dairy"] — CODEX STAN allergen slugs
}

export interface DisplayCategory {
  id: number;
  name: string;
  sort_order: number;
  active: boolean;
}

export interface MenuFilters {
  category: string | null;
  search: string;
  dietaryOnly: boolean;
}

// ── Rules (bulk operations) ─────────────────────────────────────────────────

export type RuleType = "disable" | "discount" | "featured";
export type TargetType = "category" | "items";

export interface Rule {
  id: string;
  name: string;
  ruleType: RuleType;
  targetType: TargetType;
  targetCategories: string[];
  targetItemIds: string[];
  excludeItemIds: string[];
  value: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  timeFrom: string;       // daily recurring start "HH:MM" (empty = no constraint)
  timeUntil: string;      // daily recurring end "HH:MM" (empty = no constraint)
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppliedRule {
  ruleId: string;
  ruleName: string;
  ruleType: RuleType;
  value?: number;
}

export interface MenuItemWithRules extends MenuItem {
  originalPrice?: number;
  discountPercent?: number;
  featuredByRule?: boolean;
  disabledByRule?: boolean;
  appliedRules?: AppliedRule[];
}
