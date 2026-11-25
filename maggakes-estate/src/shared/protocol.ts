import type { SoccerWire } from './soccer';
import type { Home, ZoneId } from './people';
import type { Look, PetKind, PlacedItem, RoomStyle, Save } from './save';
import type { Profile } from './look';
import type { Scene, SeasonAction } from './season';

/** What a player looks like to everyone else. */
export interface PeerInfo {
  name: string;
  zone: ZoneId;
  look: Look;
  vip: boolean;
  car?: { id: string; paint: string; wheels?: string } | null;
  partner?: string;
  pet?: { kind: PetKind; name: string; fur?: string; collar?: string; xp?: number };
  profile?: Profile;
  level?: number;
  trophies?: number;
}

export interface PeerPos {
  name: string;
  x: number;
  z: number;
  ry: number;
  /** 0 idle, 1 walk, 2 swim, 3 drive, 4+ emotes */
  a: number;
}

export interface BoardRow {
  name: string;
  totalAura: number;
  top: ZoneId;
  vip: boolean;
  online: boolean;
  villaWins: number;
  villaPoints: number;
  level?: number;
  partner?: string;
  hasPassword: boolean;
}

/** A residence floor and who lives there (room a, room b). */
export interface Residence { zone: ZoneId; owners: { name: string; room: string }[] }

export type AccountStatus = 'pending' | 'approved' | 'banned';

/** One row in the accounts list (visible to VIPs and admins). */
export interface AccountRow {
  name: string;
  status: AccountStatus;
  admin: boolean;
  vip: boolean;
  online: boolean;
  founder: boolean;
  totalAura: number;
  home?: Home;
  created: number;
  lastSeen: number;
  hasPassword: boolean;
}

/** A problem report sent from inside the game. */
export interface Report { id: string; from: string; text: string; info: string; auto: boolean; at: number; done: boolean }

/** A message in the Staff Chat (admins + VIPs). `sys` messages are joins/kicks. */
export interface StaffMsg { at: number; from: string; text: string; sys?: boolean; admin?: boolean }

export type AdminAction = 'vip' | 'unvip' | 'reset' | 'ban' | 'unban' | 'approve' | 'reject' | 'admin' | 'unadmin';

export type ClientMsg =
  | { t: 'zone'; zone: ZoneId }
  | { t: 'pos'; x: number; z: number; ry: number; a: number }
  | { t: 'chat'; text: string }
  | { t: 'emote'; e: string }
  | { t: 'task'; zone: ZoneId; task: string }
  | { t: 'buy'; item: string }
  | { t: 'look'; look: Look }
  | { t: 'villaLook'; look: Look }
  | { t: 'room'; items: PlacedItem[] }
  | { t: 'stat'; stat: string; by: number }
  | { t: 'daily'; id: string }
  | { t: 'car'; car: string | null; paint?: string; wheels?: string }
  | { t: 'villa'; challenge: string }
  | { t: 'couple'; to: string }
  | { t: 'coupleReply'; from: string; yes: boolean }
  | { t: 'recouple' }
  | { t: 'pick'; who: string }
  | { t: 'final' }
  | { t: 'board' }
  | { t: 'admin'; action: AdminAction; target: string }
  | { t: 'accounts' }
  | { t: 'pause'; on: boolean }
  | { t: 'pet'; kind: string; name: string; fur?: string; collar?: string }
  | { t: 'claimLevel' }
  | { t: 'staff'; text: string }
  | { t: 'staff?' }
  | { t: 'kick'; ang: number; power?: number }
  | { t: 'claimCollection'; pct: number }
  | { t: 'claimStreak' }
  | { t: 'buyUpgrade'; id: string }
  | { t: 'petTrick'; trick: string }
  | { t: 'quest'; a: 'accept' | 'claim'; id: string }
  | { t: 'claimAch'; id: string }
  | { t: 'claimEvent'; i: number }
  | { t: 'outfit'; slot: number; name: string; look: Look }
  | { t: 'profile'; profile: Profile }
  | { t: 'roomStyle'; style: RoomStyle }
  | { t: 'spin' }
  | { t: 'shell'; id: string }
  | { t: 'lap'; ms: number }
  | { t: 'laps' }
  | { t: 'fireworks'; x: number; z: number }
  | { t: 'party' }
  | { t: 'tag' }
  | { t: 'tagged'; who: string }
  | { t: 'breakup' }
  | { t: 'report'; text: string; info: string; auto?: boolean }
  | { t: 'reports' }
  | { t: 'reportDone'; id: string; done: boolean }
  | { t: 'room?'; owner: string }
  | { t: 'season'; act: SeasonAction };

export type ServerMsg =
  | { t: 'welcome'; save: Save; admin: boolean; residences: Residence[]; pending: number; roomStyles?: Record<string, RoomStyle> }
  | { t: 'roomStyle'; owner: string; style: RoomStyle }
  | { t: 'world'; residences: Residence[] }
  | { t: 'accounts'; rows: AccountRow[]; paused?: boolean }
  | { t: 'role'; admin: boolean; pending: number; reports?: number }
  | { t: 'reports'; rows: Report[] }
  | { t: 'save'; save: Save }
  | { t: 'toast'; text: string; good?: boolean }
  | { t: 'peers'; zone: ZoneId; list: PeerInfo[] }
  | { t: 'peer'; info: PeerInfo }
  | { t: 'gone'; name: string }
  | { t: 'pos'; p: PeerPos }
  | { t: 'chat'; from: string; text: string }
  | { t: 'emote'; from: string; e: string }
  | { t: 'staff'; msg: StaffMsg }
  | { t: 'staffHistory'; rows: StaffMsg[] }
  | { t: 'staffAccess'; on: boolean; why?: string }
  | { t: 'soccer'; s: SoccerWire }
  | { t: 'soccerEnd'; result: 'win' | 'draw' | 'loss'; score: [number, number]; team: 0 | 1; goals: number; aura: number }
  | { t: 'room'; owner: string; items: PlacedItem[] }
  | { t: 'board'; rows: BoardRow[] }
  | { t: 'coupleAsk'; from: string }
  | { t: 'ceremony'; endsAt: number; options: string[] }
  | { t: 'ceremonyResult'; lines: string[] }
  | { t: 'final'; winner: string; partner: string }
  | { t: 'kicked'; reason: string }
  | { t: 'paused'; text: string }
  | { t: 'scene'; scene: Scene }
  | { t: 'spun'; index: number; msg: string }
  | { t: 'laps'; rows: { name: string; ms: number }[] }
  | { t: 'fireworks'; x: number; z: number; from: string }
  | { t: 'party'; until: number; by: string }
  | { t: 'tag'; it: string; until: number }
  | { t: 'tagEnd'; it: string; winners: string[] };

/** Only the owner can pause the game, and only they can play while it's paused. */
export const OWNER = 'Beau';
export const PAUSE_TEXT = "The deadline is up. $15 needs to be paid to Beau before the game can continue. Talk to Keola and Milla about getting Beau the money. Anyone can pay! Don't worry, everyone's progress is saved.";
