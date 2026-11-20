import type { ZoneId } from './people';

/** The kinds of mini-game a task can open. */
export type TaskKind =
  | 'sequence' // tap ingredients/steps in the right order
  | 'hold'     // hold to scrub / clean / fill
  | 'timing'   // stop the moving marker in the sweet spot, 3 times
  | 'simon'    // repeat the light-up pattern
  | 'collect'  // walk around and pick up glowing items
  | 'choice'   // pick the right answer
  | 'outfit'   // open the wardrobe and save a look
  | 'decorate' // have decorations placed in your own bedroom
  | 'photo';   // take a photo

export interface TaskDef {
  id: string;
  label: string;
  kind: TaskKind;
  /** Short how-to line shown in the mini-game. */
  hint: string;
  /** Kind-specific data. */
  steps?: string[];        // sequence: emoji + word in the correct order
  count?: number;          // collect: how many pickups / decorate: how many items
  question?: { q: string; options: string[]; answer: number }[]; // choice
  item?: string;           // collect: emoji of the pickup
}

export interface FloorDef {
  id: ZoneId;
  /** Short label used on the lift buttons. */
  short: string;
  name: string;
  /** Total Aura Earned needed to enter. */
  need: number;
  tasks: TaskDef[];
  blurb: string;
}

export const TASK_AURA = 200;
export const REPLAY_AURA = 50;

const bed = (): TaskDef => ({
  id: 'bed', label: 'Make your bed', kind: 'sequence',
  hint: 'Tap the steps in order to make the bed perfectly.',
  steps: ['🛏️ Fitted sheet', '🧺 Top sheet', '🛌 Doona', '🪶 Pillows', '🧸 Cushions'],
});
const wardrobe = (): TaskDef => ({
  id: 'wardrobe', label: 'Organise your wardrobe', kind: 'collect',
  hint: 'Pick up the 6 clothes scattered around the floor.', count: 6, item: '👗',
});
const outfit = (): TaskDef => ({
  id: 'outfit', label: 'Choose an outfit', kind: 'outfit',
  hint: 'Open the wardrobe, put together a look and save it.',
});

