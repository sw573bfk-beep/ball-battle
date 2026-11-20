/**
 * Who is allowed into the estate. Anyone whose name is not on this list is
 * kicked at the sign-in screen.
 */
export interface Resident {
  name: string;
  /** Zone id of the floor their bedroom is on. */
  home: ZoneId;
  /** Room id (in that floor's layout) that is their bedroom. */
  room: string;
  /** Can hand out VIP and reset passwords. */
  admin?: boolean;
}

export type ZoneId =
  | 'b' | 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6' | 'f7' | 'f8'
  | 'park' | 'villa';

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

/** Returns the resident with this name (any capitalisation, spaces trimmed). */
export function findResident(raw: string): Resident | undefined {
  const n = raw.trim().toLowerCase();
  return RESIDENTS.find((r) => r.name.toLowerCase() === n);
}
