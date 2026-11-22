import type { Home, ZoneId } from './people';
import type { Look, PetKind, PlacedItem, Save } from './save';
import type { Scene, SeasonAction } from './season';

/** What a player looks like to everyone else. */
export interface PeerInfo {
  name: string;
  zone: ZoneId;
  look: Look;
  vip: boolean;
  car?: { id: string; paint: string } | null;
  partner?: string;
  pet?: { kind: PetKind; name: string };
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
  | { t: 'car'; car: string | null; paint?: string }
  | { t: 'villa'; challenge: string }
  | { t: 'couple'; to: string }
  | { t: 'coupleReply'; from: string; yes: boolean }
  | { t: 'recouple' }
  | { t: 'pick'; who: string }
  | { t: 'final' }
  | { t: 'board' }
  | { t: 'admin'; action: AdminAction; target: string }
  | { t: 'accounts' }
  | { t: 'pet'; kind: string; name: string }
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
  | { t: 'welcome'; save: Save; admin: boolean; residences: Residence[]; pending: number }
  | { t: 'world'; residences: Residence[] }
  | { t: 'accounts'; rows: AccountRow[] }
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
  | { t: 'room'; owner: string; items: PlacedItem[] }
  | { t: 'board'; rows: BoardRow[] }
  | { t: 'coupleAsk'; from: string }
  | { t: 'ceremony'; endsAt: number; options: string[] }
  | { t: 'ceremonyResult'; lines: string[] }
  | { t: 'final'; winner: string; partner: string }
  | { t: 'kicked'; reason: string }
  | { t: 'scene'; scene: Scene }
  | { t: 'spun'; index: number; msg: string }
  | { t: 'laps'; rows: { name: string; ms: number }[] }
  | { t: 'fireworks'; x: number; z: number; from: string }
  | { t: 'party'; until: number; by: string }
  | { t: 'tag'; it: string; until: number }
  | { t: 'tagEnd'; it: string; winners: string[] };
