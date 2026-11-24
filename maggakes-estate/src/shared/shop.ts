import type { ZoneId } from './people';

export type ShopCat = 'outfit' | 'accessory' | 'furniture' | 'car' | 'fun';
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
  /** Weekly event id: only buyable while that event is on. */
  event?: string;
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
  o('fit_neon', 'Neon Arcade Fit', '🕹️', 800, 'hoodie', '#ff3df0', '#1b1c24', { floor: 'f9' }),
  o('fit_movie', 'Movie Premiere Gown', '🎬', 1300, 'sequin', '#d4af37', '#d4af37', { floor: 'f10' }),
  o('fit_snow', 'Snow Bunny Fit', '❄️', 1000, 'track', '#ffffff', '#bfe3f2', { floor: 'f11' }),
  o('fit_penthouse', 'Penthouse Tux', '🤵', 1600, 'suit', '#111216', '#111216', { floor: 'f12' }),
  o('fit_starlight', 'Starlight Gown', '🌌', 1800, 'gown', '#2a2340', '#b388ff', { floor: 'f12' }),
  o('fit_mermaid', 'Mermaid Sequins', '🧜', 1500, 'sequin', '#33c4c4', '#7f5bd5', { floor: 'f13' }),
  o('fit_designer', 'Designer Blazer Set', '🧥', 1700, 'blazer', '#ffffff', '#1b1c24', { floor: 'f14' }),
  o('fit_spa', 'Fluffy Spa Robe', '🧖', 900, 'pjs', '#ffffff', '#ffffff', { floor: 'f16' }),
  o('fit_astro', 'Astronaut Suit', '👩‍🚀', 1900, 'track', '#f0f0f0', '#d0d0d0', { floor: 'f19' }),
  o('fit_candy', 'Candy Pop Dress', '🍬', 1400, 'sundress', '#ff9fc4', '#ff9fc4', { floor: 'f21' }),
  o('fit_festival', 'Festival Fit', '🎪', 1500, 'coord', '#ffd23f', '#ff6fb5', { floor: 'f23' }),
  o('fit_blossom', 'Cherry Blossom Gown', '🌸', 2200, 'gown', '#ffd6e7', '#ffc0d9', { floor: 'f24' }),
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
  // Sky floors (9th–12th)
  { id: 'd_arcade', name: 'Arcade Machine', emoji: '🕹️', cat: 'furniture', price: 900, floor: 'f9', r: { model: 'arcade', text: 'MY ARCADE' } },
  { id: 'd_claw', name: 'Claw Machine', emoji: '🧸', cat: 'furniture', price: 1200, floor: 'f9', r: { model: 'claw', color: '#ff6fb5' } },
  { id: 'd_popcorn', name: 'Popcorn Cart', emoji: '🍿', cat: 'furniture', price: 700, floor: 'f10', r: { model: 'popcorn' } },
  { id: 'd_cinemaseat', name: 'Cinema Recliners', emoji: '🎬', cat: 'furniture', price: 900, floor: 'f10', r: { model: 'cinemaseats', n: 2 } },
  { id: 'd_snowman', name: 'Snowman', emoji: '⛄', cat: 'furniture', price: 600, floor: 'f11', r: { model: 'snowman' } },
  { id: 'd_pine', name: 'Sparkly Pine Tree', emoji: '🎄', cat: 'furniture', price: 900, floor: 'f11', r: { model: 'pine', h: 2.4, lights: 1, star: 1 } },
  { id: 'd_fireplace', name: 'Cosy Fireplace', emoji: '🔥', cat: 'furniture', price: 1500, floor: 'f11', r: { model: 'fireplace', w: 1.8 } },
  { id: 'd_piano', name: 'Grand Piano', emoji: '🎹', cat: 'furniture', price: 2500, floor: 'f12', r: { model: 'grandpiano' } },
  { id: 'd_champagne', name: 'Sparkle Glass Tower', emoji: '🥂', cat: 'furniture', price: 1800, floor: 'f12', r: { model: 'champagne' } },
  // Tower floors (13th–24th)
  { id: 'd_jelly', name: 'Jellyfish Tank', emoji: '🪼', cat: 'furniture', price: 1600, floor: 'f13', r: { model: 'jellytube' } },
  { id: 'd_mannequin', name: 'Fashion Mannequin', emoji: '👗', cat: 'furniture', price: 900, floor: 'f14', r: { model: 'mannequin', color: '#ff6fb5' } },
  { id: 'd_cakestand', name: 'Cake Stand', emoji: '🎂', cat: 'furniture', price: 700, floor: 'f15', r: { model: 'cakestand' } },
  { id: 'd_salonchair', name: 'Salon Chair & Mirror', emoji: '💇', cat: 'furniture', price: 1100, floor: 'f16', r: { model: 'salonchair' } },
  { id: 'd_easel', name: 'Art Easel', emoji: '🎨', cat: 'furniture', price: 600, floor: 'f17', r: { model: 'easel' } },
  { id: 'd_balloons', name: 'Balloon Bunch', emoji: '🎈', cat: 'furniture', price: 500, floor: 'f18', r: { model: 'balloons' } },
  { id: 'd_orrery', name: 'Planet Model', emoji: '🪐', cat: 'furniture', price: 1500, floor: 'f19', r: { model: 'orrery' } },
  { id: 'd_perch', name: 'Parrot Perch', emoji: '🦜', cat: 'furniture', price: 900, floor: 'f20', r: { model: 'perch' } },
  { id: 'd_lollipop', name: 'Giant Lollipop', emoji: '🍭', cat: 'furniture', price: 800, floor: 'f21', r: { model: 'lollipop', h: 1.8 } },
  { id: 'd_cauldron', name: 'Bubbling Cauldron', emoji: '🧪', cat: 'furniture', price: 1300, floor: 'f22', r: { model: 'cauldron' } },
  { id: 'd_tent', name: 'Glitter Tent', emoji: '⛺', cat: 'furniture', price: 1200, floor: 'f23', r: { model: 'tent', r: 1 } },
  { id: 'd_bonsai', name: 'Bonsai Tree', emoji: '🌳', cat: 'furniture', price: 1000, floor: 'f24', r: { model: 'bonsai' } },

  // ---------- Cars ----------
  { id: 'car_kart', name: 'Mini Kart', emoji: '🏎️', cat: 'car', price: 0, free: true, r: { model: 'kart', color: '#ff3d7f' } },
  { id: 'car_hatch', name: 'City Hatch', emoji: '🚗', cat: 'car', price: 0, free: true, r: { model: 'hatch', color: '#f4a6c6' } },
  { id: 'car_buggy', name: 'Golf Buggy', emoji: '🛺', cat: 'car', price: 800, r: { model: 'buggy', color: '#ffffff' } },
  { id: 'car_conv', name: 'Convertible', emoji: '🏎️', cat: 'car', price: 1500, r: { model: 'convertible', color: '#d7263d' } },
  { id: 'car_suv', name: 'Luxury SUV', emoji: '🚙', cat: 'car', price: 1800, floor: 'f3', r: { model: 'suv', color: '#111418' } },
  { id: 'car_sports', name: 'Sports Car', emoji: '🏁', cat: 'car', price: 2500, floor: 'f5', r: { model: 'sports', color: '#2b6cff' } },
  { id: 'car_super', name: 'Supercar', emoji: '⚡', cat: 'car', price: 4000, floor: 'f7', r: { model: 'super', color: '#ff9f1c' } },
  { id: 'car_limo', name: 'Gold VIP Limo', emoji: '🥂', cat: 'car', price: 5000, vip: true, r: { model: 'limo', color: '#d4af37' } },
];

