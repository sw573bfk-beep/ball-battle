import type { ZoneId } from './people';

export type ShopCat = 'outfit' | 'accessory' | 'furniture' | 'car';
export type WearSlot = 'outfit' | 'glasses' | 'bag' | 'jewel' | 'hat' | 'perfume';

export interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  cat: ShopCat;
  price: number;
  /** Floor that must be unlocked before this shows as buyable. */
  floor?: ZoneId;
  vip?: boolean;
  /** Everyone owns this from the start. */
  free?: boolean;
  /** Wearables: which slot it equips into. */
  slot?: WearSlot;
  /** Render data (colours, styles, model key). */
  r: Record<string, string | number>;
}

const o = (id: string, name: string, emoji: string, price: number, style: string, top: string, bottom: string, extra: Partial<ShopItem> = {}): ShopItem =>
  ({ id, name, emoji, cat: 'outfit', price, slot: 'outfit', r: { style, top, bottom }, ...extra });

export const SHOP: ShopItem[] = [
  // ---------- Outfits ----------
  o('fit_pink', 'Pink Casual', '👚', 0, 'casual', '#f6a6c8', '#7fa6d9', { free: true }),
  o('fit_blue', 'Blue Tee & Jeans', '👕', 0, 'casual', '#6aa7e8', '#33446b', { free: true }),
  o('fit_white', 'White Linen', '🤍', 0, 'casual', '#f4efe6', '#e4d6bf', { free: true }),
  o('fit_villa', 'Villa Swim Set', '🌺', 0, 'beach', '#ff6f91', '#ffd23f', { free: true }),
  // Villa glam — free for everyone, styled for Love Island nights.
  o('fit_slip', 'Satin Midi Dress', '🥂', 0, 'slip', '#e8b7c8', '#e8b7c8', { free: true }),
  o('fit_coord', 'Co-ord Set', '💗', 0, 'coord', '#ff7aa8', '#ff7aa8', { free: true }),
  o('fit_sequin', 'Sequin Party Dress', '✨', 0, 'sequin', '#d9c7ff', '#d9c7ff', { free: true }),
  o('fit_sundress', 'Floral Sundress', '🌼', 0, 'sundress', '#fff1c9', '#fff1c9', { free: true }),
  o('fit_linen', 'Linen Shirt & Shorts', '🏝️', 0, 'linen', '#f4efe4', '#c9b79a', { free: true }),
  o('fit_openshirt', 'Open Shirt & Tee', '🌴', 0, 'openshirt', '#4f7fa8', '#e9e2d4', { free: true }),
  o('fit_polo', 'Polo & Chinos', '⛳', 0, 'polo', '#1f3b5c', '#d8c8a8', { free: true }),
  o('fit_blazer', 'Party Blazer', '🕺', 0, 'blazer', '#2a2a33', '#2a2a33', { free: true }),
  o('fit_summer', 'Summer Dress', '👗', 500, 'dress', '#ffd36e', '#ffd36e'),
  o('fit_track', 'Tracksuit', '🏃', 500, 'track', '#2e2e38', '#2e2e38'),
  o('fit_hoodie', 'Hoodie & Joggers', '🧥', 500, 'hoodie', '#b9a2e8', '#d9d0ef'),
  o('fit_beach', 'Beach Fit', '🩱', 500, 'beach', '#4fd1c5', '#fbe7a1', { floor: 'f2' }),
  o('fit_pjs', 'Silk Pyjamas', '😴', 400, 'pjs', '#f5c6d6', '#f5c6d6'),
  o('fit_gym', 'Gym Set', '💪', 500, 'gym', '#ff6f91', '#22242c', { floor: 'f3' }),
  o('fit_suit', 'Formal Suit', '🤵', 700, 'suit', '#1d2233', '#1d2233', { floor: 'f3' }),
  o('fit_coastal', 'Coastal Chic', '🐚', 650, 'dress', '#bfe3f2', '#bfe3f2', { floor: 'f4' }),
  o('fit_gown', 'Sparkle Gown', '✨', 900, 'gown', '#c9a4ff', '#c9a4ff', { floor: 'f5' }),
  o('fit_red', 'Red Carpet Gown', '🌹', 1100, 'gown', '#d7263d', '#d7263d', { floor: 'f7' }),
  o('fit_vip', 'Gold VIP Fit', '👑', 1200, 'suit', '#d4af37', '#2a2416', { vip: true }),

  // ---------- Accessories ----------
  { id: 'gl_aviator', name: 'Aviator Sunglasses', emoji: '🕶️', cat: 'accessory', slot: 'glasses', price: 200, r: { style: 'aviator', color: '#222' } },
  { id: 'gl_heart', name: 'Heart Sunglasses', emoji: '💗', cat: 'accessory', slot: 'glasses', price: 200, r: { style: 'heart', color: '#ff4f9a' } },
  { id: 'gl_cateye', name: 'Cat-eye Shades', emoji: '😎', cat: 'accessory', slot: 'glasses', price: 250, floor: 'f2', r: { style: 'cateye', color: '#5a2a1a' } },
  { id: 'pf_coastal', name: 'Perfume: Coastal Breeze', emoji: '🧴', cat: 'accessory', slot: 'perfume', price: 300, r: { color: '#7fd8ff' } },
  { id: 'pf_rose', name: 'Perfume: Rose Glow', emoji: '🌸', cat: 'accessory', slot: 'perfume', price: 300, r: { color: '#ff8fc7' } },
  { id: 'pf_gold', name: 'Perfume: Gold Rush', emoji: '✨', cat: 'accessory', slot: 'perfume', price: 600, vip: true, r: { color: '#ffd76a' } },
  { id: 'bag_tote', name: 'Mini Tote', emoji: '👜', cat: 'accessory', slot: 'bag', price: 400, r: { color: '#e8b4a0', size: 1 } },
  { id: 'bag_designer', name: 'Designer Handbag', emoji: '👛', cat: 'accessory', slot: 'bag', price: 800, floor: 'f4', r: { color: '#1a1a1a', size: 1.2 } },
  { id: 'bag_diamond', name: 'Diamond Bag', emoji: '💎', cat: 'accessory', slot: 'bag', price: 1200, vip: true, r: { color: '#bfefff', size: 1.2 } },
  { id: 'jw_pearl', name: 'Pearl Necklace', emoji: '📿', cat: 'accessory', slot: 'jewel', price: 350, r: { style: 'pearl', color: '#fff8ee' } },
  { id: 'jw_gold', name: 'Gold Chain', emoji: '⛓️', cat: 'accessory', slot: 'jewel', price: 450, r: { style: 'chain', color: '#e7c35a' } },
  { id: 'jw_tiara', name: 'Diamond Tiara', emoji: '👸', cat: 'accessory', slot: 'jewel', price: 900, floor: 'f6', r: { style: 'tiara', color: '#e9f6ff' } },
  { id: 'jw_crown', name: 'VIP Crown', emoji: '👑', cat: 'accessory', slot: 'jewel', price: 1500, vip: true, r: { style: 'crown', color: '#ffd23f' } },
  { id: 'hat_sun', name: 'Sun Hat', emoji: '👒', cat: 'accessory', slot: 'hat', price: 300, r: { style: 'sun', color: '#f1dfb3' } },
  { id: 'hat_cap', name: 'Cap', emoji: '🧢', cat: 'accessory', slot: 'hat', price: 250, r: { style: 'cap', color: '#ff6f91' } },

  // ---------- Furniture & decorations (placed in your bedroom) ----------
  { id: 'd_plant', name: 'Potted Plant', emoji: '🪴', cat: 'furniture', price: 150, free: true, r: { model: 'plant' } },
  { id: 'd_lights', name: 'Fairy Lights Stand', emoji: '💡', cat: 'furniture', price: 150, free: true, r: { model: 'fairylights' } },
  { id: 'd_teddy', name: 'Giant Teddy', emoji: '🧸', cat: 'furniture', price: 200, r: { model: 'teddy' } },
  { id: 'd_lava', name: 'Lava Lamp', emoji: '🫧', cat: 'furniture', price: 250, r: { model: 'lavalamp', color: '#ff5fa2' } },
  { id: 'd_beanbag', name: 'Bean Bag', emoji: '🛋️', cat: 'furniture', price: 300, r: { model: 'beanbag', color: '#f3a6c8' } },
  { id: 'd_lamp', name: 'Floor Lamp', emoji: '🪔', cat: 'furniture', price: 300, r: { model: 'floorlamp' } },
  { id: 'd_rug', name: 'Fluffy Rug', emoji: '🟣', cat: 'furniture', price: 350, r: { model: 'rug', color: '#e9dcff' } },
  { id: 'd_shark', name: 'Shark in Sneakers Plush', emoji: '🦈', cat: 'furniture', price: 350, r: { model: 'shark' } },
  { id: 'd_shelf', name: 'Bookshelf', emoji: '📚', cat: 'furniture', price: 400, r: { model: 'bookshelf' } },
  { id: 'd_fridge', name: 'Mini Fridge', emoji: '🧃', cat: 'furniture', price: 400, r: { model: 'minifridge' } },
  { id: 'd_surf', name: 'Surfboard', emoji: '🏄', cat: 'furniture', price: 400, r: { model: 'surfboard', color: '#4fd1c5' } },
  { id: 'd_neonheart', name: 'Neon Heart', emoji: '💖', cat: 'furniture', price: 450, r: { model: 'neon', text: '♥', color: '#ff4fa3' } },
  { id: 'd_neon67', name: '67 Neon Sign', emoji: '6️⃣', cat: 'furniture', price: 450, r: { model: 'neon', text: '67', color: '#33e1ff' } },
  { id: 'd_guitar', name: 'Guitar on Stand', emoji: '🎸', cat: 'furniture', price: 450, r: { model: 'guitar' } },
  { id: 'd_trident', name: 'Ocean Trident', emoji: '🔱', cat: 'furniture', price: 500, r: { model: 'trident' } },
  { id: 'd_chair', name: 'Gaming Chair', emoji: '🪑', cat: 'furniture', price: 500, r: { model: 'gamingchair', color: '#ff6f91' } },
  { id: 'd_record', name: 'Record Player', emoji: '🎶', cat: 'furniture', price: 500, floor: 'f5', r: { model: 'recordplayer' } },
  { id: 'd_mirror', name: 'Bedroom Mirror', emoji: '🪞', cat: 'furniture', price: 600, r: { model: 'mirror' } },
  { id: 'd_disco', name: 'Disco Ball', emoji: '🪩', cat: 'furniture', price: 600, r: { model: 'discoball' } },
  { id: 'd_vanity', name: 'Vanity Desk', emoji: '💄', cat: 'furniture', price: 700, floor: 'f4', r: { model: 'vanity' } },
  { id: 'd_aquarium', name: 'Aquarium', emoji: '🐠', cat: 'furniture', price: 800, floor: 'f7', r: { model: 'aquarium' } },
  { id: 'd_bed', name: 'Luxury Bed', emoji: '🛏️', cat: 'furniture', price: 1000, floor: 'f3', r: { model: 'bed', color: '#f6e9ef' } },
  { id: 'd_canopy', name: 'Canopy Bed', emoji: '👸', cat: 'furniture', price: 1400, floor: 'f6', r: { model: 'canopybed', color: '#ffd6e7' } },
  { id: 'd_statue', name: 'Gold Statue', emoji: '🗿', cat: 'furniture', price: 1500, vip: true, r: { model: 'statue' } },

  // ---------- Cars ----------
  { id: 'car_hatch', name: 'City Hatch', emoji: '🚗', cat: 'car', price: 0, free: true, r: { model: 'hatch', color: '#f4a6c6' } },
  { id: 'car_buggy', name: 'Golf Buggy', emoji: '🛺', cat: 'car', price: 800, r: { model: 'buggy', color: '#ffffff' } },
  { id: 'car_conv', name: 'Convertible', emoji: '🏎️', cat: 'car', price: 1500, r: { model: 'convertible', color: '#d7263d' } },
  { id: 'car_suv', name: 'Luxury SUV', emoji: '🚙', cat: 'car', price: 1800, floor: 'f3', r: { model: 'suv', color: '#111418' } },
  { id: 'car_sports', name: 'Sports Car', emoji: '🏁', cat: 'car', price: 2500, floor: 'f5', r: { model: 'sports', color: '#2b6cff' } },
  { id: 'car_super', name: 'Supercar', emoji: '⚡', cat: 'car', price: 4000, floor: 'f7', r: { model: 'super', color: '#ff9f1c' } },
  { id: 'car_limo', name: 'Gold VIP Limo', emoji: '🥂', cat: 'car', price: 5000, vip: true, r: { model: 'limo', color: '#d4af37' } },
];

export const CAR_PAINTS = ['#f4a6c6', '#ffffff', '#111418', '#d7263d', '#2b6cff', '#4fd1c5', '#ff9f1c', '#b9a2e8', '#d4af37', '#6b8f71'];

export function shopItem(id: string): ShopItem | undefined {
  return SHOP.find((s) => s.id === id);
}

export const FREE_ITEMS = SHOP.filter((s) => s.free).map((s) => s.id);
