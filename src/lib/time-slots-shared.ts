export interface TimeSlot {
  id: string;
  label: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  defaultCategory: string;
}

export interface TimeSlotsConfig {
  slots: TimeSlot[];
}

export const DEFAULT_TIME_SLOTS: TimeSlotsConfig = {
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
