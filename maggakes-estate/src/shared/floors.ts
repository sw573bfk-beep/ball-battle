import { isResidence, residenceNumber, type ZoneId } from './people';

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
  | 'photo'    // take a photo
  | 'catch'    // move a basket to catch falling items (and dodge the bad ones)
  | 'memory'   // flip cards to find pairs
  | 'rhythm'   // tap the lanes in time with the notes
  | 'spot'     // find the odd one out
  | 'maze'     // guide a character through a maze
  | 'unscramble'; // spell the words from jumbled letters

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
  item?: string;           // collect / catch / maze: emoji of the pickup, the good thing, or the player
  bad?: string;            // catch: the thing to dodge
  goal?: string;           // maze: emoji at the finish
  symbols?: string[];      // memory: the card faces (each appears twice)
  odd?: [string, string][]; // spot: [lots of these, one of these] per round
  words?: string[];        // unscramble: words to spell (3 are picked)
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
  // ------------------------------------------------------------ sky floors (above the roof)
  {
    id: 'f9', short: '9', name: '9th Floor – Sky Arcade', need: 8000,
    blurb: 'Neon arcade with claw machines, air hockey, a dance machine and a prize counter.',
    tasks: [
      { id: 'clawgame', label: 'Win a prize from the claw machine', kind: 'timing', hint: 'Drop the claw when it\'s right over a prize!' },
      { id: 'dancebattle', label: 'Win the dance battle', kind: 'simon', hint: 'Copy the dance moves on the arrow pads.' },
      { id: 'airhockey', label: 'Beat the air hockey bot', kind: 'timing', hint: 'Smash the puck when it\'s in the sweet spot.' },
      { id: 'tickets', label: 'Collect prize tickets', kind: 'collect', hint: 'Grab the 6 prize tickets spat out by the machines.', count: 6, item: '🎟️' },
      { id: 'slushie', label: 'Make a rainbow slushie', kind: 'sequence', hint: 'Make the arcade\'s famous slushie.', steps: ['🥤 Cup', '🧊 Crushed ice', '🍓 Strawberry', '🫐 Blueberry', '🌈 Rainbow swirl'] },
    ],
  },
  {
    id: 'f10', short: '10', name: '10th Floor – Cinema & Bowling', need: 9000,
    blurb: 'A private cinema with recliners and a glow-in-the-dark bowling alley.',
    tasks: [
      { id: 'strike', label: 'Bowl a strike', kind: 'timing', hint: 'Release the ball in the sweet spot for a STRIKE!' },
      { id: 'popcorn', label: 'Make the popcorn', kind: 'sequence', hint: 'Pop a fresh batch for movie night.', steps: ['🌽 Kernels', '🧈 Butter', '🔥 Heat', '🍿 Pop!', '🧂 Salt'] },
      { id: 'tidycinema', label: 'Tidy the cinema', kind: 'collect', hint: 'Pick up the 6 popcorn buckets left on the floor.', count: 6, item: '🍿' },
      {
        id: 'movietrivia', label: 'Win movie trivia night', kind: 'choice', hint: 'Answer the movie questions.',
        question: [
          { q: 'What do you call the snack bar at a cinema?', options: ['Candy bar', 'Toll booth', 'Pit stop'], answer: 0 },
          { q: 'How many pins are in ten-pin bowling?', options: ['8', '10', '12'], answer: 1 },
          { q: 'Three strikes in a row in bowling is called a…', options: ['Hat trick', 'Turkey', 'Triple'], answer: 1 },
        ],
      },
      { id: 'shoes', label: 'Polish the bowling shoes', kind: 'hold', hint: 'Hold to spray and shine all the bowling shoes.' },
    ],
  },
  {
    id: 'f11', short: '11', name: '11th Floor – Ice Rink & Snow Lounge', need: 10000,
    blurb: 'Indoor ice rink with real snow, an igloo, and a cosy fireplace lounge.',
    tasks: [
      { id: 'skate', label: 'Skate a perfect figure-eight', kind: 'timing', hint: 'Lean into each turn in the sweet spot.' },
      { id: 'buildsnowman', label: 'Build a snowman', kind: 'sequence', hint: 'Build the snowman from the bottom up.', steps: ['⚪ Big snowball', '⚪ Middle snowball', '⚪ Head', '🥕 Carrot nose', '🧣 Scarf'] },
      { id: 'hotchoc', label: 'Make hot chocolate', kind: 'hold', hint: 'Hold to stir the hot chocolate until it\'s perfect.' },
      { id: 'snowflakes', label: 'Catch snowflakes', kind: 'collect', hint: 'Catch the 6 sparkly snowflakes around the rink.', count: 6, item: '❄️' },
      { id: 'icedance', label: 'Do an ice dance routine', kind: 'simon', hint: 'Copy the ice-dance routine.' },
    ],
  },
  {
    id: 'f12', short: '12', name: '12th Floor – Penthouse Sky Club', need: 11000,
    blurb: 'The very top: a VIP sky club with a grand piano, champagne-glass tower, telescope and helipad.',
    tasks: [
      { id: 'grandpiano', label: 'Play the grand piano', kind: 'simon', hint: 'Play the melody back on the piano.' },
      {
        id: 'stargaze', label: 'Stargaze through the telescope', kind: 'choice', hint: 'Spot the right things in the night sky.',
        question: [
          { q: 'Which planet is famous for its rings?', options: ['Mars', 'Saturn', 'Venus'], answer: 1 },
          { q: 'What is a group of stars that makes a picture called?', options: ['A constellation', 'A galaxy', 'A comet'], answer: 0 },
          { q: 'Which is closest to Earth?', options: ['The Sun', 'The Moon', 'Mars'], answer: 1 },
        ],
      },
      { id: 'vipparty', label: 'Set up the VIP party', kind: 'collect', hint: 'Collect the 6 sparkly glasses for the VIP party.', count: 6, item: '🥂' },
      { id: 'landheli', label: 'Land the helicopter', kind: 'timing', hint: 'Touch down when the helicopter is right over the H!' },
      { id: 'skyphoto', label: 'Take a penthouse photo', kind: 'photo', hint: 'Strike a pose at the top of the Maggakes Estate!' },
    ],
  },
  // ------------------------------------------------------------ the tower (13th–24th)
  {
    id: 'f13', short: '13', name: '13th Floor – Aquarium', need: 12000,
    blurb: 'Walk-through fish tanks, glowing jellyfish and a touch pool.',
    tasks: [
      { id: 'feedfish', label: 'Feed the fish', kind: 'catch', hint: 'Catch the fish food — dodge the jellyfish!', item: '🦐', bad: '🪼', count: 10 },
      { id: 'seamemory', label: 'Sea creature memory', kind: 'memory', hint: 'Find all the matching sea creatures.', symbols: ['🐠', '🐙', '🦀', '🐢', '🦈', '🐬'] },
      { id: 'cleantank', label: 'Clean the big tank', kind: 'hold', hint: 'Hold to scrub the glass until it sparkles.' },
      { id: 'turtle', label: 'Guide the baby turtle', kind: 'maze', hint: 'Help the baby turtle find the sea!', item: '🐢', goal: '🌊' },
      {
        id: 'oceanquiz', label: 'Ocean quiz', kind: 'choice', hint: 'Answer the ocean questions.',
        question: [
          { q: 'Which of these is a mammal?', options: ['Shark', 'Dolphin', 'Clownfish'], answer: 1 },
          { q: 'How many arms does an octopus have?', options: ['6', '8', '10'], answer: 1 },
          { q: 'What is the biggest animal ever?', options: ['Blue whale', 'Great white shark', 'Elephant'], answer: 0 },
        ],
      },
    ],
  },
  {
    id: 'f14', short: '14', name: '14th Floor – Fashion Studio', need: 13000,
    blurb: 'A real runway, a sewing room and a professional photo set.',
    tasks: [
      { id: 'design', label: 'Design a dress', kind: 'sequence', hint: 'Make a dress from start to finish.', steps: ['✏️ Sketch', '🧵 Pick fabric', '✂️ Cut', '🪡 Sew', '✨ Add sparkle'] },
      { id: 'strut', label: 'Walk the runway', kind: 'rhythm', hint: 'Strut to the beat — tap the lanes as the notes hit the line!' },
      { id: 'fashionshoot', label: 'Fashion photoshoot', kind: 'photo', hint: 'Strike your best pose for the cover!' },
      { id: 'spotfake', label: 'Spot the fake handbag', kind: 'spot', hint: 'One of these is different — find it!', odd: [['👜', '👛'], ['👠', '👡'], ['💍', '💎']] },
      { id: 'hem', label: 'Sew a perfect hem', kind: 'timing', hint: 'Stitch when the needle is in the sweet spot.' },
    ],
  },
  {
    id: 'f15', short: '15', name: '15th Floor – Bakery Café', need: 14000,
    blurb: 'Fresh cakes, a cosy café and the best hot chips in the tower.',
    tasks: [
      { id: 'bakecake', label: 'Bake a birthday cake', kind: 'sequence', hint: 'Bake the cake in the right order.', steps: ['🥚 Eggs', '🧈 Butter', '🌾 Flour', '🔥 Bake', '🎂 Ice it'] },
      { id: 'catchcookies', label: 'Catch the cookies', kind: 'catch', hint: 'Catch the cookies coming out of the oven — not the salt!', item: '🍪', bad: '🧂', count: 10 },
      { id: 'latteart', label: 'Make latte art', kind: 'hold', hint: 'Hold to pour a perfect heart.' },
      { id: 'bakerywords', label: 'Write the menu', kind: 'unscramble', hint: 'Unscramble the menu words.', words: ['CAKE', 'BREAD', 'DONUT', 'MUFFIN', 'COOKIE', 'LATTE'] },
      { id: 'servecafe', label: 'Serve the customers', kind: 'collect', hint: 'Deliver the 6 coffees around the café.', count: 6, item: '☕' },
    ],
  },
  {
    id: 'f16', short: '16', name: '16th Floor – Spa & Salon', need: 15000,
    blurb: 'Hair salon, nail bar, sauna and the comfiest massage beds.',
    tasks: [
      { id: 'nails', label: 'Match the nail colours', kind: 'memory', hint: 'Find all the matching nail polish pairs.', symbols: ['💅', '💄', '🌸', '💖', '✨', '🎀'] },
      { id: 'facemask', label: 'Do a face mask', kind: 'sequence', hint: 'Do your skincare in the right order.', steps: ['🧼 Cleanse', '💧 Tone', '🥒 Mask', '🧴 Moisturise', '😎 Relax'] },
      { id: 'sauna', label: 'Relax in the sauna', kind: 'hold', hint: 'Hold to relax and breathe in the steam.' },
      { id: 'blowdry', label: 'Blow-dry a perfect style', kind: 'timing', hint: 'Style the hair when the brush is in the sweet spot.' },
      { id: 'towels', label: 'Fold the fluffy towels', kind: 'collect', hint: 'Collect the 6 towels around the spa.', count: 6, item: '🧖' },
    ],
  },
  {
    id: 'f17', short: '17', name: '17th Floor – Art Studio', need: 16000,
    blurb: 'Easels, a pottery wheel and a gallery for your masterpieces.',
    tasks: [
      { id: 'paint', label: 'Paint a masterpiece', kind: 'sequence', hint: 'Paint in the right order.', steps: ['🖌️ Sketch', '🎨 Background', '🌳 Trees', '🌅 Sunset', '✍️ Sign it'] },
      { id: 'pottery', label: 'Make a pot', kind: 'hold', hint: 'Hold to shape the clay on the wheel.' },
      { id: 'gallery', label: 'Spot the forgery', kind: 'spot', hint: 'One painting is a fake — find it!', odd: [['🖼️', '🪞'], ['🎨', '🖌️'], ['🌻', '🌼']] },
      {
        id: 'colourquiz', label: 'Colour mixing quiz', kind: 'choice', hint: 'What colour do you get?',
        question: [
          { q: 'Blue + yellow = ?', options: ['Green', 'Purple', 'Orange'], answer: 0 },
          { q: 'Red + white = ?', options: ['Pink', 'Brown', 'Grey'], answer: 0 },
          { q: 'Red + blue = ?', options: ['Green', 'Purple', 'Yellow'], answer: 1 },
        ],
      },
      { id: 'brushes', label: 'Wash the brushes', kind: 'collect', hint: 'Collect the 6 messy paintbrushes.', count: 6, item: '🖌️' },
    ],
  },
  {
    id: 'f18', short: '18', name: '18th Floor – Theme Park', need: 17000,
    blurb: 'A rooftop fair: carousel, Ferris wheel, game stalls and fairy floss.',
    tasks: [
      { id: 'ringtoss', label: 'Win at ring toss', kind: 'timing', hint: 'Throw when the ring lines up!' },
      { id: 'balloonpop', label: 'Catch the prizes', kind: 'catch', hint: 'Catch the prizes — not the popped balloons!', item: '🧸', bad: '💥', count: 10 },
      { id: 'fairyfloss', label: 'Spin fairy floss', kind: 'hold', hint: 'Hold to spin the biggest fairy floss ever.' },
      { id: 'carouselride', label: 'Carousel music', kind: 'rhythm', hint: 'Tap along to the carousel music!' },
      { id: 'lostkid', label: 'Help the lost teddy', kind: 'maze', hint: 'Get the teddy back to the prize stall!', item: '🧸', goal: '🎪' },
    ],
  },
  {
    id: 'f19', short: '19', name: '19th Floor – Space Observatory', need: 18000,
    blurb: 'A giant telescope, a model rocket and mission control.',
    tasks: [
      { id: 'planets', label: 'Name the planets', kind: 'unscramble', hint: 'Unscramble the planet names.', words: ['MARS', 'VENUS', 'EARTH', 'SATURN', 'PLUTO', 'JUPITER'] },
      { id: 'launch', label: 'Launch the rocket', kind: 'timing', hint: 'Hit LAUNCH in the sweet spot!' },
      { id: 'orbit', label: 'Fly to the planet', kind: 'maze', hint: 'Steer the rocket through the asteroid field.', item: '🚀', goal: '🪐' },
      { id: 'stardust', label: 'Catch stardust', kind: 'catch', hint: 'Catch the stars — dodge the comets!', item: '⭐', bad: '☄️', count: 10 },
      {
        id: 'spacequiz', label: 'Space quiz', kind: 'choice', hint: 'Answer the space questions.',
        question: [
          { q: 'Which planet do we live on?', options: ['Mars', 'Earth', 'Venus'], answer: 1 },
          { q: 'What is the Sun?', options: ['A planet', 'A star', 'A moon'], answer: 1 },
          { q: 'Which planet is called the Red Planet?', options: ['Mars', 'Jupiter', 'Neptune'], answer: 0 },
        ],
      },
    ],
  },
  {
    id: 'f20', short: '20', name: '20th Floor – Jungle Conservatory', need: 19000,
    blurb: 'A glasshouse rainforest with a waterfall, parrots and butterflies.',
    tasks: [
      { id: 'butterflies', label: 'Count the butterflies', kind: 'collect', hint: 'Find the 6 butterflies hiding in the jungle.', count: 6, item: '🦋' },
      { id: 'mist', label: 'Mist the plants', kind: 'hold', hint: 'Hold to mist the rainforest plants.' },
      { id: 'parrot', label: 'Lead the parrot home', kind: 'maze', hint: 'Fly the parrot through the jungle to its nest.', item: '🦜', goal: '🪺' },
      { id: 'spotfrog', label: 'Spot the frog', kind: 'spot', hint: 'One of these is a frog — find it!', odd: [['🦎', '🐸'], ['🌿', '🍀'], ['🐒', '🦧']] },
      {
        id: 'animalquiz', label: 'Rainforest quiz', kind: 'choice', hint: 'Answer the jungle questions.',
        question: [
          { q: 'Which animal can change colour?', options: ['Chameleon', 'Toucan', 'Sloth'], answer: 0 },
          { q: 'What do caterpillars turn into?', options: ['Bees', 'Butterflies', 'Beetles'], answer: 1 },
          { q: 'Which is the slowest?', options: ['Sloth', 'Jaguar', 'Monkey'], answer: 0 },
        ],
      },
    ],
  },
  {
    id: 'f21', short: '21', name: '21st Floor – Candy Land', need: 20000,
    blurb: 'Giant lollipops, gummy trees and a chocolate fountain.',
    tasks: [
      { id: 'catchcandy', label: 'Catch the candy', kind: 'catch', hint: 'Catch the lollies — dodge the broccoli!', item: '🍬', bad: '🥦', count: 12 },
      { id: 'candymemory', label: 'Candy memory', kind: 'memory', hint: 'Find all the matching sweets.', symbols: ['🍭', '🍫', '🍩', '🧁', '🍪', '🍬'] },
      { id: 'chocdip', label: 'Dip in the chocolate fountain', kind: 'hold', hint: 'Hold to dip the strawberries.' },
      { id: 'candywords', label: 'Name the sweets', kind: 'unscramble', hint: 'Unscramble the sweet treats.', words: ['FUDGE', 'TOFFEE', 'GUMMY', 'CANDY', 'SWEETS', 'COOKIE'] },
      { id: 'cupcake', label: 'Decorate a giant cupcake', kind: 'sequence', hint: 'Decorate it in the right order.', steps: ['🧁 Cupcake', '🍦 Icing', '🌈 Sprinkles', '🍓 Strawberry', '✨ Glitter'] },
    ],
  },
  {
    id: 'f22', short: '22', name: '22nd Floor – Haunted Floor', need: 21000,
    blurb: 'Spooky (but friendly) ghosts, a bubbling cauldron and a pumpkin patch.',
    tasks: [
      { id: 'ghosthunt', label: 'Find the friendly ghosts', kind: 'collect', hint: 'Find the 6 friendly ghosts hiding around the floor.', count: 6, item: '👻' },
      { id: 'potion', label: 'Brew a potion', kind: 'sequence', hint: 'Add the ingredients in the right order.', steps: ['💧 Water', '🍄 Mushroom', '🕸️ Cobweb', '🌙 Moonlight', '✨ Stir'] },
      { id: 'escape', label: 'Escape the haunted maze', kind: 'maze', hint: 'Find your way out by candlelight!', item: '🕯️', goal: '🚪' },
      { id: 'spooky', label: 'Spot the real skeleton', kind: 'spot', hint: 'One is different — find it!', odd: [['👻', '💀'], ['🎃', '🍊'], ['🦇', '🐦']] },
      { id: 'carve', label: 'Carve a pumpkin', kind: 'hold', hint: 'Hold to carve the spookiest pumpkin face.' },
    ],
  },
  {
    id: 'f23', short: '23', name: '23rd Floor – Music Festival', need: 22000,
    blurb: 'A rooftop festival with a huge stage, food trucks and glitter tents.',
    tasks: [
      { id: 'soundcheck', label: 'Do the sound check', kind: 'rhythm', hint: 'Hit the beats as they reach the line!' },
      { id: 'setlist', label: 'Plan the setlist', kind: 'sequence', hint: 'Put the show in the right order.', steps: ['🎤 Intro', '🎸 Big song', '💃 Dance song', '🎹 Slow song', '🎆 Encore'] },
      { id: 'glitter', label: 'Glitter face paint', kind: 'hold', hint: 'Hold to add the glitter.' },
      { id: 'crowdsurf', label: 'Light up the crowd', kind: 'timing', hint: 'Fire the confetti cannons in the sweet spot!' },
      { id: 'merch', label: 'Sell the festival merch', kind: 'collect', hint: 'Grab the 6 festival tees around the grounds.', count: 6, item: '👕' },
    ],
  },
  {
    id: 'f24', short: '24', name: '24th Floor – Sky Garden', need: 23000,
    blurb: 'The very top of the tower: cherry blossoms, a koi pond and a rose maze.',
    tasks: [
      { id: 'koi', label: 'Feed the koi', kind: 'catch', hint: 'Catch the fish food for the koi — not the leaves!', item: '🍙', bad: '🍂', count: 10 },
      { id: 'blossom', label: 'Collect cherry blossoms', kind: 'collect', hint: 'Collect the 6 blossoms that fell on the paths.', count: 6, item: '🌸' },
      { id: 'rosemaze', label: 'Solve the rose maze', kind: 'maze', hint: 'Help the bee find the golden rose!', item: '🐝', goal: '🌹' },
      { id: 'zen', label: 'Rake the zen garden', kind: 'hold', hint: 'Hold to rake calm patterns in the sand.' },
      { id: 'gardenwords', label: 'Label the flowers', kind: 'unscramble', hint: 'Unscramble the flower names.', words: ['ROSE', 'TULIP', 'DAISY', 'LILY', 'ORCHID', 'LOTUS'] },
    ],
  },
];

export const PARK = { id: 'park' as ZoneId, short: 'P', name: 'Underground Car Park', need: 0 };
export const VILLA = { id: 'villa' as ZoneId, short: '♥', name: 'Love Island Villa', need: 7000 };

export function floorById(id: ZoneId): FloorDef | undefined {
  return FLOORS.find((f) => f.id === id);
}

export function zoneName(id: ZoneId): string {
  if (isResidence(id)) return `Residence ${residenceNumber(id)}`;
  if (id === 'park') return PARK.name;
  if (id === 'villa') return VILLA.name;
  return floorById(id)?.name ?? id;
}

export function zoneNeed(id: ZoneId): number {
  if (isResidence(id)) return 0;
  if (id === 'park') return PARK.need;
  if (id === 'villa') return VILLA.need;
  return floorById(id)?.need ?? Infinity;
}

/** The fixed zones. Residence floors (r1, r2, …) are added as people join. */
export const ALL_ZONES: ZoneId[] = ['park', 'b', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12', 'f13', 'f14', 'f15', 'f16', 'f17', 'f18', 'f19', 'f20', 'f21', 'f22', 'f23', 'f24', 'villa'];
