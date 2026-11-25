/**
 * Players. The 10 founders own the bedrooms on the original floor plan.
 * Anyone else can sign up; an admin approves them, and every two approved
 * newcomers get a new residence floor with two bedrooms.
 */
export type FixedZone = 'b' | 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6' | 'f7' | 'f8' | 'f9' | 'f10' | 'f11' | 'f12' | 'f13' | 'f14' | 'f15' | 'f16' | 'f17' | 'f18' | 'f19' | 'f20' | 'f21' | 'f22' | 'f23' | 'f24' | 'park' | 'villa' | 'beach' | 'mall' | 'town' | 'stadium';
export type ResidenceZone = `r${number}`;
export type ZoneId = FixedZone | ResidenceZone;

export interface Home { zone: ZoneId; room: string }

export interface Resident {
  name: string;
  home: ZoneId;
  room: string;
  admin?: boolean;
}

export const RESIDENTS: Resident[] = [
  { name: 'Phoebe', home: 'b', room: 'phoebe' },
  { name: 'Serena', home: 'b', room: 'serena' },
  { name: 'Beau', home: 'f1', room: 'guest1', admin: true },
  { name: 'Keola', home: 'f4', room: 'keola', admin: true },
  { name: 'Jess', home: 'f4', room: 'jess' },
  { name: 'Ava', home: 'f5', room: 'ava' },
  { name: 'Grace', home: 'f5', room: 'grace' },
  { name: 'Charis', home: 'f6', room: 'charis' },
  { name: 'Gabby', home: 'f6', room: 'gabby' },
  { name: 'Milla', home: 'f7', room: 'milla', admin: true },
];

/** The 10 original residents (any capitalisation, spaces trimmed). */
export function findResident(raw: string): Resident | undefined {
  const n = raw.trim().toLowerCase();
  return RESIDENTS.find((r) => r.name.toLowerCase() === n);
}

export const PEOPLE_PER_FLOOR = 2;

/** Where the n-th approved newcomer (0-based) lives. */
export function residenceHome(seq: number): Home {
  return { zone: `r${Math.floor(seq / PEOPLE_PER_FLOOR) + 1}` as ResidenceZone, room: seq % PEOPLE_PER_FLOOR === 0 ? 'a' : 'b' };
}

export function isResidence(z: string): z is ResidenceZone {
  return /^r[1-9]\d{0,2}$/.test(z);
}

export function residenceNumber(z: ZoneId): number {
  return isResidence(z) ? Number(z.slice(1)) : 0;
}

const BLOCKED = ['admin', 'jazz', 'host', 'mod', 'moderator', 'system', 'null', 'undefined'];
const RUDE = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'sex', 'porn', 'nazi', 'slut', 'whore', 'nigg', 'fag', 'rape', 'kill'];

/** Checks a new username. Returns the cleaned name, or a reason it's not allowed. */
export function checkUsername(raw: string): { ok: true; name: string } | { ok: false; reason: string } {
  const name = raw.trim();
  if (name.length < 3) return { ok: false, reason: 'Usernames need at least 3 characters.' };
  if (name.length > 16) return { ok: false, reason: 'Usernames can be up to 16 characters.' };
  if (!/^[A-Za-z0-9_]+$/.test(name)) return { ok: false, reason: 'Use only letters, numbers and _ (no spaces).' };
  const low = name.toLowerCase();
  if (BLOCKED.includes(low) || RUDE.some((w) => low.includes(w))) return { ok: false, reason: 'Please pick a different username.' };
  return { ok: true, name };
}