export const FLOORS: FloorDef[] = [
  {
    id: 'b', short: 'B', name: 'Basement – Phoebe & Serena', need: 0, tasks: [],
    blurb: "Free level! Phoebe's brainrot bedroom and Serena's beachy room.",
  },
  {
    id: 'f1', short: '1', name: '1st Floor – Reception & Guests', need: 0,
    blurb: 'Grand reception, guest rooms, sushi room and luxury spa.',
    tasks: [
      {
        id: 'checkin', label: 'Check in a guest', kind: 'choice',
        hint: 'Answer the guests at the front desk.',
        question: [
          { q: '"Hi! I booked the room with the ensuite next to reception." Which key?', options: ['Guest Bedroom 1', 'Butler\'s Pantry', 'Sushi Room'], answer: 0 },
          { q: '"Where can I get a massage?"', options: ['Car park', 'Luxury Spa', 'Pet room'], answer: 1 },
          { q: '"What floor is the gym on?"', options: ['2nd', '3rd', '7th'], answer: 1 },
        ],
      },
      {
        id: 'sushi', label: 'Prepare a sushi plate', kind: 'sequence',
        hint: 'Build the sushi roll in the right order.',
        steps: ['🟩 Nori sheet', '🍚 Rice', '🐟 Salmon', '🥑 Avocado', '🍣 Roll & slice'],
      },
      {
        id: 'cleanguest', label: 'Clean a guest bedroom', kind: 'hold',
        hint: 'Hold the button to scrub the room until it sparkles.',
      },
      {
        id: 'spa', label: 'Set up the spa', kind: 'sequence',
        hint: 'Get the spa ready for guests.',
        steps: ['🧺 Fresh towels', '🕯️ Light candles', '🌿 Eucalyptus oil', '🎶 Calm music', '🫖 Herbal tea'],
      },
      {
        id: 'drink', label: 'Serve a guest a drink', kind: 'sequence',
        hint: 'Make the house mocktail.',
        steps: ['🧊 Ice', '🍓 Strawberries', '🍋 Lemonade', '🌿 Mint', '🥤 Serve'],
      },
    ],
  },
  {
    id: 'f2', short: '2', name: '2nd Floor – Kitchen, Lounge & Pets', need: 1000,
    blurb: 'Massive kitchen, lounge room, and everything for the pets.',
    tasks: [
      {
        id: 'breakfast', label: 'Make breakfast', kind: 'sequence',
        hint: 'Cook pancakes the right way.',
        steps: ['🥣 Mix batter', '🍳 Heat pan', '🥞 Flip pancakes', '🍓 Add berries', '🍯 Drizzle syrup'],
      },
      {
        id: 'feed', label: 'Feed a pet', kind: 'choice',
        hint: 'Give each pet the right food.',
        question: [
          { q: 'Biscuit the puppy is hungry. What do you give him?', options: ['🍫 Chocolate', '🦴 Dog biscuits', '🍇 Grapes'], answer: 1 },
          { q: 'Mochi the cat wants dinner.', options: ['🐟 Fish', '🧅 Onion', '☕ Coffee'], answer: 0 },
          { q: 'How often should the pets get fresh water?', options: ['Once a week', 'Every day', 'Never'], answer: 1 },
        ],
      },
      {
        id: 'wash', label: 'Wash a pet', kind: 'hold',
        hint: 'Hold to scrub Biscuit until he is all bubbles.',
      },
      {
        id: 'cleankitchen', label: 'Clean the kitchen', kind: 'collect',
        hint: 'Collect the 5 dirty dishes left around the floor.', count: 5, item: '🍽️',
      },
      {
        id: 'snack', label: 'Prepare a snack', kind: 'sequence',
        hint: 'Make a fruit platter.',
        steps: ['🍉 Watermelon', '🍓 Strawberries', '🥝 Kiwi', '🍇 Grapes', '🍫 Choc drizzle'],
      },
    ],
  },
  {
    id: 'f3', short: '3', name: '3rd Floor – Gym & Indoor Pool', need: 2000,
    blurb: 'Fully equipped gym, indoor pool, hot tub and pilates.',
    tasks: [
      {
        id: 'setupgym', label: 'Set up the gym', kind: 'sequence',
        hint: 'Get the gym open for the day.',
        steps: ['💡 Lights on', '🎵 Workout playlist', '🧴 Wipe machines', '💧 Fill water station', '🧻 Stack towels'],
      },
      {
        id: 'swim', label: 'Complete a swimming activity', kind: 'timing',
        hint: 'Tap when the marker is in the pink zone to nail each stroke.',
      },
      {
        id: 'organisegym', label: 'Organise gym equipment', kind: 'collect',
        hint: 'Put away the 6 dumbbells lying around.', count: 6, item: '🏋️',
      },
      {
        id: 'hottub', label: 'Prepare the hot tub', kind: 'timing',
        hint: 'Stop the temperature in the perfect zone.',
      },
      {
        id: 'stretch', label: 'Complete a stretching activity', kind: 'timing',
        hint: 'Hold each stretch — tap in the sweet spot.',
      },
    ],
  },
  {
    id: 'f4', short: '4', name: '4th Floor – Keola & Jess', need: 3000,
    blurb: "Keola's 67 + ocean demigod room, Jess's concert room and the dining room.",
    tasks: [
      bed(),
      wardrobe(),
      {
        id: 'dining', label: 'Set the dining table', kind: 'sequence',
        hint: 'Set the table for a fancy dinner.',
        steps: ['🧵 Tablecloth', '🍽️ Plates', '🍴 Cutlery', '🥂 Glasses', '🕯️ Candles'],
      },
      outfit(),
      {
        id: 'decorate', label: 'Decorate your room', kind: 'decorate', count: 1,
        hint: 'Place at least 1 decoration in your own bedroom (Decorate button), then come back here.',
      },
    ],
  },
  {
    id: 'f5', short: '5', name: '5th Floor – Ava & Grace', need: 4000,
    blurb: 'Coastal and music bedrooms, music room, recording studio and DJ booth.',
    tasks: [
      {
        id: 'record', label: 'Record a song', kind: 'timing',
        hint: 'Hit each note on beat in the pink zone.',
      },
      {
        id: 'dj', label: 'Use the DJ booth', kind: 'simon',
        hint: 'Watch the pads, then repeat the mix.',
      },
      {
        id: 'organisemusic', label: 'Organise the music room', kind: 'collect',
        hint: 'Pick up the 6 vinyls scattered around.', count: 6, item: '💿',
      },
      {
        id: 'photo', label: 'Take a photo', kind: 'photo',
        hint: 'Strike a pose and snap a photo.',
      },
      {
        id: 'musicchallenge', label: 'Complete a music challenge', kind: 'simon',
        hint: 'Repeat the melody on the keys.',
      },
    ],
  },
  {
    id: 'f6', short: '6', name: '6th Floor – Charis & Gabby', need: 5000,
    blurb: "Charis's and Gabby's bedrooms with a giant walk-in wardrobe.",
    tasks: [
      bed(),
      wardrobe(),
      outfit(),
      {
        id: 'cleanensuite', label: 'Clean your ensuite', kind: 'hold',
        hint: 'Hold to scrub the ensuite until it shines.',
      },
      {
        id: 'decorate', label: 'Decorate your room', kind: 'decorate', count: 3,
        hint: 'Have at least 3 decorations placed in your own bedroom, then come back here.',
      },
    ],
  },
  {
    id: 'f7', short: '7', name: "7th Floor – Milla's Private Floor", need: 6000,
    blurb: 'Luxury bedroom, getting-ready room, yoga room and private lounge.',
    tasks: [
      {
        id: 'yoga', label: 'Complete a yoga activity', kind: 'timing',
        hint: 'Breathe and hold each pose in the sweet spot.',
      },
      {
        id: 'getready', label: 'Organise the getting-ready room', kind: 'collect',
        hint: 'Collect the 6 makeup items lying around.', count: 6, item: '💄',
      },
      outfit(),
      {
        id: 'cleanlounge', label: 'Clean the lounge', kind: 'hold',
        hint: 'Hold to vacuum and fluff the cushions.',
      },
      wardrobe(),
    ],
  },
  {
    id: 'f8', short: '8', name: '8th Floor – Rooftop Paradise', need: 7000,
    blurb: 'Infinity pool, hot tub, rooftop lounge and garden. Unlocks Love Island!',
    tasks: [
      {
        id: 'infinity', label: 'Swim in the infinity pool', kind: 'timing',
        hint: 'Time your strokes in the pink zone.',
      },
      {
        id: 'tropical', label: 'Make a tropical drink', kind: 'sequence',
        hint: 'Blend the rooftop special mocktail.',
        steps: ['🧊 Ice', '🍍 Pineapple', '🥭 Mango', '🥥 Coconut', '🌺 Garnish'],
      },
      {
        id: 'sunbeds', label: 'Organise the sunbeds', kind: 'collect',
        hint: 'Collect the 6 towels blown across the rooftop.', count: 6, item: '🏖️',
      },
      {
        id: 'garden', label: 'Water the rooftop garden', kind: 'collect',
        hint: 'Water the 5 thirsty plants.', count: 5, item: '💧',
      },
      {
        id: 'sunset', label: 'Complete a rooftop activity', kind: 'timing',
        hint: 'Sunset volleyball — hit it in the sweet spot!',
      },
    ],
  },
];

export const PARK = { id: 'park' as ZoneId, short: 'P', name: 'Underground Car Park', need: 0 };
export const VILLA = { id: 'villa' as ZoneId, short: '♥', name: 'Love Island Villa', need: 7000 };

export function floorById(id: ZoneId): FloorDef | undefined {
  return FLOORS.find((f) => f.id === id);
}

export function zoneName(id: ZoneId): string {
  if (id === 'park') return PARK.name;
  if (id === 'villa') return VILLA.name;
  return floorById(id)?.name ?? id;
}

export function zoneNeed(id: ZoneId): number {
  if (id === 'park') return PARK.need;
  if (id === 'villa') return VILLA.need;
  return floorById(id)?.need ?? Infinity;
}

export const ALL_ZONES: ZoneId[] = ['park', 'b', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'villa'];
