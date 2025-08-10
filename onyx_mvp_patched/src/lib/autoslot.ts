import { addDays, setHours, setMinutes, setSeconds, isBefore } from "date-fns";

// Returns next available 18:00 local slot, 1/day per channel
export function nextAutoSlot(existingPublishAts: Date[], now = new Date()) {
  let d = setSeconds(setMinutes(setHours(now, 18), 0), 0);
  if (isBefore(d, now)) d = addDays(d, 1);
  const taken = new Set(existingPublishAts.map((x) => +x));
  while (taken.has(+d)) d = addDays(d, 1);
  return d;
}
