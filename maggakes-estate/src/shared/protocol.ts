import type { ZoneId } from './people';
import type { Look, PlacedItem, Save } from './save';

/** What a player looks like to everyone else. */
export interface PeerInfo {
  name: string;
  zone: ZoneId;
  look: Look;
  vip: boolean;
  car?: { id: string; paint: string } | null;
  partner?: string;
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
  | { t: 'admin'; action: 'vip' | 'unvip' | 'reset'; target: string }
  | { t: 'room?'; owner: string };

export type ServerMsg =
  | { t: 'welcome'; save: Save; admin: boolean }
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
  | { t: 'kicked'; reason: string };