// ---------- Fun ----------
// ---------- Weekly event exclusives (only buyable during their week) ----------
SHOP.push(
  o('ev_witch', 'Spooky Witch Dress', '🧙', 900, 'gown', '#1b1c24', '#ff7a1a', { event: 'spooky' }),
  { id: 'ev_boo', name: 'BOO! Neon Sign', emoji: '👻', cat: 'furniture', price: 700, event: 'spooky', r: { model: 'neon', text: 'BOO!', color: '#ff7a1a' } },
  o('ev_runway', 'Runway Sequins', '👠', 1100, 'sequin', '#ff3df0', '#ff3df0', { event: 'fashion' }),
  { id: 'ev_vogue', name: 'Catwalk Neon Sign', emoji: '💅', cat: 'furniture', price: 700, event: 'fashion', r: { model: 'neon', text: 'SLAY', color: '#ff3df0' } },
  o('ev_tropic', 'Tropical Splash Fit', '🌺', 800, 'beach', '#ff7a1a', '#33a8ff', { event: 'summer' }),
  { id: 'ev_flamingo', name: 'Pool Flamingo', emoji: '🦩', cat: 'furniture', price: 600, event: 'summer', r: { model: 'flamingo' } },
  o('ev_puffer', 'Puffer Jacket Fit', '🧥', 900, 'hoodie', '#9fdcff', '#ffffff', { event: 'winter' }),
  { id: 'ev_snowglobe', name: 'Snow Neon Sign', emoji: '❄️', cat: 'furniture', price: 700, event: 'winter', r: { model: 'neon', text: '❄ LET IT SNOW', color: '#9fdcff' } },
  o('ev_racer', 'Racing Suit', '🏁', 900, 'track', '#ffd23f', '#1b1c24', { event: 'racing' }),
  { id: 'ev_flag', name: 'Checkered Neon Sign', emoji: '🏎️', cat: 'furniture', price: 700, event: 'racing', r: { model: 'neon', text: 'VROOM', color: '#ffd23f' } },
  o('ev_heartdress', 'Heart Slip Dress', '💗', 1000, 'slip', '#ff6fb5', '#ff6fb5', { event: 'love' }),
  { id: 'ev_lovesign', name: 'Love Island Sign', emoji: '💘', cat: 'furniture', price: 700, event: 'love', r: { model: 'neon', text: 'LOVE', color: '#ff6fb5' } },
  o('ev_gamer', 'Gamer Hoodie', '🎮', 800, 'hoodie', '#7cff6b', '#1b1c24', { event: 'arcade' }),
  { id: 'ev_gameover', name: 'GAME OVER Sign', emoji: '🕹️', cat: 'furniture', price: 700, event: 'arcade', r: { model: 'neon', text: 'GAME OVER', color: '#7cff6b' } },
  o('ev_pawprint', 'Paw Print Co-ord', '🐾', 800, 'coord', '#c8925a', '#f2e3c6', { event: 'pets' }),
  { id: 'ev_petbed', name: 'Luxury Pet Bed', emoji: '🛏️', cat: 'furniture', price: 500, event: 'pets', r: { model: 'petbed', color: '#ffd6e7' } },
);

SHOP.push({ id: 'fx_fireworks', name: 'Fireworks', emoji: '🎆', cat: 'fun', price: 150, r: {} });

/** Items you can own more than one of. */
export const stackable = (i: ShopItem) => i.cat === 'furniture' || i.cat === 'fun';

export const CAR_PAINTS = ['#f4a6c6', '#ffffff', '#111418', '#d7263d', '#2b6cff', '#4fd1c5', '#ff9f1c', '#b9a2e8', '#d4af37', '#6b8f71'];

export function shopItem(id: string): ShopItem | undefined {
  return SHOP.find((s) => s.id === id);
}

export const FREE_ITEMS = SHOP.filter((s) => s.free).map((s) => s.id);
