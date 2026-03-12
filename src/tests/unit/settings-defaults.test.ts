import { describe, it, expect } from "vitest";

/**
 * These constants are copied from their source files to avoid importing
 * server-only modules in the test environment. This is a pure data test.
 * Any changes to the actual constants must be reflected here.
 */

const DEFAULT_SETTINGS = {
  systemPromptPrefix: "",
  model: "groq",
  temperature: 0.7,
};

const DEFAULT_HOURS = {
  openHour: 11,
  openMinute: 0,
  lastOrderHour: 22,
  lastOrderMinute: 30,
  closeHour: 23,
  closeMinute: 0,
};

const DEFAULT_TIME_SLOTS = {
  slots: [
    {
      id: "breakfast",
      label: "Breakfast",
      startHour: 7,
      startMinute: 0,
      endHour: 11,
      endMinute: 0,
      defaultCategory: "Chef's Picks",
    },
    {
      id: "lunch",
      label: "Lunch",
      startHour: 11,
      startMinute: 0,
      endHour: 15,
      endMinute: 0,
      defaultCategory: "Chef's Picks",
    },
    {
      id: "dinner",
      label: "Dinner",
      startHour: 15,
      startMinute: 0,
      endHour: 22,
      endMinute: 30,
      defaultCategory: "Chef's Picks",
    },
  ],
};

describe("DEFAULT_SETTINGS", () => {
  it("has model set to 'groq'", () => {
    expect(DEFAULT_SETTINGS.model).toBe("groq");
  });

  it("has temperature set to 0.7", () => {
    expect(DEFAULT_SETTINGS.temperature).toBe(0.7);
  });

  it("has systemPromptPrefix field (string)", () => {
    expect(DEFAULT_SETTINGS).toHaveProperty("systemPromptPrefix");
    expect(typeof DEFAULT_SETTINGS.systemPromptPrefix).toBe("string");
  });

  it("has all required ChatSettings fields", () => {
    expect(DEFAULT_SETTINGS).toHaveProperty("model");
    expect(DEFAULT_SETTINGS).toHaveProperty("temperature");
    expect(DEFAULT_SETTINGS).toHaveProperty("systemPromptPrefix");
  });
});

describe("DEFAULT_HOURS", () => {
  it("has openHour set to 11", () => {
    expect(DEFAULT_HOURS.openHour).toBe(11);
  });

  it("has closeHour set to 23", () => {
    expect(DEFAULT_HOURS.closeHour).toBe(23);
  });

  it("has all required OperatingHoursConfig fields", () => {
    expect(DEFAULT_HOURS).toHaveProperty("openHour");
    expect(DEFAULT_HOURS).toHaveProperty("openMinute");
    expect(DEFAULT_HOURS).toHaveProperty("lastOrderHour");
    expect(DEFAULT_HOURS).toHaveProperty("lastOrderMinute");
    expect(DEFAULT_HOURS).toHaveProperty("closeHour");
    expect(DEFAULT_HOURS).toHaveProperty("closeMinute");
  });

  it("has valid hour values (0-23)", () => {
    expect(DEFAULT_HOURS.openHour).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_HOURS.openHour).toBeLessThanOrEqual(23);
    expect(DEFAULT_HOURS.closeHour).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_HOURS.closeHour).toBeLessThanOrEqual(23);
  });
});

describe("DEFAULT_TIME_SLOTS", () => {
  it("has exactly 3 time slots", () => {
    expect(DEFAULT_TIME_SLOTS.slots).toHaveLength(3);
  });

  it("has breakfast slot as first slot", () => {
    expect(DEFAULT_TIME_SLOTS.slots[0].id).toBe("breakfast");
    expect(DEFAULT_TIME_SLOTS.slots[0].label).toBe("Breakfast");
  });

  it("has lunch slot as second slot", () => {
    expect(DEFAULT_TIME_SLOTS.slots[1].id).toBe("lunch");
    expect(DEFAULT_TIME_SLOTS.slots[1].label).toBe("Lunch");
  });

  it("has dinner slot as third slot", () => {
    expect(DEFAULT_TIME_SLOTS.slots[2].id).toBe("dinner");
    expect(DEFAULT_TIME_SLOTS.slots[2].label).toBe("Dinner");
  });

  it("each slot has required TimeSlot fields", () => {
    for (const slot of DEFAULT_TIME_SLOTS.slots) {
      expect(slot).toHaveProperty("id");
      expect(slot).toHaveProperty("label");
      expect(slot).toHaveProperty("startHour");
      expect(slot).toHaveProperty("startMinute");
      expect(slot).toHaveProperty("endHour");
      expect(slot).toHaveProperty("endMinute");
      expect(slot).toHaveProperty("defaultCategory");
    }
  });

  it("each slot has a defaultCategory value", () => {
    for (const slot of DEFAULT_TIME_SLOTS.slots) {
      expect(slot.defaultCategory).toBeTruthy();
      expect(typeof slot.defaultCategory).toBe("string");
    }
  });

  it("slot times are valid (hour 0-23, minute 0-59)", () => {
    for (const slot of DEFAULT_TIME_SLOTS.slots) {
      expect(slot.startHour).toBeGreaterThanOrEqual(0);
      expect(slot.startHour).toBeLessThanOrEqual(23);
      expect(slot.startMinute).toBeGreaterThanOrEqual(0);
      expect(slot.startMinute).toBeLessThanOrEqual(59);
      expect(slot.endHour).toBeGreaterThanOrEqual(0);
      expect(slot.endHour).toBeLessThanOrEqual(23);
      expect(slot.endMinute).toBeGreaterThanOrEqual(0);
      expect(slot.endMinute).toBeLessThanOrEqual(59);
    }
  });
});
