import type { Employee } from "./types";

type NameParts = Pick<Employee, "first_name" | "last_name"> & { nickname?: string | null };

/**
 * "Miguel Alvarez (Migs)" — full name with the nickname in brackets when
 * one is set. Used everywhere crew names appear on the schedule, since a
 * lot of the crew are known by nickname rather than their legal name.
 */
export function employeeDisplayName(e: NameParts): string {
  const full = `${e.first_name} ${e.last_name}`;
  const nick = e.nickname?.trim();
  return nick ? `${full} (${nick})` : full;
}

/** Text to match a crew-picker search against: full name and nickname. */
export function employeeSearchText(e: NameParts): string {
  return `${e.first_name} ${e.last_name} ${e.nickname ?? ""}`.toLowerCase();
}
